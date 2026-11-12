// Lastly API: run ONE approved estate action against PayPal Sandbox per call, so the
// client can show each real PayPal ID as it lands.
// POST /api/estate/execute {
//   runId,                                   // one per opened case; makes retries idempotent
//   subscriptionId?, rehearsal?, confirmFinal?,  // stop: suspend (rehearsal) or cancel (final)
//   captureId?,                              // refund a post-death charge to its source
//   handover?: { key, merchant },            // new subscription on the same plan for the family
//   payout?: { receiver, amount, currency?, refundIds[] },  // gated: heir + recovered cap
//   pollBatchId?,
//   documents?: { certificateText, notaryText }  // the case's documents, re-checked here
// }
// Nothing from the browser is trusted: before any action the documents are cross-checked
// against the Legacy Mandate again (same rule as /analyze), and only this estate's own
// subscriptions, captures and refunds are accepted.
// Server-only: the PayPal secret never leaves the server.
import { estateIds, publicDemo } from '@/lib/demo-mode';
import { documentsVerified, type Mandate } from '@/lib/estate';
import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  approveLink,
  cancelSubscription,
  createPayout,
  createSubscription,
  getPayoutBatch,
  getRefund,
  getSubscription,
  PayPalApiError,
  refundCapturedPayment,
  suspendSubscription,
} from '@/lib/paypal';

type Body = {
  runId?: string;
  subscriptionId?: string;
  rehearsal?: boolean;
  confirmFinal?: boolean;
  reason?: string;
  captureId?: string;
  handover?: { key: string; merchant: string };
  payout?: { receiver: string; amount: string; currency?: string; refundIds?: string[] };
  pollBatchId?: string;
  documents?: { certificateText?: string; notaryText?: string };
};

type Seed = {
  estate: { sandbox_payout_receiver: { email: string }; legacy_mandate: Mandate };
  sandbox_ids: { pending_demo?: { plan_ids?: Record<string, string>; subscription_ids?: Record<string, string>; capture_ids?: Record<string, string> } };
};

// A refund's "up" link names the capture it refunded.
const refundedCapture = (r?: { links?: { rel: string; href: string }[] }) =>
  r?.links?.find((l) => l.rel === 'up')?.href.match(/\/captures\/([A-Z0-9]+)/)?.[1];

const fail = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status });

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Body;
    const at = new Date().toISOString();
    const runId = (body.runId ?? '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 40);

    if (body.pollBatchId) {
      const batch = await getPayoutBatch(body.pollBatchId);
      return NextResponse.json({ ok: true, at, payoutBatch: { id: batch.batch_header?.payout_batch_id, status: batch.batch_header?.batch_status } });
    }

    if (!runId) return fail(400, 'runId is required so a retried action cannot run twice.');
    // Same run + same action + same target = same PayPal-Request-Id, so PayPal replays
    // the first result instead of acting again.
    const key = (action: string, target: string) => `heirloom-${runId}-${action}-${target}`.slice(0, 108);

    const seed = JSON.parse(await readFile(path.join(process.cwd(), 'data', 'seed-estate.json'), 'utf8')) as Seed;
    // Gate 0, for every action: the documents must still pass the cross-check that unlocked the plan.
    if (!(await documentsVerified(body.documents, seed.estate.legacy_mandate)))
      return fail(403, 'The documents do not match the Legacy Mandate, so no action can run for this case.');
    const own = estateIds(seed.sandbox_ids.pending_demo ?? {});

    if (body.subscriptionId) {
      if (!own.subscriptions.has(body.subscriptionId)) return fail(403, 'That subscription is not part of this estate.');
      const rehearsal = body.rehearsal !== false;
      if (!rehearsal && body.confirmFinal !== true) return fail(400, 'Final mode cancels permanently and needs confirmFinal: true.');
      if (!rehearsal && publicDemo()) return fail(403, 'Final mode is turned off on the public demo, so the next visitor gets the same case. Rehearsal pauses the subscription instead.');
      const reason = body.reason ?? 'Subscriber deceased — Lastly estate wind-down';
      if (rehearsal) await suspendSubscription(body.subscriptionId, reason, key('suspend', body.subscriptionId));
      else await cancelSubscription(body.subscriptionId, reason, key('cancel', body.subscriptionId));
      const after = await getSubscription(body.subscriptionId);
      return NextResponse.json({ ok: true, at, mode: rehearsal ? 'rehearsal' : 'final', subscription: { id: after.id, status: after.status } });
    }

    if (body.captureId) {
      if (!own.captures.has(body.captureId)) return fail(403, 'That charge is not part of this estate.');
      const refund = await refundCapturedPayment(
        body.captureId,
        { note_to_payer: 'Post-death charge refunded to the original payment source (Lastly estate resolution)' },
        key('refund', body.captureId),
      );
      // The create response is minimal; read the refund back for its real amount.
      const detail = await getRefund(refund.id).catch(() => undefined);
      return NextResponse.json({ ok: true, at, refund: { id: refund.id, status: detail?.status ?? refund.status, captureId: body.captureId, amount: detail?.amount } });
    }

    if (body.handover?.key) {
      // Keep for Family: the family member approves a NEW subscription on the same plan.
      // The deceased's subscription is left running until that approval; nothing is moved.
      const planId = seed.sandbox_ids.pending_demo?.plan_ids?.[body.handover.key];
      if (!planId) return fail(400, `No Sandbox plan recorded for "${body.handover.key}".`);
      const origin = new URL(request.url).origin;
      const sub = await createSubscription({
        planId,
        customId: `heirloom-handover-${body.handover.key}-${runId}`.slice(0, 127),
        returnUrl: `${origin}/heirloom?handover=approved`,
        cancelUrl: `${origin}/heirloom?handover=cancelled`,
      });
      return NextResponse.json({ ok: true, at, handover: { subscriptionId: sub.id, status: sub.status, approveUrl: approveLink(sub.links), planId } });
    }

    if (body.payout) {
      const { receiver, amount, currency = 'EUR', refundIds = [] } = body.payout;
      // Gate 1: only the recorded heir account can be paid.
      if (receiver?.toLowerCase() !== seed.estate.sandbox_payout_receiver.email.toLowerCase())
        return fail(403, 'Payouts go only to the heir account recorded for this estate.');
      // Gate 2: never more than what refunds actually recovered, re-read from PayPal.
      // Gate 3: only refunds of this estate's own charges count.
      const refunds = (await Promise.all([...new Set(refundIds)].slice(0, 10).map((id) => getRefund(id).catch(() => undefined)))).filter(
        (r): r is NonNullable<typeof r> => Boolean(r && own.captures.has(refundedCapture(r) ?? '') && r.status === 'COMPLETED' && r.amount?.currency_code === currency),
      );
      const recovered = refunds.reduce((sum, r) => sum + Number(r.amount!.value), 0);
      const value = Number(amount);
      if (!/^\d+(\.\d{1,2})?$/.test(amount ?? '') || value <= 0) return fail(400, 'Enter an amount greater than zero, with at most two decimals.');
      if (value > recovered + 1e-9)
        return fail(400, `The payout (${value.toFixed(2)} ${currency}) is more than the refunds PayPal confirms as recovered (${recovered.toFixed(2)} ${currency}).`);
      if (Math.abs(value - recovered) > 0.005)
        return fail(400, `Each recovered refund is paid out once and in full, so the payout must be the full recovered amount (${recovered.toFixed(2)} ${currency}).`);

      // Gate 4: each refund is paid out in its own batch, whose ID is derived from that refund
      // alone. PayPal rejects a repeated sender_batch_id, so a refund already paid out (from this
      // case run, a new one, or another browser) is skipped and never paid twice, even when it
      // comes back together with a new refund.
      const sent: { batchId?: string; status?: string; amount: number }[] = [];
      for (const r of refunds.sort((a, b) => a.id.localeCompare(b.id))) {
        const refundAmount = Number(r.amount!.value);
        const batch = await createPayout(
          {
            senderBatchId: `heirloom-${createHash('sha256').update(r.id).digest('hex').slice(0, 32)}`,
            subject: 'Lastly estate payout',
            message: 'Recovered estate balance share (Lastly demo)',
            items: [{ receiver, amount: { value: refundAmount.toFixed(2), currency_code: currency }, note: `Lastly estate payout of refund ${r.id}`, sender_item_id: `heir-${r.id}`.slice(0, 63) }],
          },
          key('payout', r.id),
        ).catch((e: unknown) => {
          if (e instanceof PayPalApiError && /"field":"SENDER_BATCH_ID"/.test(e.message)) return null;
          throw e;
        });
        if (batch) sent.push({ batchId: batch.batch_header?.payout_batch_id, status: batch.batch_header?.batch_status, amount: refundAmount });
      }
      if (!sent.length) return fail(409, 'These recovered refunds have already been paid out. Nothing was sent again.');
      const paid = sent.reduce((sum, b) => sum + b.amount, 0);
      return NextResponse.json({
        ok: true,
        at,
        payout: {
          batchId: sent[0].batchId,
          status: sent[0].status,
          batchIds: sent.map((b) => b.batchId),
          receiver,
          amount: paid.toFixed(2),
          recovered: recovered.toFixed(2),
          alreadyPaidOut: (recovered - paid).toFixed(2),
        },
      });
    }

    return fail(400, 'Provide subscriptionId, captureId, handover, payout, or pollBatchId.');
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 502 });
  }
}
