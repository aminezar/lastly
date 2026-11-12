// Hosted public demo (server-only). Set LASTLY_PUBLIC_DEMO=1 on the host (render.yaml does).
// Every judge who opens the case should see the whole story, so before the case is read:
//   - seeded subscriptions a previous visitor paused (rehearsal) are re-activated, and
//   - the post-death charge is given to this case alone: when the current one is already
//     refunded, or was given to another case opened in the last few minutes (a visitor who may
//     still be running it), a fresh one is created with PayPal's Sandbox test card (same as
//     scripts/seed-capture.mjs). So two judges at once never race for the same refund.
// Final mode (permanent cancel) is refused, so no visitor can break the demo for the next.
// All of it is real Sandbox calls; nothing is simulated. Locally, without the flag, nothing
// here runs and the seed file is used as before.

import { randomUUID } from 'node:crypto';
import { activateSubscription, createTestCardCapture, getCapture, getSubscription } from '@/lib/paypal';
import { setting } from '@/lib/env';

export const publicDemo = () => setting('PUBLIC_DEMO') === '1';

type Ids = { subscription_ids?: Record<string, string>; capture_ids?: Record<string, string> };
const firstToken = (v?: string) => v?.split(' ')[0];

// A charge given to a case stays that case's own for this long (time to read the plan and run it).
const CLAIM_MS = 10 * 60_000;
// At most this many fresh charges an hour, so reloading the page cannot pile up Sandbox charges.
// Past it, cases share the latest unrefunded charge, as before.
const FRESH_PER_HOUR = 30;

// The latest unrefunded charge per capture key, which replaces the seed file's (the file is not rewritten).
let freshCaptures: Record<string, string> = {};
// Every capture this server has made for the demo, so a refund from a run that started before
// the latest reset still counts as the estate's own when its payout is sent.
const madeCaptures = new Set<string>();
// When each charge was last given to an opened case.
const claimedAt = new Map<string, number>();
let created: number[] = [];
// Case openings run one after another, so each one sees the claims of the one before.
let queue: Promise<unknown> = Promise.resolve();

/** Seed IDs with this server's latest fresh captures applied. */
export function demoIds(ids: Ids): Ids {
  if (!publicDemo()) return ids;
  return { ...ids, capture_ids: { ...(ids.capture_ids ?? {}), ...freshCaptures } };
}

/**
 * The PayPal IDs that belong to this estate: its seeded subscriptions and its captures (the
 * seeded one plus any this server created). /api/estate/execute refuses every other ID, so a
 * direct POST cannot touch other subscriptions or charges on the Sandbox merchant.
 */
export function estateIds(ids: Ids): { subscriptions: Set<string>; captures: Set<string> } {
  const current = demoIds(ids);
  const tokens = (m?: Record<string, string>) => Object.values(m ?? {}).map(firstToken).filter((id): id is string => Boolean(id));
  return {
    subscriptions: new Set(tokens(current.subscription_ids)),
    captures: new Set([...tokens(ids.capture_ids), ...tokens(current.capture_ids), ...madeCaptures]),
  };
}

/**
 * Put the Sandbox back in its starting state for one case opening and return the IDs that case
 * should read. Off the public demo it returns the seed IDs untouched.
 */
export function prepareDemo(ids: Ids, captureKeys: string[]): Promise<Ids> {
  if (!publicDemo()) return Promise.resolve(ids);
  const next = queue.then(() => reset(ids, captureKeys));
  queue = next.catch(() => undefined);
  return next;
}

async function reset(ids: Ids, captureKeys: string[]): Promise<Ids> {
  const current = demoIds(ids);
  const mine: Record<string, string> = {};
  await Promise.all([
    ...Object.values(current.subscription_ids ?? {}).map(async (raw) => {
      const id = firstToken(raw);
      if (!id) return;
      const sub = await getSubscription(id).catch(() => undefined);
      if (sub?.status === 'SUSPENDED') await activateSubscription(id, 'Lastly public demo reset').catch((e) => console.warn(`[demo] could not re-activate ${id}: ${String(e)}`));
    }),
    ...captureKeys.map(async (key) => {
      const now = Date.now();
      const id = firstToken(current.capture_ids?.[key]);
      const cap = id ? await getCapture(id).catch(() => undefined) : undefined;
      const free = cap?.status === 'COMPLETED' && now - (claimedAt.get(id!) ?? 0) > CLAIM_MS;
      created = created.filter((t) => now - t < 3_600_000);
      // Reuse the charge when it is free, or when the hourly cap is reached and it is still unrefunded.
      if (id && (free || (cap?.status === 'COMPLETED' && created.length >= FRESH_PER_HOUR))) {
        mine[key] = id;
        return;
      }
      if (created.length >= FRESH_PER_HOUR) return;
      try {
        created.push(now);
        const order = await createTestCardCapture({
          customId: 'lastly-post-death-charge',
          amount: { currency_code: 'EUR', value: '9.99' },
          description: 'StreamFlix charge after date of death (fictional)',
          requestId: `lastly-demo-${randomUUID()}`,
        });
        const fresh = order.purchase_units?.[0]?.payments?.captures?.[0];
        if (fresh?.id && fresh.status === 'COMPLETED') {
          freshCaptures = { ...freshCaptures, [key]: fresh.id };
          madeCaptures.add(fresh.id);
          mine[key] = fresh.id;
          console.log(`[demo] fresh post-death charge ${fresh.id} for ${key}`);
        }
      } catch (e) {
        console.warn(`[demo] could not create a fresh charge for ${key}: ${String(e)}`);
      }
    }),
  ]);
  for (const capId of Object.values(mine)) claimedAt.set(capId, Date.now());
  if (claimedAt.size > 500) claimedAt.delete(claimedAt.keys().next().value as string);
  return { ...current, capture_ids: { ...(current.capture_ids ?? {}), ...mine } };
}
