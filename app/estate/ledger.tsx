'use client';

// The estate ledger: one AG Grid row per recurring payment on the navy board. Four columns
// tell one story per row: the payment, what Lastly will do and why, what PayPal says,
// and the result. The PayPal cell is a status pill that replays its entrance when
// PayPal answers.

import { useEffect, useMemo, useState } from 'react';
import {
  CellStyleModule,
  ClientSideRowModelModule,
  RowAutoHeightModule,
  RowStyleModule,
  themeQuartz,
  type ColDef,
  type ICellRendererParams,
  type RowClassParams,
} from 'ag-grid-community';
import { AgGridProvider, AgGridReact } from 'ag-grid-react';
import { TRIAGE_LABEL, merchantName, money, planFor, type LedgerRow } from './types';

// --- AI plan review ---------------------------------------------------------------------
// Once per case, the model reads each payment's PayPal facts and the rule's decision and
// writes why that action fits (lib/estate-review.ts). It never changes a decision. Until it
// answers, or if it can't, each row shows the rule's own reason, labelled as such.
type AiNote = { explanation: string; agrees: boolean; concern?: string };
type Review = { state: 'loading' } | { state: 'ready'; model: string; notes: Record<string, AiNote> } | { state: 'unavailable' };
type ReviewedRow = LedgerRow & { ai?: Review };

const reviews = new Map<string, Promise<Review>>();

function reviewPayload(rows: LedgerRow[]) {
  return JSON.stringify(
    rows.map((r) => ({
      key: r.key,
      merchant: merchantName(r.merchant),
      kind: r.captureId ? 'one-off charge' : 'subscription',
      plannedAction: r.noAction ? 'Nothing to do' : r.captureStatus === 'REFUNDED' || r.captureStatus === 'PARTIALLY_REFUNDED' ? 'Nothing to do: PayPal shows it already refunded' : TRIAGE_LABEL[r.triage],
      ruleReason: r.reason,
      paypalStatus: r.captureId ? r.captureStatus : r.status,
      amount: r.amount ? `${r.amount.value} ${r.amount.currency_code}${r.captureId ? '' : ' per month'}` : undefined,
      chargedAt: r.chargedAt?.slice(0, 10),
      nextBillingAt: r.nextBillingAt?.slice(0, 10),
      noAction: r.noAction || undefined,
    })),
  );
}

function fetchReview(payload: string): Promise<Review> {
  let promise = reviews.get(payload);
  if (!promise) {
    promise = fetch('/api/estate/review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: `{"items":${payload}}` })
      .then((res) => res.json())
      .then((data: { ok?: boolean; model?: string; notes?: ({ key: string } & AiNote)[] }) =>
        data.ok && data.notes?.length
          ? { state: 'ready' as const, model: data.model ?? 'AI', notes: Object.fromEntries(data.notes.map(({ key, ...n }) => [key, n])) }
          : { state: 'unavailable' as const },
      )
      .catch(() => ({ state: 'unavailable' as const }));
    reviews.set(payload, promise);
  }
  return promise;
}

// The payload holds only the facts as the case was opened (row progress is separate), so
// rows changing state while PayPal works reuse the same review instead of calling again.
function useReview(rows: LedgerRow[]): ReviewedRow[] {
  const payload = useMemo(() => (rows.length > 0 ? reviewPayload(rows) : ''), [rows]);
  const [done, setDone] = useState<{ payload: string; value: Review } | null>(null);
  useEffect(() => {
    if (!payload) return;
    let live = true;
    fetchReview(payload).then((value) => live && setDone({ payload, value }));
    return () => {
      live = false;
    };
  }, [payload]);
  return useMemo(() => {
    const ai: Review = done?.payload === payload ? done.value : { state: 'loading' };
    return rows.map((r) => ({ ...r, ai }));
  }, [rows, done, payload]);
}

function Why({ row }: { row: ReviewedRow }) {
  const ai = row.ai;
  const note = ai?.state === 'ready' ? ai.notes[row.key] : undefined;
  return (
    <div className="mt-1.5 max-w-[46em] text-[13.5px] leading-snug text-[var(--hl-board-text)]">
      {note ? (
        <>
          <span className="mr-2 inline-flex translate-y-[-1px] items-center rounded-[5px] bg-[var(--pp-sky)]/20 px-1.5 py-px text-[12px] font-semibold text-[#9fdcff]" title={`Written by ${ai?.state === 'ready' ? ai.model : 'AI'} from the PayPal facts. The rules decide; the AI explains.`}>
            AI explains
          </span>
          <span className="hl-fade">{note.explanation}</span>
          {!note.agrees && note.concern && (
            <span className="mt-1.5 flex items-start gap-1.5 font-semibold text-[var(--hl-warn-on-board)]">
              <span aria-hidden="true">⚑</span> Check before approving: {note.concern}
            </span>
          )}
        </>
      ) : (
        <>
          <span className="mr-2 inline-flex translate-y-[-1px] items-center rounded-[5px] bg-white/10 px-1.5 py-px text-[12px] font-semibold text-[var(--hl-board-muted)]">
            {ai?.state === 'loading' ? 'AI reading…' : 'Rule'}
          </span>
          <span className={ai?.state === 'loading' ? 'opacity-70' : ''}>{row.reason}</span>
        </>
      )}
    </div>
  );
}

const modules = [ClientSideRowModelModule, RowAutoHeightModule, RowStyleModule, CellStyleModule];

const theme = themeQuartz.withParams({
  fontFamily: 'var(--pp-font)',
  fontSize: 15,
  backgroundColor: 'var(--hl-board)',
  foregroundColor: '#ffffff',
  textColor: '#ffffff',
  headerBackgroundColor: 'var(--hl-board)',
  headerTextColor: 'var(--hl-board-muted)',
  headerFontSize: 13,
  headerFontWeight: 600,
  borderColor: 'var(--hl-board-line)',
  rowBorder: { color: 'var(--hl-board-line)' },
  wrapperBorder: false,
  wrapperBorderRadius: 0,
  rowHoverColor: 'transparent',
  accentColor: 'var(--pp-sky)',
  cellHorizontalPadding: 24,
  headerHeight: 48,
});

// The PayPal column shows only states PayPal itself reports.
export function paypalStatus(row: LedgerRow): string {
  if (row.progress.paypalStatus) return row.progress.paypalStatus;
  if (row.captureId) return row.captureStatus === 'COMPLETED' ? 'CHARGED' : (row.captureStatus ?? 'UNKNOWN');
  return row.status;
}

// PayPal's status codes in readable words, with one colour per meaning.
const STATUS: Record<string, { label: string; tone: 'neutral' | 'good' | 'warn' | 'off' | 'bad' | 'live' }> = {
  ACTIVE: { label: 'Active', tone: 'neutral' },
  SUSPENDED: { label: 'Paused', tone: 'warn' },
  CANCELLED: { label: 'Cancelled', tone: 'off' },
  EXPIRED: { label: 'Expired', tone: 'off' },
  CHARGED: { label: 'Charged', tone: 'warn' },
  REFUNDED: { label: 'Refunded', tone: 'good' },
  PARTIALLY_REFUNDED: { label: 'Partly refunded', tone: 'warn' },
  APPROVAL_PENDING: { label: 'Waiting for approval', tone: 'live' },
  SENDING: { label: 'Sending…', tone: 'live' },
  'NOT CHANGED': { label: 'Not changed', tone: 'warn' },
};

const PILL: Record<(typeof STATUS)[string]['tone'], string> = {
  neutral: 'bg-white/10 text-white',
  good: 'bg-[var(--hl-done-on-board)]/20 text-[var(--hl-done-on-board)]',
  warn: 'bg-[var(--hl-warn-on-board)]/15 text-[var(--hl-warn-on-board)]',
  off: 'bg-white/5 text-[var(--hl-board-muted)]',
  bad: 'bg-[var(--hl-error-on-board)]/15 text-[var(--hl-error-on-board)]',
  live: 'bg-[var(--pp-sky)]/20 text-[#9fdcff]',
};

export function StatusPill({ code }: { code: string }) {
  const s = STATUS[code] ?? { label: code.charAt(0) + code.slice(1).toLowerCase().replace(/_/g, ' '), tone: 'neutral' as const };
  return (
    // Keyed by the code so a change replays the entrance: the moment PayPal answers.
    <span key={code} className={`hl-pill inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[14px] font-semibold ${PILL[s.tone]}`}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {s.label}
    </span>
  );
}

function PaymentCell({ data }: ICellRendererParams<LedgerRow>) {
  if (!data) return null;
  const detail = data.captureId ? `One charge · ${money(data.amount)}` : data.amount ? `${money(data.amount)} / month` : 'Subscription';
  return (
    <div className="py-4 leading-tight">
      <div className="text-[17px] font-semibold">{merchantName(data.merchant)}</div>
      <div className="mt-1 text-[14px] text-[var(--hl-board-text)]">{detail}</div>
    </div>
  );
}

const DOT: Record<LedgerRow['triage'], string> = {
  stop_and_refund: 'bg-[var(--hl-stop-dot)]',
  keep_for_family: 'bg-[var(--hl-keep-dot)]',
  formal_notice_only: 'bg-[var(--hl-notice-dot)]',
};

const nothingToDo = (row: LedgerRow) => row.progress.step === 'skipped' && !row.progress.at;

function PlanCell({ data }: ICellRendererParams<ReviewedRow>) {
  if (!data) return null;
  const idle = nothingToDo(data);
  return (
    <div className="py-4">
      <div className="flex items-center gap-3">
        <span className={`size-2.5 shrink-0 rounded-full ${idle ? 'bg-white/20' : DOT[data.triage]}`} title={TRIAGE_LABEL[data.triage]} aria-hidden="true" />
        <span className={`text-[16px] font-semibold ${idle ? 'text-[var(--hl-board-muted)]' : ''}`}>{idle ? 'Nothing to do' : planFor(data, data.rehearsal)}</span>
        <span className="sr-only">({TRIAGE_LABEL[data.triage]})</span>
      </div>
      <div className="pl-[22px]">
        <Why row={data} />
      </div>
    </div>
  );
}

function PayPalCell({ data }: ICellRendererParams<LedgerRow>) {
  if (!data) return null;
  const id = data.progress.resultId ?? data.subscriptionId ?? data.captureId;
  return (
    <div className="flex flex-col items-start gap-1.5 py-4">
      <StatusPill code={paypalStatus(data)} />
      {id && <span className="font-mono text-[12px] tracking-wide text-[var(--hl-board-muted)]">{id}</span>}
    </div>
  );
}

function ResultCell({ data }: ICellRendererParams<LedgerRow>) {
  if (!data) return null;
  const { step, message, at } = data.progress;
  if (step === 'ready') return <span className="text-[var(--hl-board-muted)]" aria-label="Not started">—</span>;
  const color =
    step === 'error' ? 'text-[var(--hl-warn-on-board)]'
    : step === 'done' ? 'text-[var(--hl-done-on-board)]'
    : step === 'running' ? 'text-white'
    : 'text-[var(--hl-board-muted)]';
  const text = message ?? (step === 'excluded' ? 'Left for later' : step === 'running' ? 'Sending to PayPal…' : '');
  return (
    <div className={`py-4 text-[14px] leading-snug ${color}`}>
      <div key={step} className={step === 'done' || step === 'error' ? 'hl-pill font-semibold' : ''}>{text}</div>
      {at && <div className="mt-0.5 tabular-nums text-[var(--hl-board-muted)]">{new Date(at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>}
    </div>
  );
}

// rowClassRules (unlike getRowClass) are re-evaluated whenever a row's data changes.
const rowClassRules = {
  'hl-row-running': ({ data }: RowClassParams<LedgerRow>) => data?.progress.step === 'running',
  'hl-row-excluded': ({ data }: RowClassParams<LedgerRow>) => data?.progress.step === 'excluded',
  // Added once when PayPal confirms the action, so its flash plays exactly at that moment.
  'hl-row-done': ({ data }: RowClassParams<LedgerRow>) => data?.progress.step === 'done' && Boolean(data.progress.at),
};

export function Ledger({ rows }: { rows: LedgerRow[] }) {
  const reviewed = useReview(rows);
  const columns = useMemo<ColDef<ReviewedRow>[]>(
    () => [
      { headerName: 'Payment', field: 'merchant', cellRenderer: PaymentCell, width: 220, autoHeight: true },
      // The value includes the AI state so the cell re-renders when the review arrives.
      { headerName: 'Plan and why', colId: 'plan', valueGetter: ({ data }) => (data ? `${data.triage}:${data.ai?.state ?? ''}` : ''), cellRenderer: PlanCell, flex: 1, minWidth: 340, autoHeight: true },
      { headerName: 'PayPal', colId: 'paypal', valueGetter: ({ data }) => (data ? paypalStatus(data) : ''), cellRenderer: PayPalCell, width: 240, autoHeight: true },
      { headerName: 'What happened', colId: 'result', valueGetter: ({ data }) => data?.progress.message, cellRenderer: ResultCell, width: 240, autoHeight: true },
    ],
    [],
  );

  return (
    <AgGridProvider modules={modules}>
      <AgGridReact<ReviewedRow>
        theme={theme}
        rowData={reviewed}
        columnDefs={columns}
        getRowId={({ data }) => data.key}
        rowClassRules={rowClassRules}
        domLayout="autoHeight"
        suppressCellFocus
        enableCellTextSelection
        defaultColDef={{ sortable: false, resizable: false, suppressMovable: true, cellStyle: { display: 'flex', alignItems: 'center', lineHeight: 'normal', whiteSpace: 'normal' } }}
      />
    </AgGridProvider>
  );
}

// Below the md breakpoint the four columns stack into one card per payment, so nothing
// scrolls sideways on a phone. Same data, same pills, same order.
export function LedgerCards({ rows }: { rows: LedgerRow[] }) {
  const reviewed = useReview(rows);
  return (
    <ol className="divide-y divide-[var(--hl-board-line)]">
      {reviewed.map((r) => {
        const idle = nothingToDo(r);
        return (
          <li key={r.key} className={`px-5 py-5 ${r.progress.step === 'running' ? 'bg-[#0b2a80]' : ''} ${r.progress.step === 'excluded' ? 'opacity-45' : ''}`}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[17px] font-semibold">{merchantName(r.merchant)}{r.captureId ? ' charge' : ''}</span>
              <span className="text-[14px] tabular-nums text-[var(--hl-board-text)]">{money(r.amount)}{r.captureId ? '' : '/mo'}</span>
            </div>
            <p className={`mt-2 flex items-center gap-2 text-[16px] font-semibold ${idle ? 'text-[var(--hl-board-muted)]' : ''}`}>
              <span className={`size-2.5 rounded-full ${idle ? 'bg-white/20' : DOT[r.triage]}`} aria-hidden="true" />
              {idle ? 'Nothing to do' : planFor(r, r.rehearsal)}
            </p>
            <Why row={r} />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <StatusPill code={paypalStatus(r)} />
              {r.progress.message && <span className="text-[13px] text-[var(--hl-board-text)]">{r.progress.message}</span>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
