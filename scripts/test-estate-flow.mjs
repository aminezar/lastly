// End-to-end money flow against PayPal Sandbox through the running dev server.
// MOVES SANDBOX MONEY: refunds the seeded capture, pays the heir stand-in, creates a
// handover subscription (left unapproved), and suspends + re-activates one spare
// subscription. Rehearsal only; never cancels. Run scripts/seed-capture.mjs afterwards
// to get a fresh refundable capture.
//   node scripts/test-estate-flow.mjs [spareSubscriptionId] [baseUrl]
// The spare must be one of the estate's seeded subscriptions: execute refuses any other ID.
import { loadEnvLocal, call, token } from './_paypal-env.mjs';

const SPARE = process.argv[2];
const BASE = process.argv[3] ?? 'http://localhost:3000';
const RUN = `flowtest-${Date.now()}`;
let failures = 0;

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: res.status, data: await res.json() };
}
function check(name, cond, info = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${info ? `  → ${info}` : ''}`);
  if (!cond) failures++;
}

const { data: c } = await post('/api/estate/analyze', {});
const charge = c.items.find((i) => i.captureId);
check('seeded capture is refundable', charge?.captureStatus === 'COMPLETED' && !charge.noAction, `${charge?.captureId} ${charge?.captureStatus}`);
const receiver = c.payoutReceiver.email;

// Refund, then retry with the same run: PayPal must replay, not refund twice.
const r1 = await post('/api/estate/execute', { runId: RUN, captureId: charge.captureId });
check('refund → COMPLETED', r1.data.refund?.status === 'COMPLETED', `${r1.data.refund?.id} ${r1.data.refund?.amount?.value}`);
const r2 = await post('/api/estate/execute', { runId: RUN, captureId: charge.captureId });
check('refund retry in same run → same refund id', r2.data.refund?.id === r1.data.refund?.id, `${r2.status} ${r2.data.refund?.id ?? r2.data.error?.slice(0, 120)}`);
const refundIds = [r1.data.refund.id];

// Payout gates, then the real payout, then a retry that must not pay again.
const over = await post('/api/estate/execute', { runId: RUN, payout: { receiver, amount: '10.00', refundIds } });
check('payout above recovered → 400', over.status === 400, over.data.error);
const p1 = await post('/api/estate/execute', { runId: RUN, payout: { receiver, amount: r1.data.refund.amount.value, refundIds } });
check('payout created', p1.status === 200 && p1.data.payout?.batchId, `${p1.data.payout?.batchId} ${p1.data.payout?.status}`);
const p2 = await post('/api/estate/execute', { runId: RUN, payout: { receiver, amount: r1.data.refund.amount.value, refundIds } });
check('payout retry in same run → 409, nothing sent', p2.status === 409, `${p2.status} ${p2.data.error?.slice(0, 120)}`);
const p3 = await post('/api/estate/execute', { runId: `${RUN}-other`, payout: { receiver, amount: r1.data.refund.amount.value, refundIds } });
check('same refunds from a NEW run → 409, nothing sent', p3.status === 409, `${p3.status} ${p3.data.error?.slice(0, 120)}`);

let final;
for (let i = 0; i < 12 && p1.data.payout?.batchId; i++) {
  await new Promise((r) => setTimeout(r, 2500));
  const { data } = await post('/api/estate/execute', { pollBatchId: p1.data.payout.batchId });
  final = data.payoutBatch?.status;
  if (['SUCCESS', 'DENIED', 'CANCELED'].includes(final)) break;
}
check('payout batch settles SUCCESS', final === 'SUCCESS', final);

// Handover: a new subscription on the family plan, waiting for whoever keeps it.
const h = await post('/api/estate/execute', { runId: RUN, handover: { key: 'family-cloud', merchant: 'FamilyCloud' } });
check('handover subscription APPROVAL_PENDING with approve link', h.data.handover?.status === 'APPROVAL_PENDING' && /^https:\/\/www\.sandbox\.paypal\.com/.test(h.data.handover?.approveUrl ?? ''), `${h.data.handover?.subscriptionId} ${h.data.handover?.status}`);

// Suspend path on a spare subscription, then put it back.
if (SPARE) {
  const s = await post('/api/estate/execute', { runId: RUN, subscriptionId: SPARE, rehearsal: true });
  check('rehearsal suspend → SUSPENDED', s.data.subscription?.status === 'SUSPENDED', `${s.status} ${s.data.subscription?.status ?? s.data.error}`);
  loadEnvLocal();
  const tok = await token();
  await call(tok, 'POST', `/v1/billing/subscriptions/${SPARE}/activate`, { reason: 'Lastly flow test reset' });
  const back = await call(tok, 'GET', `/v1/billing/subscriptions/${SPARE}`);
  check('spare re-activated', back.status === 'ACTIVE', back.status);
}

// After the run, analyze sees the refunded capture so the portal will not refund it again.
const { data: after } = await post('/api/estate/analyze', {});
check('analyze shows capture REFUNDED afterwards', after.items.find((i) => i.captureId)?.captureStatus === 'REFUNDED');

console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
