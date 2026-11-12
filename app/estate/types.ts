// Shapes returned by /api/estate/analyze and /api/estate/execute, plus the portal's own
// per-row progress. Kept in one place so every part of the portal agrees.

export type Money = { value: string; currency_code: string };
export type Triage = 'stop_and_refund' | 'keep_for_family' | 'formal_notice_only';

export type EstateItem = {
  key: string;
  merchant: string;
  subscriptionId?: string;
  captureId?: string;
  captureStatus?: string;
  chargedAt?: string;
  nextBillingAt?: string;
  status: string;
  amount?: Money;
  triage: Triage;
  confidence: 'high' | 'medium';
  reason: string;
  noAction: boolean;
  note: string;
};

export type TrustCheck = { id: 'death-date' | 'deceased' | 'executor' | 'ai-reading'; label: string; pass: boolean; detail: string; model?: string; skipped?: boolean };

export type Analysis = {
  ok: true;
  case: {
    deceased_name: string | null;
    date_of_death: string | null;
    executor_name: string | null;
    heirs: { name?: string; label?: string; email: string; share_pct: number }[];
    documentsSource: 'ai' | 'demo-documents' | 'pasted-text';
  };
  verification: { verified: boolean; checks: TrustCheck[]; mandate: { deceased_name: string; executor_name: string; signed?: string } };
  payoutReceiver: { label: string; email: string };
  balance?: { amount?: string; currency: string };
  items: EstateItem[];
  generatedAt: string;
};

export type Step = 'ready' | 'excluded' | 'running' | 'done' | 'skipped' | 'error';

export type RowProgress = {
  step: Step;
  // Real PayPal state after the action (never a Lastly label).
  paypalStatus?: string;
  // A PayPal ID this row produced (refund, handover subscription).
  resultId?: string;
  resultKind?: 'Refund' | 'Handover';
  message?: string;
  at?: string;
  refunded?: Money;
  refundId?: string;
  approveUrl?: string;
  // Formal notice: written by the AI from the verified facts, or the fixed template when the AI is unavailable.
  letter?: NoticeLetter;
};

export type NoticeLetter = { text: string; source: 'ai' | 'template'; model?: string; fallbackReason?: string };

export type LedgerRow = EstateItem & { progress: RowProgress; rehearsal: boolean };

export type AuditEntry = {
  at: string;
  item: string;
  action: string;
  paypalId?: string;
  status: string;
  tone: 'ok' | 'pending' | 'error' | 'info';
  amount?: string;
};

export const TRIAGE_LABEL: Record<Triage, string> = {
  stop_and_refund: 'Stop & Refund',
  keep_for_family: 'Hand Over',
  formal_notice_only: 'Formal Notice',
};

export const money = (m?: Money) =>
  m ? Number(m.value).toLocaleString('en-GB', { style: 'currency', currency: m.currency_code }) : '—';

export const fictional = /\s*\(fictional\)\s*$/i;
// Seed merchants carry a "(fictional)" suffix; the page labels the whole estate as fictional once.
export const merchantName = (raw: string) => raw.replace(fictional, '');

export const longDate = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

// What Lastly will do for a row, in plain words, before anything runs.
export function planFor(item: EstateItem, rehearsal: boolean): string {
  if (item.noAction) return 'Nothing to do';
  if (item.triage === 'formal_notice_only') return 'Write to end the contract';
  if (item.triage === 'keep_for_family') return 'Hand over to whoever keeps it';
  if (item.captureId) return `Refund ${money(item.amount)}`;
  return rehearsal ? 'Pause the subscription' : 'Cancel the subscription';
}

// Where the payout goes, from the executor's side: when the executor is also the heir, it is "your" account.
export function heirAccount(c: Analysis['case']): { to: string; short: string } {
  const heir = c.heirs[0]?.name;
  if (heir && heir === c.executor_name) return { to: 'your PayPal account', short: 'you' };
  return heir ? { to: `${heir}\u2019s PayPal account`, short: heir } : { to: 'the heir\u2019s PayPal account', short: 'the heir' };
}

// relationship_to_executor is display only (the opening line at intake); no check or money step reads it.
export type MandateInfo = { deceased_name: string; executor_name: string; signed?: string; note?: string; relationship_to_executor?: string };
