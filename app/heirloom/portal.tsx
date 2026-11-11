'use client';

// Heirloom executor portal. One page, five stages: verify documents → approve the plan →
// act in PayPal → pay the heirs → report. Every PayPal ID on screen comes from a real
// Sandbox response via /api/estate/*; nothing here invents one.

import { useCallback, useMemo, useRef, useState } from 'react';
import { Intake, SignIn, type DocSlot } from './intake';
import { Ledger, LedgerCards } from './ledger';
import {
  ApprovePanel,
  Button,
  CaseHero,
  Icon,
  Journey,
  PrintReport,
  Records,
  Resolved,
  Settlement,
  TopBar,
  type Mode,
  type PayoutState,
  type Stage,
} from './sections';
import { merchantName, money, type MandateInfo, type Analysis, type AuditEntry, type EstateItem, type LedgerRow, type Money, type RowProgress } from './types';

async function call<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({ ok: false, error: `The server answered ${res.status}` }))) as T & { ok?: boolean; error?: string };
  if (!res.ok || data.ok === false) throw new Error(data.error ?? `The server answered ${res.status}`);
  return data;
}

const now = () => new Date().toISOString();
const newRunId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

function friendlyError(message: string): string {
  if (/PAYPAL_CLIENT_ID|PAYPAL_SECRET/.test(message)) return 'PayPal is not connected yet: the Sandbox keys are missing on the server (.env.local).';
  if (/401|invalid_client/i.test(message)) return 'PayPal rejected the Sandbox keys on the server.';
  if (/Failed to fetch|NetworkError/i.test(message)) return 'Could not reach the Heirloom server. Check that it is running, then try again.';
  const issue = message.match(/"issue":"([^"]+)"/)?.[1] ?? message.match(/"message":"([^"]+)"/)?.[1];
  return issue ? `PayPal said: ${issue}` : message;
}

// Rows PayPal already finished, or the rules found nothing to do for, start as skipped.
function initialProgress(item: EstateItem): RowProgress {
  if (item.noAction) return { step: 'skipped', message: 'Charged before death' };
  if (item.captureId) {
    if (item.captureStatus === 'REFUNDED' || item.captureStatus === 'PARTIALLY_REFUNDED') return { step: 'skipped', message: 'Already refunded' };
    if (item.captureStatus !== 'COMPLETED') return { step: 'skipped', message: 'Charge not found in PayPal' };
    return { step: 'ready' };
  }
  if (!item.subscriptionId) return { step: 'skipped', message: 'Not found in PayPal' };
  if (item.triage === 'stop_and_refund' && item.status === 'CANCELLED') return { step: 'skipped', message: 'Already cancelled' };
  if (item.triage === 'stop_and_refund' && item.status === 'SUSPENDED') return { step: 'skipped', message: 'Already paused' };
  return { step: 'ready' };
}

export function Portal({ mandate, demo }: { mandate: MandateInfo; demo: { certificateText: string; notaryText: string } }) {
  const [signedIn, setSignedIn] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);
  const [certificate, setCertificate] = useState<DocSlot>(null);
  const [notary, setNotary] = useState<DocSlot>(null);
  const [progress, setProgress] = useState<Record<string, RowProgress>>({});
  const [included, setIncluded] = useState<Record<string, boolean>>({});
  const [mode, setMode] = useState<Mode>('rehearsal');
  const [finalAck, setFinalAck] = useState(false);
  const [approving, setApproving] = useState(false);
  const [running, setRunning] = useState<{ index: number; total: number; label: string } | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [payout, setPayout] = useState<PayoutState>({ step: 'idle' });
  const runId = useRef('');
  const progressRef = useRef<Record<string, RowProgress>>({});

  const log = useCallback((entry: Omit<AuditEntry, 'at'> & { at?: string }) => {
    setAudit((list) => [...list, { ...entry, at: entry.at ?? now() }]);
  }, []);

  const setRow = (key: string, patch: RowProgress) => {
    progressRef.current = { ...progressRef.current, [key]: patch };
    setProgress(progressRef.current);
  };

  async function openCase() {
    setOpening(true);
    setOpenError(null);
    try {
      if (!certificate || !notary) return;
      const body = { certificateText: certificate.text, notaryText: notary.text };
      const data = await call<Analysis>('/api/estate/analyze', body);
      runId.current = newRunId();
      const initial = Object.fromEntries(data.items.map((i) => [i.key, initialProgress(i)]));
      progressRef.current = initial;
      setProgress(initial);
      setIncluded(Object.fromEntries(data.items.map((i) => [i.key, initial[i.key].step === 'ready'])));
      setAnalysis(data);
      setMode('rehearsal');
      setFinalAck(false);
      setApproving(false);
      setPayout({ step: 'idle' });
      const name = data.case.deceased_name ?? 'unknown person';
      setAudit([
        { at: data.generatedAt, item: 'Case', action: `Case opened for the estate of ${name}`, status: 'OPENED', tone: 'info' },
        ...data.verification.checks.map((c) => ({ at: data.generatedAt, item: 'Documents', action: c.label, status: c.pass ? 'MATCH' : 'MISMATCH', tone: (c.pass ? 'ok' : 'error') as AuditEntry['tone'] })),
        { at: data.generatedAt, item: 'PayPal', action: `Read ${data.items.length} recurring payments`, status: 'READ', tone: 'info' },
      ]);
    } catch (e) {
      setOpenError(friendlyError(e instanceof Error ? e.message : String(e)));
    } finally {
      setOpening(false);
    }
  }

  const rows: LedgerRow[] = useMemo(
    () =>
      (analysis?.items ?? []).map((item) => {
        const p = progress[item.key] ?? { step: 'ready' };
        const excluded = p.step === 'ready' && included[item.key] === false;
        return { ...item, rehearsal: mode === 'rehearsal', progress: excluded ? { ...p, step: 'excluded' } : p };
      }),
    [analysis, progress, included, mode],
  );

  async function runRow(item: EstateItem) {
    const rehearsal = mode === 'rehearsal';
    const name = merchantName(item.merchant);
    setRow(item.key, { step: 'running', paypalStatus: 'SENDING' });
    try {
      if (item.triage === 'formal_notice_only') {
        // No PayPal call: the contract means the payment must keep running until the merchant answers.
        setRow(item.key, { step: 'done', paypalStatus: item.status, message: 'Notice drafted', at: now() });
        log({ item: name, action: 'Formal notice drafted; payment left running because the membership is contract-bound', status: 'DRAFTED', tone: 'ok' });
        return;
      }
      if (item.triage === 'keep_for_family') {
        const r = await call<{ at: string; handover: { subscriptionId: string; status: string; approveUrl?: string } }>('/api/estate/execute', {
          runId: runId.current,
          handover: { key: item.key, merchant: name },
        });
        setRow(item.key, { step: 'done', paypalStatus: r.handover.status, resultId: r.handover.subscriptionId, resultKind: 'Handover', approveUrl: r.handover.approveUrl, message: 'Family link ready', at: r.at });
        log({ at: r.at, item: name, action: 'New subscription on the same plan created for the family to approve; original keeps running until then', paypalId: r.handover.subscriptionId, status: r.handover.status, tone: 'pending' });
        return;
      }
      if (item.captureId) {
        const r = await call<{ at: string; refund: { id: string; status: string; amount?: Money } }>('/api/estate/execute', { runId: runId.current, captureId: item.captureId });
        const ok = r.refund.status === 'COMPLETED';
        setRow(item.key, { step: 'done', paypalStatus: ok ? 'REFUNDED' : r.refund.status, resultId: r.refund.id, resultKind: 'Refund', refundId: r.refund.id, refunded: ok ? r.refund.amount : undefined, message: ok ? `${money(r.refund.amount)} returned` : `Refund ${r.refund.status.toLowerCase()}`, at: r.at });
        log({ at: r.at, item: `${name} charge`, action: `Post-death charge refunded to its original payment source (charge ${item.captureId})`, paypalId: r.refund.id, status: r.refund.status, tone: ok ? 'ok' : 'pending', amount: r.refund.amount ? `${r.refund.amount.value} ${r.refund.amount.currency_code}` : undefined });
        return;
      }
      if (item.subscriptionId) {
        const r = await call<{ at: string; subscription: { id: string; status: string } }>('/api/estate/execute', {
          runId: runId.current,
          subscriptionId: item.subscriptionId,
          rehearsal,
          confirmFinal: !rehearsal && finalAck,
        });
        setRow(item.key, { step: 'done', paypalStatus: r.subscription.status, message: rehearsal ? 'Paused' : 'Cancelled', at: r.at });
        log({ at: r.at, item: name, action: rehearsal ? 'Subscription paused (rehearsal, reversible)' : 'Subscription cancelled (final)', paypalId: r.subscription.id, status: r.subscription.status, tone: 'ok' });
      }
    } catch (e) {
      const message = friendlyError(e instanceof Error ? e.message : String(e));
      setRow(item.key, { step: 'error', paypalStatus: 'NOT CHANGED', message });
      log({ item: name, action: `Action failed: ${message}`, status: 'ERROR', tone: 'error' });
    }
  }

  async function runApproved() {
    if (!analysis) return;
    setApproving(false);
    // Bring the board into view so every row flip is seen as PayPal answers.
    document.getElementById('plan')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const queue = analysis.items.filter((i) => included[i.key] && ['ready', 'error'].includes(progressRef.current[i.key]?.step ?? ''));
    for (const [index, item] of queue.entries()) {
      setRunning({ index: index + 1, total: queue.length, label: merchantName(item.merchant) });
      await runRow(item);
    }
    setRunning(null);
  }

  const recovered: Money = useMemo(() => {
    const refunds = rows.map((r) => r.progress.refunded).filter((m): m is Money => Boolean(m));
    const total = refunds.reduce((sum, m) => sum + Number(m.value), 0);
    return { value: total.toFixed(2), currency_code: refunds[0]?.currency_code ?? analysis?.balance?.currency ?? 'EUR' };
  }, [rows, analysis]);
  const refundIds = rows.map((r) => r.progress.refundId).filter((id): id is string => Boolean(id));

  const blocked = analysis ? !analysis.verification.verified : false;
  const anyRan = rows.some((r) => ['done', 'error'].includes(r.progress.step) && r.progress.at !== undefined) || rows.some((r) => r.progress.step === 'error');
  const pending = rows.filter((r) => (r.progress.step === 'ready' || r.progress.step === 'error') && included[r.key]);
  const settled = rows.length > 0 && !running && pending.length === 0 && anyRan;
  const nothingToPay = Number(recovered.value) === 0;

  const stage: Stage = !analysis || blocked
    ? 'verify'
    : running
      ? 'act'
      : !settled
        ? anyRan ? 'act' : 'review'
        : payout.step === 'done' || nothingToPay
          ? 'resolved'
          : 'settle';

  async function sendPayout() {
    if (!analysis) return;
    setPayout({ step: 'sending' });
    try {
      const r = await call<{ at: string; payout: { batchId: string; status: string; amount: string } }>('/api/estate/execute', {
        runId: runId.current,
        payout: { receiver: analysis.payoutReceiver.email, amount: recovered.value, currency: recovered.currency_code, refundIds },
      });
      log({ at: r.at, item: 'Heirs', action: `Payout to ${analysis.payoutReceiver.email}`, paypalId: r.payout.batchId, status: r.payout.status, tone: 'pending', amount: `${r.payout.amount} ${recovered.currency_code}` });
      setPayout({ step: 'polling', batchId: r.payout.batchId, status: r.payout.status });
      await pollPayout(r.payout.batchId);
    } catch (e) {
      const message = friendlyError(e instanceof Error ? e.message : String(e));
      setPayout({ step: 'error', message });
      log({ item: 'Heirs', action: `Payout failed: ${message}`, status: 'ERROR', tone: 'error' });
    }
  }

  // Payouts settle asynchronously (Sandbox often takes 20–60 s): poll until PayPal reports
  // a final state. If it takes longer, say so and let the executor check again; the
  // payout is never shown as delivered before PayPal says SUCCESS.
  async function pollPayout(batchId: string) {
    setPayout((s) => ({ ...s, step: 'polling', message: undefined }));
    for (let i = 0; i < 45; i++) {
      await new Promise((ok) => setTimeout(ok, 2000));
      const p = await call<{ at: string; payoutBatch: { status: string } }>('/api/estate/execute', { pollBatchId: batchId });
      setPayout((s) => ({ ...s, step: 'polling', batchId, status: p.payoutBatch.status }));
      if (['SUCCESS', 'DENIED', 'CANCELED'].includes(p.payoutBatch.status)) {
        const ok = p.payoutBatch.status === 'SUCCESS';
        log({ at: p.at, item: 'Heirs', action: ok ? 'Payout delivered' : 'Payout not delivered', paypalId: batchId, status: p.payoutBatch.status, tone: ok ? 'ok' : 'error' });
        setPayout({ step: ok ? 'done' : 'error', batchId, status: p.payoutBatch.status, at: p.at, message: ok ? undefined : `PayPal reported ${p.payoutBatch.status}.` });
        if (ok) window.setTimeout(() => document.getElementById('resolved')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
        return;
      }
    }
    setPayout((s) => ({ ...s, step: 'stalled', message: 'PayPal is still processing this payout. Nothing is lost; check again in a minute.' }));
  }

  function downloadReport() {
    if (!analysis) return;
    const report = {
      title: 'Heirloom estate resolution: audit report',
      environment: 'PayPal Sandbox demo, fictional estate, executor authority simulated',
      mode: mode === 'rehearsal' ? 'rehearsal (subscriptions paused, reversible)' : 'final (subscriptions cancelled)',
      case: analysis.case,
      verification: analysis.verification,
      generatedAt: now(),
      actions: audit.map((entry) => ({ at: entry.at, item: entry.item, action: entry.action, paypalId: entry.paypalId, status: entry.status, amount: entry.amount })),
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
    Object.assign(document.createElement('a'), { href: url, download: `heirloom-audit-${analysis.case.date_of_death ?? 'case'}.json` }).click();
    URL.revokeObjectURL(url);
  }

  const actionableCount = rows.filter((r) => ['ready', 'excluded', 'error'].includes(r.progress.step)).length;

  return (
    <div className="hl flex min-h-full flex-1 flex-col bg-pp-canvas text-pp-ink">
      <TopBar
        mode={mode}
        hasCase={Boolean(analysis)}
        user={signedIn ? mandate.executor_name : null}
        busy={Boolean(running) || payout.step === 'sending' || payout.step === 'polling'}
        onReset={() => {
          // Back to the documents. PayPal changes already made stay made and stay in PayPal.
          setAnalysis(null);
          setAudit([]);
          setPayout({ step: 'idle' });
          setApproving(false);
          window.scrollTo({ top: 0 });
        }}
        onSignOut={() => {
          setSignedIn(false);
          setAnalysis(null);
          setAudit([]);
          setPayout({ step: 'idle' });
          setApproving(false);
          setCertificate(null);
          setNotary(null);
          setOpenError(null);
          window.scrollTo({ top: 0 });
        }}
      />
      {analysis ? <CaseHero analysis={analysis} /> : null}
      {signedIn && <Journey stage={stage} blocked={blocked} />}

      <main className="mx-auto w-full max-w-[1320px] flex-1 px-6 pb-24 print:hidden lg:px-10">
        {!signedIn ? (
          <SignIn mandate={mandate} onSignIn={() => setSignedIn(true)} />
        ) : !analysis ? (
          <Intake
            mandate={mandate}
            demo={demo}
            certificate={certificate}
            notary={notary}
            onCertificate={(s) => {
              setCertificate(s);
              setOpenError(null);
            }}
            onNotary={(s) => {
              setNotary(s);
              setOpenError(null);
            }}
            opening={opening}
            error={openError}
            onOpen={openCase}
          />
        ) : (
          <>
            <section id="plan" aria-labelledby="plan-title" className="hl-board mt-10 scroll-mt-20 overflow-hidden rounded-2xl text-white shadow-[0_18px_40px_-20px_rgba(0,20,53,0.6)]">
              <div className="flex flex-col gap-4 px-6 pb-5 pt-6 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-8">
                <div className="min-w-0 flex-1">
                  <h2 id="plan-title" className="text-[22px] font-semibold tracking-tight">What happens to each payment</h2>
                  <p className="mt-1 text-[15px] text-[var(--hl-board-text)]" aria-live="polite">
                    {running
                      ? `Working in PayPal · ${running.index} of ${running.total} · ${running.label}`
                      : blocked
                        ? 'Blocked until the documents match.'
                        : settled
                          ? 'Done. PayPal confirmed every action.'
                          : actionableCount === 0
                            ? 'Nothing left to do.'
                            : `${actionableCount} ${actionableCount === 1 ? 'action' : 'actions'} to approve`}
                  </p>
                </div>
                {!approving && !running && !settled && actionableCount > 0 && (
                  <Button onClick={() => setApproving(true)} disabled={blocked} className="w-full sm:w-auto sm:min-w-[200px]">
                    {anyRan ? 'Review what is left' : 'Review and approve'} <Icon name="arrow" />
                  </Button>
                )}
              </div>
              {running && (
                <div className="h-1 bg-white/10" aria-hidden="true">
                  <div className="h-full bg-[var(--pp-sky)] transition-[width] duration-500 ease-out" style={{ width: `${((running.index - 0.5) / running.total) * 100}%` }} />
                </div>
              )}
              <div className="hl-grid hidden border-t border-[var(--hl-board-line)] md:block">
                <Ledger rows={rows} />
              </div>
              <div className="border-t border-[var(--hl-board-line)] md:hidden">
                <LedgerCards rows={rows} />
              </div>
              {approving && (
                <ApprovePanel
                  rows={rows}
                  included={included}
                  onToggle={(key) => setIncluded((s) => ({ ...s, [key]: !s[key] }))}
                  mode={mode}
                  onMode={(m) => {
                    setMode(m);
                    setFinalAck(false);
                  }}
                  finalAck={finalAck}
                  onFinalAck={setFinalAck}
                  onCancel={() => setApproving(false)}
                  onRun={runApproved}
                />
              )}
            </section>

            {stage === 'resolved' && <Resolved rows={rows} recovered={recovered} paid={payout.step === 'done' ? recovered.value : undefined} onDownload={downloadReport} />}

            {(stage === 'settle' || stage === 'resolved') && (
            <Settlement
              analysis={analysis}
              recovered={recovered}
              unlocked={settled}
              refundedBefore={rows.some((r) => r.captureId && r.progress.step === 'skipped' && /refunded/i.test(r.progress.message ?? ''))}
              payout={payout}
              onStart={() => setPayout({ step: 'confirm' })}
              onConfirm={sendPayout}
              onBack={() => setPayout({ step: 'idle' })}
              onRecheck={() => payout.batchId && pollPayout(payout.batchId)}
            />
            )}

            {anyRan && <Records analysis={analysis} rows={rows} audit={audit} />}
          </>
        )}
      </main>

      {analysis && <PrintReport analysis={analysis} audit={audit} mode={mode} />}
    </div>
  );
}
