// Builds the letter's case record from the case the portal saved in this tab
// (sessionStorage 'lastly-case-v1'). Only what PayPal confirmed counts: a row that did not
// finish is written as left unchanged, never as done.

import type { LetterCase, LetterFact } from '@/lib/family-letter';
import { fictional, merchantName, type Analysis, type AuditEntry, type RowProgress } from '../types';

export type SavedCase = {
  analysis: Analysis | null;
  progress: Record<string, RowProgress>;
  included: Record<string, boolean>;
  mode: 'rehearsal' | 'final';
  audit: AuditEntry[];
  payout: { step: string; batchId?: string; status?: string; at?: string };
  caseDocs?: { certificateText: string; notaryText: string };
};

export function readSavedCase(): SavedCase | null {
  try {
    const raw = window.sessionStorage.getItem('lastly-case-v1');
    const saved = raw ? (JSON.parse(raw) as SavedCase) : null;
    return saved?.analysis ? saved : null;
  } catch {
    return null;
  }
}

const amount = (m?: { value: string; currency_code: string }) => (m ? `${m.value} ${m.currency_code}` : undefined);
const clean = (name?: string | null) => (name ?? '').replace(fictional, '').trim();

export type IdKind = 'notice' | 'handover' | 'charge' | 'refund' | 'paused' | 'cancelled' | 'payout';

export type LetterRecord = {
  letterCase: LetterCase;
  // The PayPal IDs behind each line, for the footnote.
  ids: { kind: IdKind; merchant: string; id: string }[];
  rehearsal: boolean;
};

export function letterRecord(saved: SavedCase, today = new Date().toISOString().slice(0, 10)): LetterRecord | null {
  const a = saved.analysis;
  if (!a?.case.date_of_death) return null;
  const facts: LetterFact[] = [];
  const ids: LetterRecord['ids'] = [];
  for (const item of a.items) {
    const p = saved.progress[item.key];
    const merchant = merchantName(item.merchant);
    if (!p || p.step === 'skipped') continue; // nothing to do (e.g. charged before death): not part of the letter
    const done = p.step === 'done';
    if (!done) {
      if (p.step === 'excluded' || p.step === 'ready' || p.step === 'error') facts.push({ kind: 'left', merchant, why: p.step === 'error' ? 'error' : 'excluded' });
      continue;
    }
    if (item.triage === 'formal_notice_only') {
      facts.push({ kind: 'notice', merchant, monthly: amount(item.amount), nextOn: item.nextBillingAt?.slice(0, 10), subscriptionId: item.subscriptionId });
      if (item.subscriptionId) ids.push({ kind: 'notice', merchant, id: item.subscriptionId });
    } else if (item.triage === 'keep_for_family') {
      facts.push({ kind: 'handover', merchant, subscriptionId: p.resultId });
      if (p.resultId) ids.push({ kind: 'handover', merchant, id: p.resultId });
    } else if (item.captureId) {
      if (!p.refunded) {
        facts.push({ kind: 'left', merchant, why: 'error' });
        continue;
      }
      facts.push({ kind: 'refund', merchant, amount: amount(p.refunded)!, chargedOn: item.chargedAt?.slice(0, 10), refundId: p.refundId, captureId: item.captureId });
      ids.push({ kind: 'charge', merchant, id: item.captureId });
      if (p.refundId) ids.push({ kind: 'refund', merchant, id: p.refundId });
    } else if (item.subscriptionId) {
      const how = p.paypalStatus === 'CANCELLED' ? 'cancelled' : 'paused';
      facts.push({ kind: 'stopped', merchant, how, monthly: amount(item.amount), subscriptionId: item.subscriptionId });
      ids.push({ kind: how, merchant, id: item.subscriptionId });
    }
  }
  if (!facts.length) return null;
  // Refunds first in the story: what came back, then what was stopped, handed on, written.
  const order: LetterFact['kind'][] = ['stopped', 'refund', 'handover', 'notice', 'left'];
  facts.sort((x, y) => order.indexOf(x.kind) - order.indexOf(y.kind));

  const executor = clean(a.case.executor_name);
  const heirs = a.case.heirs.map((h) => h.name).filter((n): n is string => Boolean(n));
  const recipients = heirs.filter((n) => n !== executor);
  const refundTotal = facts.reduce((s, f) => (f.kind === 'refund' ? s + Number(f.amount.split(' ')[0]) : s), 0);
  const currency = facts.find((f) => f.kind === 'refund')?.kind === 'refund' ? (facts.find((f) => f.kind === 'refund') as { amount: string }).amount.split(' ')[1] : 'EUR';
  const paid = saved.payout?.step === 'done' && saved.payout.status === 'SUCCESS' && refundTotal > 0;
  if (paid && saved.payout.batchId) ids.push({ kind: 'payout', merchant: '', id: saved.payout.batchId });
  const deceased = clean(a.case.deceased_name);

  return {
    rehearsal: saved.mode === 'rehearsal',
    ids,
    letterCase: {
      deceased,
      called: deceased.split(/\s+/)[0] ?? deceased,
      diedOn: a.case.date_of_death,
      executor,
      recipients,
      facts,
      // The portal pays the first heir named (the demo has one real Sandbox heir account).
      payout: paid ? { amount: `${refundTotal.toFixed(2)} ${currency}`, to: heirs[0] ?? executor, batchId: saved.payout.batchId, status: saved.payout.status } : undefined,
      writtenOn: today,
    },
  };
}
