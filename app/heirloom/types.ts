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

export type TrustCheck = { id: 'death-date' | 'deceased' | 'executor'; label: string; pass: boolean; detail: string };

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
  // Real PayPal state after the action (never a Heirloom label).
  paypalStatus?: string;
  // A PayPal ID this row produced (refund, handover subscription).
  resultId?: string;
  resultKind?: 'Refund' | 'Handover';
  message?: string;
  at?: string;
  refunded?: Money;
  refundId?: string;
  approveUrl?: string;
};

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
  keep_for_family: 'Keep for Family',
  formal_notice_only: 'Formal Notice',
};

export const money = (m?: Money) =>
  m ? Number(m.value).toLocaleString('en-GB', { style: 'currency', currency: m.currency_code }) : '—';

export const fictional = /\s*\(fictional\)\s*$/i;
// Seed merchants carry a "(fictional)" suffix; the page labels the whole estate as fictional once.
export const merchantName = (raw: string) => raw.replace(fictional, '');

export const longDate = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

// What Heirloom will do for a row, in plain words, before anything runs.
export function planFor(item: EstateItem, rehearsal: boolean): string {
  if (item.noAction) return 'Nothing to do';
  if (item.triage === 'formal_notice_only') return 'Send a formal notice';
  if (item.triage === 'keep_for_family') return 'Hand over to the family';
  if (item.captureId) return `Refund ${money(item.amount)}`;
  return rehearsal ? 'Pause the subscription' : 'Cancel the subscription';
}

export type MandateInfo = { deceased_name: string; executor_name: string; signed?: string; note?: string };
