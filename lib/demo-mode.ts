// Hosted public demo (server-only). Set HEIRLOOM_PUBLIC_DEMO=1 on the host (render.yaml does).
// Every judge who opens the case should see the whole story, so before the case is read:
//   - seeded subscriptions a previous visitor paused (rehearsal) are re-activated, and
//   - when the post-death charge is already refunded, a fresh one is created with PayPal's
//     Sandbox test card (same as scripts/seed-capture.mjs), and used for this server's run.
// Final mode (permanent cancel) is refused, so no visitor can break the demo for the next.
// All of it is real Sandbox calls; nothing is simulated. Locally, without the flag, nothing
// here runs and the seed file is used as before.

import { randomUUID } from 'node:crypto';
import { activateSubscription, createTestCardCapture, getCapture, getSubscription } from '@/lib/paypal';

export const publicDemo = () => process.env.HEIRLOOM_PUBLIC_DEMO === '1';

type Ids = { subscription_ids?: Record<string, string>; capture_ids?: Record<string, string> };
const firstToken = (v?: string) => v?.split(' ')[0];

// The capture this server created, which replaces the seed file's (the file is not rewritten).
let freshCaptures: Record<string, string> = {};
let running: Promise<void> | null = null;
let lastRun = 0;

/** Seed IDs with this server's fresh captures applied. */
export function demoIds(ids: Ids): Ids {
  if (!publicDemo()) return ids;
  return { ...ids, capture_ids: { ...(ids.capture_ids ?? {}), ...freshCaptures } };
}

/** Put the Sandbox back in its starting state. Runs at most once at a time, and not more than every 20 s. */
export function prepareDemo(ids: Ids, captureKeys: string[]): Promise<void> {
  if (!publicDemo()) return Promise.resolve();
  if (running) return running;
  if (Date.now() - lastRun < 20_000) return Promise.resolve();
  running = reset(ids, captureKeys).finally(() => {
    lastRun = Date.now();
    running = null;
  });
  return running;
}

async function reset(ids: Ids, captureKeys: string[]) {
  const current = demoIds(ids);
  await Promise.all([
    ...Object.values(current.subscription_ids ?? {}).map(async (raw) => {
      const id = firstToken(raw);
      if (!id) return;
      const sub = await getSubscription(id).catch(() => undefined);
      if (sub?.status === 'SUSPENDED') await activateSubscription(id, 'Lastly public demo reset').catch((e) => console.warn(`[demo] could not re-activate ${id}: ${String(e)}`));
    }),
    ...captureKeys.map(async (key) => {
      const id = firstToken(current.capture_ids?.[key]);
      const cap = id ? await getCapture(id).catch(() => undefined) : undefined;
      if (cap?.status === 'COMPLETED') return;
      try {
        const order = await createTestCardCapture({
          customId: 'heirloom-post-death-charge',
          amount: { currency_code: 'EUR', value: '9.99' },
          description: 'StreamFlix charge after date of death (fictional)',
          requestId: `heirloom-demo-${randomUUID()}`,
        });
        const fresh = order.purchase_units?.[0]?.payments?.captures?.[0];
        if (fresh?.id && fresh.status === 'COMPLETED') {
          freshCaptures = { ...freshCaptures, [key]: fresh.id };
          console.log(`[demo] fresh post-death charge ${fresh.id} for ${key}`);
        }
      } catch (e) {
        console.warn(`[demo] could not create a fresh charge for ${key}: ${String(e)}`);
      }
    }),
  ]);
}
