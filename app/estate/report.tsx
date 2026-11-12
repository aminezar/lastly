// The printed record of a case: what the executor approved, what PayPal confirmed, and what
// is still waiting. Written for the notary and, through them, every heir: factual, neutral,
// no warmth that presumes how the family feels. Print only; every status and ID comes from
// PayPal's own answers already on the page.

import type { Mode, PayoutState } from './sections';
import { fictional, longDate, merchantName, money, type Analysis, type AuditEntry, type LedgerRow, type Money } from './types';

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const clock = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const shortWhen = (iso: string) =>
  `${new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, ${new Date(iso).toLocaleTimeString('en-GB')}`;
// "On 12 November 2026, between 03:14 and 03:20, " or across days "Between … and …, ".
function span(first?: string, last?: string) {
  if (!first || !last) return '';
  const day = (iso: string) => new Date(iso).toDateString();
  if (day(first) !== day(last)) return `Between ${when(first)} and ${when(last)}, `;
  const d = longDate(new Date(first).toISOString());
  return clock(first) === clock(last) ? `On ${d} at ${clock(first)}, ` : `On ${d}, between ${clock(first)} and ${clock(last)}, `;
}

// PayPal's status codes, written as words. The code itself stays in the table.
const words = (status: string) => {
  const s = status.replace(/_/g, ' ').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

type Line = { text: string; ids?: string[] };

function linesFor(rows: LedgerRow[], recovered: Money, payout: PayoutState, heirLabel: string) {
  const done: Line[] = [];
  const waiting: Line[] = [];
  const nothing: Line[] = [];
  const notDone: Line[] = [];
  for (const r of rows) {
    const m = merchantName(r.merchant);
    const monthly = r.amount ? `${money(r.amount)} a month` : '';
    const p = r.progress;
    if (p.step === 'skipped') {
      nothing.push({ text: `${m}${r.captureId ? ' charge' : ''}: no action. ${p.message ?? ''}.`.replace('..', '.'), ids: [r.captureId ?? r.subscriptionId ?? ''].filter(Boolean) });
      continue;
    }
    if (p.step !== 'done') {
      notDone.push({ text: `${m}${r.captureId ? ' charge' : ''}: ${p.step === 'error' ? 'not changed in PayPal. The step did not complete and can be approved again.' : 'left for later by the executor. Nothing was changed in PayPal.'}`, ids: [r.captureId ?? r.subscriptionId ?? ''].filter(Boolean) });
      continue;
    }
    if (r.triage === 'formal_notice_only') {
      waiting.push({ text: `${m} (${monthly}, bound by a contract): a letter asking to end the membership from the date of death has been written, for the executor to send. The payment continues until ${m} answers.`, ids: [r.subscriptionId ?? ''].filter(Boolean) });
    } else if (r.triage === 'keep_for_family') {
      waiting.push({ text: `${m} (${monthly}, shared by the household): a new subscription on the same plan is waiting for whoever takes it over to approve it in PayPal. The original continues until then.`, ids: [r.subscriptionId ?? '', p.resultId ?? ''].filter(Boolean) });
    } else if (r.captureId) {
      const charged = r.chargedAt ? ` taken on ${longDate(r.chargedAt)}` : '';
      done.push({ text: `${m} charge of ${money(r.amount)}${charged}, after the date of death: refunded to the payment source it came from (${p.paypalStatus ? words(p.paypalStatus).toLowerCase() : 'sent'}).`, ids: [r.captureId, p.refundId ?? ''].filter(Boolean) });
    } else if (r.subscriptionId) {
      done.push({ text: `${m} subscription (${monthly}): ${p.paypalStatus === 'CANCELLED' ? 'cancelled in PayPal' : 'paused in PayPal. It can be resumed, or cancelled once the estate is settled'}.`, ids: [r.subscriptionId] });
    }
  }
  const returned = Number(recovered.value) > 0;
  if (returned && payout.step === 'done') {
    done.push({ text: `${money(recovered)} returned by refunds, paid on to ${heirLabel}.`, ids: [payout.batchId ?? ''].filter(Boolean) });
  } else if (returned) {
    waiting.push({ text: `${money(recovered)} returned by refunds has not yet been paid on to the heirs.`, ids: payout.batchId ? [payout.batchId] : [] });
  }
  return { done, waiting, nothing, notDone };
}

function Section({ title, lines }: { title: string; lines: Line[] }) {
  if (!lines.length) return null;
  return (
    <section className="report-keep mt-7">
      <h2 className="text-[10.5pt] font-semibold uppercase tracking-[0.08em] text-[#4a5568]">{title}</h2>
      <ul className="mt-2 space-y-2">
        {lines.map((l, i) => (
          <li key={i} className="grid grid-cols-[1fr_auto] gap-6 border-b border-[#e2e2e2] pb-2 text-[10.5pt] leading-snug">
            <span>{l.text}</span>
            <span className="text-right font-mono text-[8.5pt] leading-relaxed text-[#4a5568]">
              {l.ids?.map((id) => <span key={id} className="block">{id}</span>)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function PrintReport({ analysis, audit, mode, rows, recovered, payout }: { analysis: Analysis; audit: AuditEntry[]; mode: Mode; rows: LedgerRow[]; recovered: Money; payout: PayoutState }) {
  const c = analysis.case;
  const v = analysis.verification;
  const name = (c.deceased_name ?? 'Unknown person').replace(fictional, '');
  const counted = v.checks.filter((k) => !k.skipped);
  const passed = counted.filter((k) => k.pass).length;
  const heirs = c.heirs.map((h, i) => `${h.name ?? `Heir ${i + 1}`} (${h.share_pct}%)`).join(', ');
  const heirLabel = `the heirs' PayPal account (Sandbox: there is one heir account in this demo, so the full amount went to it rather than being split)`;
  const { done, waiting, nothing, notDone } = linesFor(rows, recovered, payout, heirLabel);
  const actions = audit.filter((e) => e.paypalId && e.item !== 'Case');
  const first = audit[0]?.at;
  const last = audit[audit.length - 1]?.at;
  return (
    <article className="report hidden text-[#111] print:block">
      <header className="flex items-baseline justify-between border-b border-[#111] pb-3">
        <span className="hl-serif text-[18pt]">Lastly</span>
        <span className="text-[9pt] text-[#4a5568]">Record prepared {longDate(new Date().toISOString())}</span>
      </header>

      <h1 className="hl-serif mt-8 text-[22pt] leading-tight">Record of actions on the PayPal account of {name}</h1>
      <p className="mt-2 max-w-[60ch] text-[10.5pt] leading-relaxed">
        {span(first, last)}the executor approved {done.length + waiting.length} {done.length + waiting.length === 1 ? 'step' : 'steps'} on this account. {done.length} {done.length === 1 ? 'is' : 'are'} complete in PayPal; {waiting.length} {waiting.length === 1 ? 'is' : 'are'} waiting on someone else.
      </p>

      <dl className="report-keep mt-6 grid grid-cols-2 gap-x-10 gap-y-3 border-y border-[#e2e2e2] py-4 text-[10pt]">
        <div><dt className="text-[#4a5568]">Date of death</dt><dd className="font-semibold">{c.date_of_death ? longDate(c.date_of_death) : 'Not found in the documents'}</dd></div>
        <div><dt className="text-[#4a5568]">Executor</dt><dd className="font-semibold">{c.executor_name ?? 'Not named in the notary act'}</dd></div>
        <div><dt className="text-[#4a5568]">Heirs named in the notary act</dt><dd>{heirs || '—'}</dd></div>
        <div><dt className="text-[#4a5568]">Authority</dt><dd>Legacy Mandate signed {v.mandate.signed ? longDate(v.mandate.signed) : '—'}; death certificate and notary act checked, {passed} of {counted.length} checks passed</dd></div>
        <div className="col-span-2"><dt className="text-[#4a5568]">Subscriptions</dt><dd>{mode === 'rehearsal' ? 'Paused, not cancelled: they can be resumed or cancelled later' : 'Cancelled for good'}</dd></div>
      </dl>

      <Section title="Done, confirmed by PayPal" lines={done} />
      <Section title="Still waiting" lines={waiting} />
      <Section title="Not done" lines={notDone} />
      <Section title="No action needed" lines={nothing} />

      {actions.length > 0 && (
        <section className="mt-9">
          <h2 className="text-[10.5pt] font-semibold uppercase tracking-[0.08em] text-[#4a5568]">Full record</h2>
          <table className="mt-2 w-full border-collapse text-[9pt]">
            <thead>
              <tr className="border-b border-[#111] text-left">
                <th className="py-1.5 pr-3 font-semibold">Time</th>
                <th className="pr-3 font-semibold">What</th>
                <th className="pr-3 font-semibold">PayPal ID</th>
                <th className="pr-3 font-semibold">PayPal status</th>
                <th className="text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((e, i) => (
                <tr key={i} className="report-row border-b border-[#e2e2e2] align-top">
                  <td className="whitespace-nowrap py-1.5 pr-3 tabular-nums">{shortWhen(e.at)}</td>
                  <td className="pr-3"><span className="font-semibold">{e.item}</span>: {e.action}</td>
                  <td className="pr-3 font-mono text-[8pt]">{e.paypalId ?? ''}</td>
                  <td className="whitespace-nowrap pr-3">{words(e.status)}</td>
                  <td className="whitespace-nowrap text-right tabular-nums">{e.amount ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <div className="report-keep mt-12 grid grid-cols-2 gap-10 text-[9.5pt]">
        <div className="border-t border-[#111] pt-1.5">Executor&apos;s signature</div>
        <div className="border-t border-[#111] pt-1.5">Date</div>
      </div>

      <footer className="mt-8 border-t border-[#e2e2e2] pt-3 text-[8.5pt] leading-relaxed text-[#4a5568]">
        Every status and ID in this record is PayPal&apos;s own answer. PayPal Sandbox, the test environment: the people and payments in this case are fictional, and the executor sign-in and Legacy Mandate are simulated.
      </footer>
    </article>
  );
}
