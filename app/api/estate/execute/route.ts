// Lastly API: run ONE approved estate action against PayPal Sandbox per call, so the
// client can show each real PayPal ID as it lands.
// POST /api/estate/execute {
//   runId,                                   // one per opened case; makes retries idempotent
//   subscriptionId?, rehearsal?, confirmFinal?,  // stop: suspend (rehearsal) or cancel (final)
//   captureId?,                              // refund a post-death charge to its source
//   handover?: { key, merchant },            // new subscription on the same plan for the family
//   payout?: { receiver, amount, currency?, refundIds[] },  // gated: heir + recovered cap
//   pollBatchId?
// }
// Server-only: the PayPal secret never leaves the server.
import { publicDemo } from '@/lib/demo-mode';
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
};

type Seed = {
  estate: { sandbox_payout_receiver: { email: string } };
  sandbox_ids: { pending_demo?: { plan_ids?: Record<string, string> } };
};

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

    if (body.subscriptionId) {
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
      const refund = await refundCapturedPayment(
        body.captureId,
        { note_to_payer: 'Post-death charge refunded to the original payment source (Lastly estate resolution)' },
        key('refund', body.captureId),
      );
      // The create response is minimal; read the refund back for its real amount.
      const detail = await getRefund(refund.id).catch(() => undefined);
      return NextResponse.json({ ok: true, at, refund: { id: refund.id, status: detail?.status ?? refund.status, captureId: body.captureId, amount: detail?.amount } });
    }

    const seed = JSON.parse(await readFile(path.join(process.cwd(), 'data', 'seed-estate.json'), 'utf8')) as Seed;

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
      const refunds = await Promise.all(refundIds.slice(0, 10).map((id) => getRefund(id).catch(() => undefined)));
      const recovered = refunds
        .filter((r) => r?.status === 'COMPLETED' && r.amount?.currency_code === currency)
        .reduce((sum, r) => sum + Number(r!.amount!.value), 0);
      const value = Number(amount);
      if (!/^\d+(\.\d{1,2})?$/.test(amount ?? '') || value <= 0) return fail(400, 'Enter an amount greater than zero, with at most two decimals.');
      if (value > recovered + 1e-9)
        return fail(400, `The payout (${value.toFixed(2)} ${currency}) is more than the refunds PayPal confirms as recovered (${recovered.toFixed(2)} ${currency}).`);

      // The batch ID is derived from the refunds being paid out. PayPal rejects a repeated
      // sender_batch_id, so the same recovered money can never be paid out twice, even
      // from a new case run or another browser.
      const paidRefunds = refunds.filter((r) => r?.status === 'COMPLETED').map((r) => r!.id).sort();
      const senderBatchId = `heirloom-${createHash('sha256').update(paidRefunds.join(',')).digest('hex').slice(0, 32)}`;
      const batch = await createPayout(
        {
          senderBatchId,
          subject: 'Lastly estate payout',
          message: 'Recovered estate balance share (Lastly demo)',
          items: [{ receiver, amount: { value: value.toFixed(2), currency_code: currency }, note: 'Lastly estate payout', sender_item_id: `heir-${runId}`.slice(0, 63) }],
        },
        key('payout', 'heir'),
      ).catch((e: unknown) => {
        if (e instanceof PayPalApiError && /"field":"SENDER_BATCH_ID"/.test(e.message)) return null;
        throw e;
      });
      if (!batch) return fail(409, 'These recovered refunds have already been paid out. Nothing was sent again.');
      return NextResponse.json({ ok: true, at, payout: { batchId: batch.batch_header?.payout_batch_id, status: batch.batch_header?.batch_status, receiver, amount: value.toFixed(2), recovered: recovered.toFixed(2) } });
    }

    return fail(400, 'Provide subscriptionId, captureId, handover, payout, or pollBatchId.');
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 502 });
  }
}
