// Contract tests for the Lastly estate API against a running dev server + PayPal Sandbox.
// Safe by default: every test here is read-only or is rejected before PayPal is called.
//   node scripts/test-estate-api.mjs [baseUrl]
// Money-moving flows are covered by scripts/test-estate-flow.mjs (opt-in).

const BASE = process.argv[2] ?? 'http://localhost:3000';
let failures = 0;

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: res.status, data: await res.json() };
}

function check(name, cond, info = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond || !info ? '' : `  → ${info}`}`);
  if (!cond) failures++;
}

const CERT = 'Deceased: Jean Dupont (fictional)\nDate of death: 20 October 2026';
const NOTARY = 'Notary act for the estate of Jean Dupont, deceased 20 October 2026.\nExecutor: Marie Dupont (daughter)';

// 1. Demo case opens, all checks really pass (three rule checks + the AI second reading, which may be skipped), 4 items come back with real states.
{
  const { status, data } = await post('/api/estate/analyze', {});
  check('analyze demo → 200', status === 200, JSON.stringify(data).slice(0, 200));
  check('demo documents verified', data.verification?.verified === true, JSON.stringify(data.verification?.checks));
  check('three rule checks + AI second reading returned', data.verification?.checks?.length === 4 && data.verification.checks[3].id === 'ai-reading');
  check('date of death from documents', data.case?.date_of_death === '2026-10-20', data.case?.date_of_death);
  check('4 estate items', data.items?.length === 4);
  check('every item has a PayPal state', data.items?.every((i) => typeof i.status === 'string'));
  check('payout receiver exposed', /@personal\.example\.com$/.test(data.payoutReceiver?.email ?? ''));
}

// 2. Executor mismatch blocks the case.
{
  const { data } = await post('/api/estate/analyze', { certificateText: CERT, notaryText: NOTARY.replace('Marie Dupont', 'Paul Martin') });
  check('executor mismatch → not verified', data.verification?.verified === false);
  check('executor check is the failing one', data.verification?.checks?.find((c) => c.id === 'executor')?.pass === false);
}

// 3. Different dates of death block the case.
{
  const { data } = await post('/api/estate/analyze', { certificateText: CERT, notaryText: NOTARY.replace('20 October', '2 October') });
  check('date mismatch → not verified', data.verification?.verified === false);
  check('date check is the failing one', data.verification?.checks?.find((c) => c.id === 'death-date')?.pass === false);
}

// 4. A document without a date is not silently filled in.
{
  const { data } = await post('/api/estate/analyze', { certificateText: 'Deceased: Jean Dupont', notaryText: NOTARY });
  check('missing date → date_of_death null', data.case?.date_of_death === null, String(data.case?.date_of_death));
  check('missing date → not verified', data.verification?.verified === false);
}

// 5. Wrong deceased blocks the case.
{
  const { data } = await post('/api/estate/analyze', { certificateText: CERT.replace('Jean Dupont', 'Anne Peeters'), notaryText: NOTARY });
  check('deceased mismatch → not verified', data.verification?.checks?.find((c) => c.id === 'deceased')?.pass === false);
}

// 6. Pasted matching text verifies and is labelled as pasted, not AI.
{
  const { data } = await post('/api/estate/analyze', { certificateText: CERT, notaryText: NOTARY });
  check('pasted matching docs → verified', data.verification?.verified === true, JSON.stringify(data.verification?.checks));
  check('pasted docs labelled honestly', ['pasted-text', 'ai'].includes(data.case?.documentsSource), data.case?.documentsSource);
}

// 6b. Regression: a name followed by a new line must not swallow the next line's first word.
{
  const { data } = await post('/api/estate/analyze', { certificateText: 'Deceased: Jean Dupont\nDate of death: 20 October 2026', notaryText: 'Estate of Jean Dupont, deceased 20 October 2026\nExecutor: Marie Dupont\nHeirs: Marie Dupont 50%' });
  check('name stops at line break', data.case?.deceased_name === 'Jean Dupont', data.case?.deceased_name);
  check('typed multi-line docs → verified', data.verification?.verified === true, JSON.stringify(data.verification?.checks?.map((c) => c.detail)));
}

// 7. Execute guards (all rejected before any PayPal call).
{
  const r1 = await post('/api/estate/execute', {});
  check('execute empty → 400', r1.status === 400);
  const r2 = await post('/api/estate/execute', { captureId: 'X' });
  check('execute without runId → 400', r2.status === 400 && /runId/.test(r2.data.error));
  const r3 = await post('/api/estate/execute', { runId: 'test', subscriptionId: 'I-MN83BBV5ENFM', rehearsal: false });
  check('final cancel without confirmFinal → 400', r3.status === 400 && /confirmFinal/.test(r3.data.error));
  const r4 = await post('/api/estate/execute', { runId: 'test', payout: { receiver: 'attacker@example.com', amount: '1.00', refundIds: [] } });
  check('payout to non-heir → 403', r4.status === 403);
  const r5 = await post('/api/estate/execute', { runId: 'test', payout: { receiver: 'sb-rz3k653741808@personal.example.com', amount: '1.00', refundIds: [] } });
  check('payout without recovered refunds → 400', r5.status === 400 && /recovered/.test(r5.data.error), r5.data.error);
  const r6 = await post('/api/estate/execute', { runId: 'test', payout: { receiver: 'sb-rz3k653741808@personal.example.com', amount: '-5', refundIds: [] } });
  check('negative payout → 400', r6.status === 400);
  const r7 = await post('/api/estate/execute', { runId: 'test', handover: { key: 'unknown', merchant: 'X' } });
  check('handover for unknown plan → 400', r7.status === 400);
  const r8 = await post('/api/estate/execute', { runId: 'test', subscriptionId: 'I-97071AR8T6TS', rehearsal: true });
  check('subscription outside the estate → 403', r8.status === 403, r8.data.error);
  const r9 = await post('/api/estate/execute', { runId: 'test', captureId: '3GH37097HC473840V' });
  check('capture outside the estate → 403', r9.status === 403, r9.data.error);
  const r10 = await post('/api/estate/execute', { runId: 'test', captureId: 'X', documents: { certificateText: 'Deceased: Someone Else\nDate of death: 1 January 2026', notaryText: 'Executor: Nobody' } });
  check('mismatched documents → 403', r10.status === 403 && /Legacy Mandate/.test(r10.data.error), r10.data.error);
}

// 8. Polling a known payout batch reads PayPal.
{
  const { status, data } = await post('/api/estate/execute', { pollBatchId: 'A5MJ6WL3GAHSN' });
  check('poll known batch → SUCCESS', status === 200 && data.payoutBatch?.status === 'SUCCESS', JSON.stringify(data));
}

console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
