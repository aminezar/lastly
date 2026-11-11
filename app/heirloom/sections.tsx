'use client';

// Presentational pieces of the executor portal. State lives in portal.tsx; these only
// render it. Order on the page follows the journey: case → plan → act → settle → records.

import Link from 'next/link';
import { useState } from 'react';
import { draftNotice } from './letter';
import { fictional, longDate, merchantName, money, planFor, type Analysis, type AuditEntry, type EstateItem, type LedgerRow, type Money } from './types';

export type Mode = 'rehearsal' | 'final';
export type PayoutState = { step: 'idle' | 'confirm' | 'sending' | 'polling' | 'stalled' | 'done' | 'error'; batchId?: string; status?: string; message?: string; at?: string };
export type Stage = 'verify' | 'review' | 'act' | 'settle' | 'resolved';

// --- Icons (one stroke family) ---------------------------------------------------------
// Marks anything a model produced, so the executor always knows what to double-check.
export function AiBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-pp-blue/30 bg-pp-highlight px-2.5 py-0.5 text-[12px] font-semibold text-pp-navy">
      <span className="rounded-sm bg-pp-blue px-1 text-[10px] font-bold leading-[1.4] tracking-wide text-white">AI</span>
      {label}
    </span>
  );
}

export function Icon({ name, className = 'size-4' }: { name: 'check' | 'x' | 'arrow' | 'lock' | 'download' | 'upload' | 'print' | 'copy'; className?: string }) {
  const paths: Record<typeof name, string> = {
    check: 'M4 10.5l4 4 8-9',
    x: 'M5 5l10 10M15 5L5 15',
    arrow: 'M4 10h12M11 5l5 5-5 5',
    lock: 'M6 9V7a4 4 0 018 0v2M5 9h10v8H5z',
    download: 'M10 3v10M5.5 8.5L10 13l4.5-4.5M4 17h12',
    upload: 'M10 13V3M5.5 7.5L10 3l4.5 4.5M4 17h12',
    print: 'M6 8V3h8v5M6 14H4V8h12v6h-2M6 12h8v5H6z',
    copy: 'M7 7V4h9v9h-3M4 7h9v9H4z',
  };
  return (
    <svg viewBox="0 0 20 20" className={`shrink-0 ${className}`} aria-hidden="true">
      <path d={paths[name]} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Button({ children, variant = 'primary', className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'quiet' | 'onDark' | 'danger' | 'success' }) {
  const styles = {
    primary: 'bg-pp-blue text-white hover:bg-pp-blue-dark disabled:bg-[#c3d3e6] disabled:text-[#3d4f66]',
    danger: 'bg-[var(--hl-final)] text-white hover:bg-[#6d0a1b] disabled:bg-[#e3c2c8] disabled:text-[#5c1220]',
    success: 'bg-[var(--hl-success-bg)] text-[var(--hl-success-ink)] cursor-default',
    quiet: 'border border-pp-border bg-white text-pp-ink hover:border-pp-blue hover:text-pp-blue disabled:text-pp-muted',
    onDark: 'border border-[var(--hl-board-line-strong)] text-white hover:bg-white/10 disabled:opacity-50',
  }[variant];
  return (
    <button {...props} className={`hl-focus inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full px-5 text-[15px] font-semibold transition-colors disabled:cursor-not-allowed ${styles} ${className}`}>
      {children}
    </button>
  );
}

// --- Top bar --------------------------------------------------------------------------
export function TopBar({ mode, hasCase, user, onReset, onSignOut, busy }: { mode: Mode; hasCase: boolean; user: string | null; onReset: () => void; onSignOut: () => void; busy: boolean }) {
  return (
    <div className="border-b border-white/10 bg-[var(--hl-header)] text-white print:hidden">
      <div className="mx-auto flex h-14 w-full max-w-[1320px] items-center gap-4 px-6 lg:px-10">
        <Link href="/" className="hl-serif hl-focus rounded text-[21px] text-white">Heirloom</Link>
        {hasCase && (
          <span className={`ml-2 hidden rounded-full px-3 py-1 text-[12px] font-semibold sm:inline ${mode === 'rehearsal' ? 'bg-white/10 text-[var(--hl-header-muted)]' : 'bg-[var(--hl-final)] text-white'}`}>
            {mode === 'rehearsal' ? 'Rehearsal' : 'Final'}
          </span>
        )}
        <span className="ml-auto hidden text-[12px] text-[var(--hl-header-muted)] lg:block">Sandbox demo · fictional estate</span>
        {user && (
          <div className="ml-auto flex items-center gap-1 lg:ml-4">
            {hasCase && (
              <button type="button" onClick={onReset} disabled={busy} className="hl-focus rounded-full px-3 py-1.5 text-[13px] font-semibold text-[var(--hl-header-text)] hover:bg-white/10 disabled:opacity-40">
                Start over
              </button>
            )}
            <span className="hidden px-2 text-[13px] text-[var(--hl-header-muted)] sm:inline">{user}</span>
            <button type="button" onClick={onSignOut} disabled={busy} className="hl-focus rounded-full px-3 py-1.5 text-[13px] font-semibold text-[var(--hl-header-text)] hover:bg-white/10 disabled:opacity-40">
              Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Case hero ------------------------------------------------------------------------
export function CaseHero({ analysis }: { analysis: Analysis }) {
  const { case: c, verification } = analysis;
  const name = (c.deceased_name ?? 'Unknown person').replace(fictional, '');
  return (
    <section className="bg-[var(--hl-header)] text-white print:hidden">
      <div className="mx-auto flex w-full max-w-[1320px] flex-wrap items-end justify-between gap-x-10 gap-y-6 px-6 py-8 lg:px-10">
        <div>
          <p className="text-[15px] text-[var(--hl-header-muted)]">Estate of</p>
          <h1 className="hl-serif mt-1 text-balance text-[38px] leading-[1.05] sm:text-[46px]">{name}</h1>
          <p className="mt-3 text-[16px] text-[var(--hl-header-text)]">
            {c.date_of_death ? <>Died {longDate(c.date_of_death)}</> : <>Date of death not found</>}
            <span className="mx-2 text-[var(--hl-header-muted)]">·</span>
            {c.executor_name ? <>Executor {c.executor_name}</> : <>Executor not found</>}
          </p>
        </div>
        <VerifyCard verification={verification} source={c.documentsSource} />
      </div>
    </section>
  );
}

function VerifyCard({ verification, source }: { verification: Analysis['verification']; source: Analysis['case']['documentsSource'] }) {
  const ok = verification.verified;
  const passed = verification.checks.filter((c) => c.pass).length;
  // A blocked case opens its details straight away: the executor needs to see why.
  const [open, setOpen] = useState(!ok);
  const sourceLabel = source === 'ai' ? 'Read by AI, checked by rules' : source === 'pasted-text' ? 'Your documents, checked by rules' : 'Demo documents, checked by rules · no AI key set';
  return (
    <div className={`w-full rounded-xl px-5 py-4 sm:w-[420px] ${ok ? 'bg-white/[0.06]' : 'bg-[var(--hl-blocked-bg)]'}`} role={ok ? undefined : 'alert'}>
      <div className="flex items-center gap-3">
        <span className={`grid size-7 shrink-0 place-items-center rounded-full ${ok ? 'bg-[var(--hl-done-on-board)] text-[var(--hl-header)]' : 'bg-[var(--hl-error-on-board)] text-[var(--hl-header)]'}`}>
          <Icon name={ok ? 'check' : 'x'} className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-semibold">{ok ? 'Documents verified' : 'Case blocked: documents do not match'}</p>
          <p className="text-[13px] text-[var(--hl-header-muted)]">{passed} of {verification.checks.length} checks passed</p>
        </div>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="hl-focus rounded-full px-3 py-1.5 text-[13px] font-semibold text-[var(--hl-header-text)] hover:bg-white/10">
          {open ? 'Hide' : 'Details'}
        </button>
      </div>
      {open && (
        <>
          <ul className="mt-4 space-y-3">
            {verification.checks.map((check) => (
              <li key={check.id} className="flex gap-3 text-[14px]">
                <span className={`mt-0.5 ${check.pass ? 'text-[var(--hl-done-on-board)]' : 'text-[var(--hl-error-on-board)]'}`}>
                  <Icon name={check.pass ? 'check' : 'x'} />
                </span>
                <div>
                  <p className="text-white">{check.label}</p>
                  <p className="mt-0.5 text-[13px] text-[var(--hl-header-muted)]">{check.detail}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t border-white/10 pt-3 text-[12px] text-[var(--hl-header-muted)]">
            {sourceLabel}. Legacy Mandate signed {verification.mandate.signed ? longDate(verification.mandate.signed) : '—'} (simulated).
          </p>
        </>
      )}
    </div>
  );
}

// --- Journey --------------------------------------------------------------------------
const STAGES: { id: Stage; label: string }[] = [
  { id: 'verify', label: 'Verify documents' },
  { id: 'review', label: 'Approve the plan' },
  { id: 'act', label: 'Act in PayPal' },
  { id: 'settle', label: 'Pay the heirs' },
  { id: 'resolved', label: 'Report' },
];

export function Journey({ stage, blocked }: { stage: Stage; blocked: boolean }) {
  const current = STAGES.findIndex((s) => s.id === stage);
  return (
    <nav aria-label="Case progress" className="sticky top-0 z-20 border-b border-pp-border bg-white/95 backdrop-blur print:hidden">
      <ol className="mx-auto flex w-full max-w-[1320px] items-center gap-2 overflow-x-auto px-6 py-3 lg:px-10">
        {STAGES.map((s, i) => {
          const done = i < current || (stage === 'resolved' && i === current);
          const active = i === current && !done;
          const failed = blocked && s.id === 'verify';
          return (
            <li key={s.id} className="flex shrink-0 items-center gap-2" aria-current={active ? 'step' : undefined}>
              {i > 0 && <span className="mx-1 h-px w-6 bg-pp-border lg:w-10" aria-hidden="true" />}
              <span
                className={`grid size-6 place-items-center rounded-full text-[12px] font-bold tabular-nums ${
                  failed ? 'bg-pp-danger text-white' : done ? 'bg-pp-success text-white' : active ? 'bg-pp-blue text-white' : 'bg-pp-canvas text-pp-muted ring-1 ring-pp-border'
                }`}
              >
                {failed ? <Icon name="x" className="size-3.5" /> : done ? <Icon name="check" className="size-3.5" /> : i + 1}
              </span>
              <span className={`text-[14px] ${active || failed ? 'font-semibold text-pp-ink' : done ? 'text-pp-ink' : 'text-pp-muted'}`}>{s.label}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// --- Approve panel ----------------------------------------------------------------------
export function ApprovePanel(props: {
  rows: LedgerRow[];
  included: Record<string, boolean>;
  onToggle: (key: string) => void;
  mode: Mode;
  onMode: (m: Mode) => void;
  finalAck: boolean;
  onFinalAck: (v: boolean) => void;
  // Public hosted demo: permanent cancel is refused by the server, so offer only the pause.
  finalLocked?: boolean;
  onCancel: () => void;
  onRun: () => void;
}) {
  const actionable = props.rows.filter((r) => r.progress.step === 'ready' || r.progress.step === 'excluded' || r.progress.step === 'error');
  const chosen = actionable.filter((r) => props.included[r.key]);
  const cancels = chosen.filter((r) => r.subscriptionId && r.triage === 'stop_and_refund').length;
  const stopsAny = actionable.some((r) => r.subscriptionId && r.triage === 'stop_and_refund');
  const final = props.mode === 'final';
  const canRun = chosen.length > 0 && (!final || cancels === 0 || props.finalAck);
  return (
    <div className="border-t border-[var(--hl-board-line)] bg-[var(--hl-board-deep)] px-6 py-6 text-white">
      <h3 id="approve-title" className="text-[18px] font-semibold">Approve these actions</h3>
      <p className="mt-1 text-[14px] text-[var(--hl-board-text)]">Untick anything that should wait.</p>
      <ul className="mt-5 grid gap-2 md:grid-cols-2">
        {actionable.map((r) => (
          <li key={r.key}>
            <label className="hl-focus-within flex cursor-pointer items-start gap-3 rounded-lg bg-white/[0.05] px-4 py-3 hover:bg-white/[0.08]">
              <input type="checkbox" checked={!!props.included[r.key]} onChange={() => props.onToggle(r.key)} className="mt-1 size-4 accent-[var(--pp-sky)]" />
              <span>
                <span className="block text-[15px] font-semibold">{planFor(r, !final)}</span>
                <span className="block text-[13px] text-[var(--hl-board-text)]">{merchantName(r.merchant)}{r.captureId ? ' charge' : ''}</span>
                <span className="mt-1 block text-[13px] leading-snug text-[var(--hl-board-muted)]">{r.reason}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>

      {stopsAny && (
      <fieldset className="mt-6">
        <legend className="text-[14px] font-semibold">How should subscriptions be stopped?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {(['rehearsal', 'final'] as const).map((m) => (
            <label key={m} className={`hl-focus-within rounded-lg border px-4 py-2.5 text-[14px] ${m === 'final' && props.finalLocked ? 'cursor-not-allowed border-[var(--hl-board-line)] text-[var(--hl-board-muted)] opacity-70' : props.mode === m ? 'cursor-pointer border-white bg-white text-pp-navy' : 'cursor-pointer border-[var(--hl-board-line-strong)] text-[var(--hl-board-text)] hover:text-white'}`}>
              <input type="radio" name="mode" value={m} checked={props.mode === m} disabled={m === 'final' && props.finalLocked} onChange={() => props.onMode(m)} className="sr-only" />
              <span className="font-semibold">{m === 'rehearsal' ? 'Pause (rehearsal)' : 'Cancel permanently'}</span>
              <span className="ml-2 opacity-80">{m === 'rehearsal' ? 'can be resumed later' : props.finalLocked ? 'off on the public demo' : 'cannot be undone'}</span>
            </label>
          ))}
        </div>
      </fieldset>
      )}

      {final && stopsAny && (
        <label className="mt-4 flex items-start gap-3 rounded-lg bg-[var(--hl-final)]/30 px-4 py-3 text-[14px]" id="final-warning">
          <input type="checkbox" checked={props.finalAck} onChange={(e) => props.onFinalAck(e.target.checked)} className="mt-0.5 size-4 accent-white" />
          <span>
            I understand that {cancels === 1 ? '1 subscription' : `${cancels} subscriptions`} will be cancelled in PayPal for good. A cancelled subscription cannot be restarted.
          </span>
        </label>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button variant={final ? 'danger' : 'primary'} onClick={props.onRun} disabled={!canRun} aria-describedby={final ? 'final-warning' : undefined}>
          {final ? `Cancel permanently and run ${chosen.length}` : `Approve and run ${chosen.length} ${chosen.length === 1 ? 'action' : 'actions'}`}
          <Icon name="arrow" />
        </Button>
        <Button variant="onDark" onClick={props.onCancel}>Back</Button>
      </div>
    </div>
  );
}

// --- Settlement --------------------------------------------------------------------------
export function Settlement(props: {
  analysis: Analysis;
  recovered: Money;
  unlocked: boolean;
  refundedBefore: boolean;
  payout: PayoutState;
  onStart: () => void;
  onConfirm: () => void;
  onBack: () => void;
  onRecheck: () => void;
}) {
  const { analysis, recovered, payout } = props;
  const value = Number(recovered.value);
  const heirs = analysis.case.heirs;
  const busy = payout.step === 'sending' || payout.step === 'polling';
  return (
    <section aria-labelledby="settle-title" className="mt-10">
      <h2 id="settle-title" className="hl-serif text-[28px] text-pp-navy">Pay the heirs</h2>
      <p className="mt-1 max-w-[70ch] text-[15px] text-pp-muted">
        Money recovered by refunds goes back to the estate first. Heirloom then releases it to the heirs named in the notary act.
      </p>
      <div className="mt-5 overflow-hidden rounded-xl border border-pp-border bg-white">
        <div className="grid gap-px bg-pp-border md:grid-cols-[1fr_1.3fr]">
          <div className="bg-white px-6 py-6">
            <p className="text-[14px] text-pp-muted">Recovered for the estate</p>
            <p className="mt-1 text-[40px] font-semibold tabular-nums leading-none tracking-tight text-pp-ink">{money(recovered)}</p>
            <p className="mt-3 text-[13px] text-pp-muted">From refunds PayPal confirmed as completed.</p>
          </div>
          <div className="bg-white px-6 py-6">
            <p className="text-[14px] text-pp-muted">Heirs (notary act)</p>
            <ul className="mt-2 space-y-1 text-[15px]">
              {heirs.map((h, i) => (
                <li key={h.email} className="flex justify-between gap-4">
                  <span>{h.name ?? `Heir ${i + 1}`}</span>
                  <span className="tabular-nums text-pp-muted">{h.share_pct}%</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[13px] text-pp-muted">
              Demo limit: there is one real Sandbox heir account, so the full amount goes to that account instead of being split.
            </p>
          </div>
        </div>

        <div className="border-t border-pp-border bg-pp-canvas px-6 py-5" aria-live="polite">
          {!props.unlocked && <p className="flex items-center gap-2 text-[14px] text-pp-muted"><Icon name="lock" /> Unlocks when every approved action has finished.</p>}
          {props.unlocked && value === 0 && (
            <p className="text-[15px] text-pp-ink">
              {props.refundedBefore
                ? 'Nothing to pay out: the post-death charge was already refunded before this case was opened, so this run recovered nothing new.'
                : 'Nothing to pay out: no refunds were made in this run.'}
              <span className="mt-1 block text-[13px] text-pp-muted">Demo: run <code className="font-mono">npm run demo:reset</code> for a fresh refundable charge, then open the case again.</span>
            </p>
          )}
          {props.unlocked && value > 0 && payout.step === 'idle' && (
            <Button onClick={props.onStart}>Release {money(recovered)} to the heir <Icon name="arrow" /></Button>
          )}
          {payout.step === 'confirm' && (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-[15px]">
                Send <strong className="tabular-nums">{money(recovered)}</strong> to <strong>{analysis.payoutReceiver.email}</strong>?
              </p>
              <Button onClick={props.onConfirm}>Send payout</Button>
              <Button variant="quiet" onClick={props.onBack}>Not yet</Button>
            </div>
          )}
          {(busy || payout.step === 'done' || payout.step === 'stalled' || (payout.step === 'error' && payout.batchId)) && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[14px]">
              <span className="font-semibold">{busy ? 'PayPal is sending the payout…' : payout.status === 'SUCCESS' ? 'Payout delivered' : 'Payout sent'}</span>
              {payout.batchId && <span className="text-pp-muted">Payout <span className="font-mono text-pp-ink">{payout.batchId}</span></span>}
              {payout.status && <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${payout.status === 'SUCCESS' ? 'bg-[var(--hl-success-bg)] text-[var(--hl-success-ink)]' : 'bg-[#fff4e5] text-[#8a4600]'}`}>{payout.status}</span>}
            </div>
          )}
          {payout.message && <p role={payout.step === 'error' ? 'alert' : undefined} className={`mt-2 text-[14px] ${payout.step === 'error' ? 'text-pp-danger' : 'text-pp-muted'}`}>{payout.message}</p>}
          {payout.step === 'error' && !payout.batchId && <Button variant="quiet" className="mt-3" onClick={props.onStart}>Try again</Button>}
          {payout.step === 'stalled' && <Button variant="quiet" className="mt-3" onClick={props.onRecheck}>Check payout status again</Button>}
        </div>
      </div>
    </section>
  );
}

// --- Resolved ----------------------------------------------------------------------------
export function Resolved({ rows, recovered, paid, onDownload }: { rows: LedgerRow[]; recovered: Money; paid?: string; onDownload: () => void }) {
  const done = rows.filter((r) => r.progress.step === 'done');
  const stoppedRows = done.filter((r) => r.subscriptionId && r.triage === 'stop_and_refund');
  const stopped = stoppedRows.length;
  // What the stopped subscriptions would have charged the estate over the next twelve months.
  const yearly = stoppedRows.reduce((sum, r) => sum + Number(r.amount?.value ?? 0) * 12, 0);
  const yearlyCurrency = stoppedRows.find((r) => r.amount)?.amount?.currency_code ?? recovered.currency_code;
  const handed = done.filter((r) => r.triage === 'keep_for_family').length;
  const notices = done.filter((r) => r.triage === 'formal_notice_only').length;
  // Only what actually happened: a zero or an empty figure is noise on the closing screen.
  const stats = [
    { label: 'Subscriptions stopped', value: String(stopped), show: stopped > 0 },
    { label: 'Future charges stopped, per year', value: money({ value: yearly.toFixed(2), currency_code: yearlyCurrency }), show: yearly > 0 },
    { label: 'Refunded to the estate', value: money(recovered), show: Number(recovered.value) > 0 },
    { label: 'Handed to family', value: String(handed), show: handed > 0 },
    { label: 'Formal notices', value: String(notices), show: notices > 0 },
    { label: 'Paid to the heir', value: paid ? money({ value: paid, currency_code: recovered.currency_code }) : '', show: Boolean(paid) },
  ].filter((s) => s.show);
  return (
    <section id="resolved" aria-labelledby="resolved-title" className="hl-board mt-10 scroll-mt-20 overflow-hidden rounded-2xl text-white shadow-[0_18px_40px_-20px_rgba(0,20,53,0.6)] print:hidden">
      <div className="px-8 pb-8 pt-9">
        <div className="hl-pill flex items-center gap-4">
          <span className="grid size-12 place-items-center rounded-full bg-[var(--hl-done-on-board)] text-[var(--hl-header)]">
            <Icon name="check" className="size-6" />
          </span>
          <h2 id="resolved-title" className="hl-serif text-[38px] sm:text-[46px]">Estate resolved</h2>
        </div>
        <p className="mt-3 text-[16px] text-[var(--hl-board-text)]">Every approved step is confirmed by PayPal.</p>
        <dl className="mt-8 flex flex-wrap gap-x-14 gap-y-6">
          {stats.map((s) => (
            <div key={s.label}>
              <dt className="text-[13px] text-[var(--hl-board-muted)]">{s.label}</dt>
              <dd className="mt-1 text-[26px] font-semibold tabular-nums tracking-tight">{s.value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button onClick={onDownload}><Icon name="download" /> Download audit report</Button>
          <Button variant="onDark" onClick={() => window.print()}><Icon name="print" /> Print for the notary</Button>
        </div>
      </div>
    </section>
  );
}

// --- Records (tabs) -----------------------------------------------------------------------
export function Records({ analysis, rows, audit }: { analysis: Analysis; rows: LedgerRow[]; audit: AuditEntry[] }) {
  const notices = rows.filter((r) => r.triage === 'formal_notice_only');
  const handovers = rows.filter((r) => r.triage === 'keep_for_family');
  const tabs = [
    { id: 'audit', label: `Audit trail (${audit.length})` },
    { id: 'letters', label: `Letters (${notices.length})` },
    { id: 'family', label: `Family handover (${handovers.length})` },
  ] as const;
  const [tab, setTab] = useState<(typeof tabs)[number]['id']>('audit');
  const [copied, setCopied] = useState<string | null>(null);

  function onKey(e: React.KeyboardEvent, i: number) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    setTab(next.id);
    document.getElementById(`tab-${next.id}`)?.focus();
  }

  return (
    <section aria-labelledby="records-title" className="mt-12 print:hidden">
      <h2 id="records-title" className="hl-serif text-[28px] text-pp-navy">Records</h2>
      <div role="tablist" aria-label="Records" className="mt-4 flex gap-6 border-b border-pp-border">
        {tabs.map((t, i) => (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            role="tab"
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => setTab(t.id)}
            onKeyDown={(e) => onKey(e, i)}
            className={`hl-focus -mb-px border-b-2 pb-3 text-[15px] font-semibold ${tab === t.id ? 'border-pp-blue text-pp-ink' : 'border-transparent text-pp-muted hover:text-pp-ink'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="pt-5">
        {tab === 'audit' && <AuditList entries={audit} />}
        {tab === 'letters' &&
          notices.map((item) => {
            const ready = item.progress.step === 'done';
            const letter = item.progress.letter;
            const text = letter?.text ?? draftNotice(item, analysis);
            return (
              <article key={item.key} className="rounded-xl border border-pp-border bg-white">
                <header className="flex flex-wrap items-center gap-3 border-b border-pp-border px-6 py-4">
                  <h3 className="text-[17px] font-semibold">Formal notice to {merchantName(item.merchant)}</h3>
                  {letter?.source === 'ai' && <AiBadge label={`Written by AI · ${letter.model}`} />}
                  <span className="text-[14px] text-pp-muted">
                    {!ready
                      ? item.progress.step === 'running'
                        ? 'The AI is writing this letter from the verified facts…'
                        : 'Preview of the template. When you approve the plan, the AI writes the letter for this merchant from the verified facts.'
                      : letter?.source === 'ai'
                        ? 'Review every line, then send it yourself. Nothing is sent by Heirloom.'
                        : 'AI was unavailable, so this is the fixed template. Review it, then send it yourself.'}
                  </span>
                  {ready && (
                    <Button
                      variant="quiet"
                      className="ml-auto h-9 px-4 text-[14px]"
                      onClick={async () => {
                        await navigator.clipboard.writeText(text);
                        setCopied(item.key);
                      }}
                    >
                      <Icon name={copied === item.key ? 'check' : 'copy'} /> {copied === item.key ? 'Copied' : 'Copy letter'}
                    </Button>
                  )}
                </header>
                <pre className={`whitespace-pre-wrap px-6 py-5 font-[inherit] text-[15px] leading-relaxed ${ready ? 'text-pp-ink' : 'text-pp-muted'}`}>{text}</pre>
              </article>
            );
          })}
        {tab === 'family' &&
          handovers.map((row) => (
            <article key={row.key} className="rounded-xl border border-pp-border bg-white px-6 py-5">
              <h3 className="text-[17px] font-semibold">{merchantName(row.merchant)} for the family</h3>
              {row.progress.approveUrl ? (
                <>
                  <p className="mt-2 max-w-[70ch] text-[15px] text-pp-muted">
                    A new subscription on the same plan is waiting for the surviving family member to approve it in PayPal. The original keeps running until then, so the service never drops. Subscription <span className="font-mono text-pp-ink">{row.progress.resultId}</span>.
                  </p>
                  <a href={row.progress.approveUrl} target="_blank" rel="noreferrer" className="hl-focus mt-4 inline-flex items-center gap-2 font-semibold text-pp-blue underline decoration-pp-blue/40 underline-offset-4 hover:text-pp-blue-dark">
                    Open the family approval link in PayPal <Icon name="arrow" />
                  </a>
                </>
              ) : (
                <p className="mt-2 text-[15px] text-pp-muted">A family approval link is created in PayPal when you approve the plan.</p>
              )}
            </article>
          ))}
      </div>
    </section>
  );
}

function AuditList({ entries }: { entries: AuditEntry[] }) {
  const tone = { ok: 'text-pp-success', pending: 'text-[#8a4600]', error: 'text-pp-danger', info: 'text-pp-muted' } as const;
  return (
    <ol className="divide-y divide-pp-border overflow-hidden rounded-xl border border-pp-border bg-white">
      {entries.map((e, i) => (
        <li key={i} className="grid grid-cols-[88px_minmax(0,1fr)_auto] gap-4 px-6 py-3.5 text-[15px]">
          <time dateTime={e.at} className="tabular-nums text-pp-muted">{new Date(e.at).toLocaleTimeString('en-GB')}</time>
          <div className="min-w-0">
            <p><span className="font-semibold">{e.item}</span> · {e.action}</p>
            {e.paypalId && <p className="mt-0.5 font-mono text-[13px] text-pp-muted">{e.paypalId}</p>}
          </div>
          <div className="text-right">
            <p className={`text-[13px] font-semibold ${tone[e.tone]}`}>{e.status}</p>
            {e.amount && <p className="text-[13px] tabular-nums text-pp-muted">{e.amount}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

// --- Print-only notary report -----------------------------------------------------------
export function PrintReport({ analysis, audit, mode }: { analysis: Analysis; audit: AuditEntry[]; mode: Mode }) {
  const c = analysis.case;
  return (
    <div className="hidden text-black print:block">
      <h1 className="text-2xl font-bold">Heirloom estate resolution: audit report</h1>
      <p className="mt-1 text-sm">PayPal Sandbox demo · fictional estate · executor authority simulated · {mode === 'rehearsal' ? 'rehearsal (subscriptions paused)' : 'final (subscriptions cancelled)'}</p>
      <dl className="mt-4 grid grid-cols-3 gap-4 text-sm">
        <div><dt className="font-semibold">Estate of</dt><dd>{(c.deceased_name ?? '—').replace(fictional, '')}</dd></div>
        <div><dt className="font-semibold">Date of death</dt><dd>{c.date_of_death ? longDate(c.date_of_death) : '—'}</dd></div>
        <div><dt className="font-semibold">Executor</dt><dd>{c.executor_name ?? '—'}</dd></div>
      </dl>
      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-black text-left"><th className="py-1 pr-2">Date and time</th><th className="pr-2">Item</th><th className="pr-2">Action</th><th className="pr-2">PayPal ID</th><th className="pr-2">Status</th><th>Amount</th></tr>
        </thead>
        <tbody>
          {audit.map((e, i) => (
            <tr key={i} className="border-b border-gray-300 align-top">
              <td className="py-1 pr-2">{new Date(e.at).toLocaleString('en-GB')}</td><td className="pr-2">{e.item}</td><td className="pr-2">{e.action}</td><td className="pr-2 font-mono">{e.paypalId ?? ''}</td><td className="pr-2">{e.status}</td><td>{e.amount ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export type { EstateItem };
