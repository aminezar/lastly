// Lastly API: the AI's draft of the letter for the family.
// POST /api/estate/family-letter { case: LetterCase, lang: 'en' | 'fr' }
// → { ok: true, body, model } where body holds placeholders only ({M1}, {A1}, {NAME}…), or
//   { ok: false, error }. The browser fills the placeholders from the case record and checks
//   the draft (lib/family-letter.ts); a failed check, or any error here, means the fixed
//   template is used. No PayPal call. Cached per case and language, and rate-limited.
import { NextResponse } from 'next/server';
import { aiEnabled } from '@/lib/ai';
import { respond } from '@/lib/estate-ai';
import { checkDraft, letterKey, slotsFor, templateBody, type Lang, type LetterBody, type LetterCase, type LetterFact } from '@/lib/family-letter';
import { aiLimited } from '@/lib/rate-limit';

const INSTRUCTIONS = (lang: Lang) =>
  [
    `You help an executor write a short letter to the family after a death. Write in ${lang === 'fr' ? 'French (Belgium), using "vous"' : 'British English'}.`,
    'The executor has settled the PayPal payments of the person who died. The letter tells the family, plainly and warmly, what was done. It is the last piece of paperwork after a death: calm, gentle, simple words, short sentences. No exclamation marks, no cheer, no congratulations, no product or app names, no sales language.',
    'Write in the first person as the executor ("I").',
    'IMPORTANT: never write a name, a merchant, an amount, a number or a date yourself. Use only the placeholders given, exactly as written, e.g. {M1} or {A1}. The code fills them in.',
    'Refer to the person who died only as {NAME}. Never use he, him, his, she, her, or any word for their relationship (father, mother…).',
    'Say only what the facts say. Do not add any action, promise, feeling about a specific person, or detail that is not in the facts.',
    'Answer with JSON only: {"opening": string, "facts": [string, one per fact, in order], "waiting": string or null, "closing": string}.',
    '- opening: two or three sentences; it must contain {NAME} and {DIED}.',
    '- facts: one short paragraph per fact (one to three sentences), using only that fact\'s own placeholders plus {NAME} and {PAYEE}. Mention each amount once.',
    '- waiting: one or two sentences naming each fact still waiting on someone else by its merchant placeholder, or null when nothing waits.',
    '- closing: one quiet sentence that says what the family does not have to do. Do not sign off; the signature is added separately.',
    'If a handover is waiting, the closing must say that, apart from approving it, nothing else is needed.',
    'Make no promise except, in "waiting", that the family will be told when it is settled. Do not say "I will" anywhere else.',
    'Voice: a grown child writing to their family, not an administrator. Do not claim more than the facts (no "put right", "sorted out", "everything"). Avoid office words such as "position", "note sets out", "regarding", "records", "dealt with".',
  ].join('\n');

function describe(f: LetterFact, n: number, c: LetterCase): string {
  const has = (k: string) => `{${k}${n}}`;
  switch (f.kind) {
    case 'stopped':
      return `Fact ${n}: ${has('M')} was a subscription still charging${f.monthly ? ` ${has('A')} a month` : ''}. It has been ${f.how === 'paused' ? 'PAUSED (not cancelled): nothing more will be taken, and it can be closed for good once the estate is settled' : 'CANCELLED: nothing more will be taken'}.`;
    case 'refund':
      return `Fact ${n}: ${has('M')} took ${has('A')}${f.chargedOn ? ` on ${has('D')}` : ''}, after the death. It has been REFUNDED to the account it was taken from.${c.payout ? ` That money has since been paid out to {PAYEE}, an heir named in the notary act${c.payout.to === c.executor ? ' (the executor, so {PAYEE} reads "me")' : ''}.` : ' It belongs to the estate.'}`;
    case 'handover':
      return `Fact ${n}: ${has('M')} is shared by the household, so it was NOT stopped. A new subscription on the same plan WAITS for a family member to approve it in PayPal; the old one keeps running until then. (Still waiting.)`;
    case 'notice':
      return `Fact ${n}: ${has('M')} is bound by a contract, so the payment was NOT stopped (that would leave the estate in debt). The executor has written to ask that it end as of the date of death; the payment keeps running until they reply. (Still waiting.)`;
    case 'left':
      return `Fact ${n}: ${has('M')} was left unchanged for now${f.why === 'error' ? ' because PayPal could not make the change this time; the executor will try again' : ' by the executor\'s choice'}.`;
  }
}

const cache = new Map<string, Promise<{ body: LetterBody; model: string }>>();

function parse(text: string, c: LetterCase): LetterBody {
  const start = text.indexOf('{"');
  const end = text.lastIndexOf('}');
  const o = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const facts = Array.isArray(o.facts) ? o.facts.map(str) : [];
  if (facts.length !== c.facts.length) throw new Error('the draft did not cover every fact once');
  return { opening: str(o.opening), facts, waiting: str(o.waiting) || undefined, closing: str(o.closing) };
}

function validCase(v: unknown): v is LetterCase {
  const c = v as LetterCase;
  return Boolean(
    c &&
      typeof c.called === 'string' &&
      typeof c.diedOn === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(c.diedOn) &&
      Array.isArray(c.facts) &&
      c.facts.length > 0 &&
      c.facts.length <= 12 &&
      c.facts.every((f) => f && typeof f.merchant === 'string' && ['stopped', 'refund', 'handover', 'notice', 'left'].includes(f.kind)) &&
      JSON.stringify(c).length < 6000,
  );
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { case?: unknown; lang?: unknown };
  const lang: Lang = body.lang === 'fr' ? 'fr' : 'en';
  if (!validCase(body.case)) return NextResponse.json({ ok: false, error: 'A case record is required' }, { status: 400 });
  const c = body.case;
  if (!aiEnabled()) return NextResponse.json({ ok: false, error: 'AI is not configured' }, { status: 503 });
  const key = letterKey(c, lang);
  let pending = cache.get(key);
  if (!pending) {
    // Only a new case or language reaches the model, and counts against the limit.
    const limited = aiLimited(request);
    if (limited) return limited;
    const slots = slotsFor(c, lang);
    const facts = [
      `Placeholders: ${Object.entries(slots).map(([k, s]) => `{${k}} = ${s.means}`).join('; ')}.`,
      `{NAME} died on {DIED}.`,
      ...c.facts.map((f, i) => describe(f, i + 1, c)),
      c.recipients.length ? 'The letter goes to the other heirs.' : 'The letter goes to the family.',
      '',
      'Here is a plain version of this letter, with the same placeholders. Keep its warmth and its facts; write it in your own words, a little more personal, and no longer:',
      JSON.stringify(templateBody(c, lang)),
    ].join('\n');
    pending = respond([{ type: 'input_text', text: `Write the letter from these facts.\n\n${facts}` }], 900, INSTRUCTIONS(lang)).then(({ text, model }) => {
      const draft = parse(text, c);
      const problem = checkDraft(draft, c, lang);
      if (problem) throw new Error(problem);
      return { body: draft, model };
    });
    cache.set(key, pending);
    pending.catch(() => cache.delete(key));
    if (cache.size > 300) cache.delete(cache.keys().next().value as string);
  }
  try {
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('the AI did not answer within 20 seconds')), 20_000));
    const { body: draft, model } = await Promise.race([pending, timeout]);
    return NextResponse.json({ ok: true, body: draft, model });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[AI] family letter not used: ${message}`);
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
