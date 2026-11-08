// Heirloom API: run the approved estate actions against PayPal Sandbox.
// POST /api/estate/execute { subscriptionId?, captureId?, payout?: { receiver, amount, note } }
// Every action is optional so the client can run them one by one and show each real ID.
// Server-only (PayPal secret stays on the server). Idempotency keys are attached to
// money-moving calls so a retried click cannot double-pay.
import { NextResponse } from 'next/server';
import { cancelSubscription, suspendSubscription, refundCapturedPayment, createPayout, getSubscription, getPayoutBatch } from '@/lib/paypal';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      subscriptionId?: string;
      captureId?: string;
      reason?: string;
      payout?: { receiver: string; amount: string; currency?: string; note?: string };
      pollBatchId?: string;
    };

    const result: Record<string, unknown> = { ok: true, at: new Date().toISOString() };
    const requestId = (label: string) => `heirloom-exec-${label}-${Date.now()}`;

    // Rehearsal mode: suspend instead of cancel so the seeded sub survives the run
    // (SUSPENDED -> activate restores it; CANCELLED is final).
    const rehearsal = (body as { rehearsal?: boolean }).rehearsal === true;
    result.mode = rehearsal ? 'rehearsal (suspend)' : 'final (cancel)';

    if (body.pollBatchId) {
      const batch = await getPayoutBatch(body.pollBatchId);
      result.payoutBatch = { id: batch.batch_header?.payout_batch_id, status: batch.batch_header?.batch_status };
      return NextResponse.json(result);
    }

    if (body.subscriptionId) {
      const stop = body.reason ?? 'Subscriber deceased — Heirloom estate wind-down';
      if (rehearsal) await suspendSubscription(body.subscriptionId, stop, requestId('suspend'));
      else await cancelSubscription(body.subscriptionId, stop, requestId('cancel'));
      const after = await getSubscription(body.subscriptionId);
      result.subscription = { id: after.id, status: after.status, note: after.status_change_note };
    }

    if (body.captureId) {
      const refund = await refundCapturedPayment(
        body.captureId,
        { note_to_payer: 'Post-death charge clawback refund (Heirloom estate resolution)' },
        requestId('refund'),
      );
      result.refund = { id: refund.id, status: refund.status, captureId: body.captureId };
    }

    if (body.payout?.receiver && body.payout.amount) {
      const batch = await createPayout(
        {
          senderBatchId: `heirloom-estate-${Date.now()}`,
          subject: 'Heirloom estate payout',
          message: 'Recovered estate balance share (Heirloom demo)',
          items: [
            {
              receiver: body.payout.receiver,
              amount: { value: body.payout.amount, currency_code: body.payout.currency ?? 'EUR' },
              note: body.payout.note ?? 'Heirloom estate payout',
              sender_item_id: `heir-${Date.now()}`,
            },
          ],
        },
        requestId('payout'),
      );
      result.payout = { batchId: batch.batch_header?.payout_batch_id, status: batch.batch_header?.batch_status, receiver: body.payout.receiver, amount: body.payout.amount };
    }

    if (!body.subscriptionId && !body.captureId && !body.payout) {
      return NextResponse.json({ ok: false, error: 'Provide subscriptionId, captureId, payout, or pollBatchId.' }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 502 });
  }
}
