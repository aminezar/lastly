// The letter for the family: the last page of a case. It tells the family, in plain words,
// what was stopped, what came back and where it went, what was handed on, and what still
// waits on others. Shared by the browser (template, checks) and the server (AI draft).
//
// How the facts stay true: the AI never writes a name, an amount or a date. It writes the
// sentences with placeholders such as {M1} or {A1}, and the code fills each placeholder from
// the case record. Any draft that names something itself, carries a number, leaves a fact out
// or reads like product cheer is set aside, and the fixed template below is used instead.

export type Lang = 'en' | 'fr';

export type LetterFact =
  | { kind: 'stopped'; merchant: string; how: 'paused' | 'cancelled'; monthly?: string; subscriptionId?: string }
  | { kind: 'refund'; merchant: string; amount: string; chargedOn?: string; refundId?: string; captureId?: string }
  | { kind: 'handover'; merchant: string; subscriptionId?: string }
  | { kind: 'notice'; merchant: string; monthly?: string; nextOn?: string; subscriptionId?: string }
  | { kind: 'left'; merchant: string; why: 'excluded' | 'error' };

export type LetterCase = {
  deceased: string; // full name, as in the documents
  called: string; // how the letter names them (chosen by the executor; first name by default)
  diedOn: string; // YYYY-MM-DD
  executor: string;
  recipients: string[]; // heirs other than the executor
  facts: LetterFact[];
  payout?: { amount: string; to: string; batchId?: string; status?: string };
  writtenOn: string; // YYYY-MM-DD
};

// --- Formatting -------------------------------------------------------------------------

export const longDateIn = (iso: string, lang: Lang) =>
  new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString(lang === 'fr' ? 'fr-BE' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

// "9.99 EUR" -> "€9.99" / "9,99 €"
export function moneyIn(amount: string, lang: Lang) {
  const [value, currency = 'EUR'] = amount.split(' ');
  return Number(value).toLocaleString(lang === 'fr' ? 'fr-BE' : 'en-GB', { style: 'currency', currency });
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

const list = (items: string[], lang: Lang) => {
  const and = lang === 'fr' ? 'et' : 'and';
  return items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} ${and} ${items[items.length - 1]}`;
};

// --- Placeholders -------------------------------------------------------------------------
// One value per placeholder, rendered in the letter's language. The AI sees the keys and what
// each one stands for, never has to type the value itself.

export type Slots = Record<string, { value: string; means: string }>;

export function slotsFor(c: LetterCase, lang: Lang): Slots {
  const s: Slots = {
    NAME: { value: c.called, means: 'how the letter names the person who died' },
    DIED: { value: longDateIn(c.diedOn, lang), means: 'the date of death' },
  };
  c.facts.forEach((f, i) => {
    const n = i + 1;
    s[`M${n}`] = { value: f.merchant, means: `the merchant of fact ${n}` };
    if (f.kind === 'refund') {
      s[`A${n}`] = { value: moneyIn(f.amount, lang), means: `the amount refunded in fact ${n}` };
      if (f.chargedOn) s[`D${n}`] = { value: longDateIn(f.chargedOn, lang), means: `the date that charge was taken` };
    }
    if ((f.kind === 'stopped' || f.kind === 'notice') && f.monthly) s[`A${n}`] = { value: moneyIn(f.monthly, lang), means: `the monthly amount of fact ${n}` };
    if (f.kind === 'notice' && f.nextOn) s[`D${n}`] = { value: longDateIn(f.nextOn, lang), means: `the next payment date of fact ${n}` };
  });
  if (c.payout) {
    s.PAID = { value: moneyIn(c.payout.amount, lang), means: 'the amount paid out to the heir' };
    s.PAYEE = { value: c.payout.to === c.executor ? (lang === 'fr' ? 'moi' : 'me') : c.payout.to, means: 'the heir who received the payout' };
  }
  return s;
}

export const fill = (text: string, slots: Slots) => text.replace(/\{([A-Z]+\d*)\}/g, (all, key: string) => slots[key]?.value ?? all);

// --- The letter, as parts the page lays out -------------------------------------------------

export type LetterBody = { opening: string; facts: string[]; waiting?: string; closing: string };
export type Letter = {
  lang: Lang;
  dateLine: string;
  greeting: string;
  body: LetterBody; // filled: real names, amounts and dates
  signOff: string;
  signature: string;
  source: 'ai' | 'template';
  model?: string;
  fallbackReason?: string;
};

const waitingFacts = (c: LetterCase) => c.facts.map((f, i) => ({ f, n: i + 1 })).filter(({ f }) => f.kind === 'handover' || f.kind === 'notice');

export function frame(c: LetterCase, lang: Lang) {
  const names = c.recipients.map(firstName);
  return {
    dateLine: longDateIn(c.writtenOn, lang),
    greeting: names.length
      ? lang === 'fr' ? `${list(names, lang)}, et toute la famille,` : `Dear ${list(names, lang)}, and all the family,`
      : lang === 'fr' ? `À la famille de ${c.deceased},` : `To the family of ${c.deceased},`,
    signOff: lang === 'fr' ? 'Je vous embrasse,' : 'With love,',
    signature: firstName(c.executor),
  };
}

// The fixed template, with placeholders: used when the AI is unavailable or its draft fails a check.
export function templateBody(c: LetterCase, lang: Lang): LetterBody {
  const fr = lang === 'fr';
  const facts = c.facts.map((f, i): string => {
    const n = i + 1;
    const M = `{M${n}}`;
    switch (f.kind) {
      case 'stopped':
        if (fr)
          return f.how === 'paused'
            ? `${M} prélevait encore${f.monthly ? ` {A${n}}` : ''} chaque mois. J’ai suspendu l’abonnement : plus rien ne sera prélevé, et il pourra être résilié pour de bon une fois la succession réglée.`
            : `${M} prélevait encore${f.monthly ? ` {A${n}}` : ''} chaque mois. J’ai résilié l’abonnement : plus rien ne sera prélevé.`;
        return f.how === 'paused'
          ? `${M} was still charging${f.monthly ? ` {A${n}}` : ''} every month. I have paused it, so nothing more will be taken, and it can be closed for good once the estate is settled.`
          : `${M} was still charging${f.monthly ? ` {A${n}}` : ''} every month. I have cancelled it, so nothing more will be taken.`;
      case 'refund': {
        const when = f.chargedOn ? (fr ? ` le {D${n}}` : ` on {D${n}}`) : '';
        const paid = c.payout
          ? fr
            ? c.payout.to === c.executor ? ` Il m’a ensuite été versé, au titre de la succession.` : ` Il a ensuite été versé à {PAYEE}, au titre de la succession.`
            : ` It has since been paid out to {PAYEE}, as an heir named in the notary act.`
          : fr ? ` Il revient à la succession.` : ` It belongs to the estate.`;
        return fr
          ? `${M} avait encore prélevé {A${n}}${when}, après le décès. Cet argent a été remboursé sur le compte d’où il était parti.${paid}`
          : `${M} took {A${n}}${when}, after {NAME} had died. That money has been refunded to the account it was taken from.${paid}`;
      }
      case 'handover':
        return fr
          ? `${M} sert à toute la maison, alors je ne l’ai pas arrêté. Un nouvel abonnement, à la même formule, attend d’être approuvé dans PayPal par celui ou celle d’entre nous qui le reprend. L’ancien continue jusque-là, pour que rien ne soit perdu entre-temps.`
          : `${M} is shared by the household, so I have not stopped it. A new subscription on the same plan is waiting for whichever of us takes it on to approve it in PayPal. The old one keeps running until then, so nothing is lost in between.`;
      case 'notice':
        return fr
          ? `${M} est lié par un contrat : arrêter le paiement ne ferait que laisser une dette à la succession. Je leur ai écrit pour demander que l’abonnement prenne fin à la date du décès, et le paiement continue jusqu’à leur réponse.`
          : `${M} is bound by a contract, so stopping the payment would only leave the estate in debt. I have written to ask that the membership end as of the date of death, and the payment keeps running until they reply.`;
      case 'left':
        return fr
          ? `Pour ${M}, je n’ai rien changé pour l’instant${f.why === 'error' ? ' : PayPal n’a pas pu le faire cette fois, et je réessaierai' : ''}.`
          : `I have left ${M} as it is for now${f.why === 'error' ? ': PayPal could not make the change this time, and I will try again' : ''}.`;
    }
  });
  const waiting = waitingFacts(c);
  const waitingText = waiting.length
    ? fr
      ? `Il reste ${waiting.length === 1 ? 'une chose qui dépend' : 'des choses qui dépendent'} d’autres personnes : ${list(waiting.map(({ f, n }) => (f.kind === 'handover' ? `l’approbation du nouvel abonnement {M${n}}` : `la réponse de {M${n}}`)), lang)}. Je vous dirai quand ce sera réglé.`
      : `${waiting.length === 1 ? 'One thing is' : 'A few things are'} still with other people: ${list(waiting.map(({ f, n }) => (f.kind === 'handover' ? `approving the new {M${n}} subscription` : `{M${n}}'s reply`)), lang)}. I will let you know when ${waiting.length === 1 ? 'it is' : 'each one is'} settled.`
    : undefined;
  return {
    opening: fr
      ? `{NAME} nous a quittés le {DIED}. Depuis, son compte PayPal a continué à payer comme si de rien n’était. J’ai tout repris, une chose après l’autre, et je voulais que vous ayez un compte rendu simple de ce qui a été fait.`
      : `{NAME} died on {DIED}. Since then, the PayPal account went on paying for things as if nothing had changed. I have now been through each of them, and I wanted you to have a plain account of what was done.`,
    facts,
    waiting: waitingText,
    closing: c.facts.some((f) => f.kind === 'handover')
      ? fr
        ? `À part cette approbation, rien ne vous est demandé. Prenez soin de vous.`
        : `Apart from that one approval, nothing is needed from you. Take care of yourselves.`
      : fr
        ? `Rien ne vous est demandé. Prenez soin de vous.`
        : `Nothing is needed from you. Take care of yourselves.`,
  };
}

// --- Checks on an AI draft ------------------------------------------------------------------
// A draft passes only if it reads like the template's kind of letter and every fact is still
// the case's own. Returns the reason it failed, or null.

const NUMBER_WORDS = /\b(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|thirty|hundred|thousand|million|deux|trois|quatre|cinq|sept|huit|neuf|dix|onze|douze|vingt|trente|cent|mille|million)\b/i;
const CHEER = /!|congratulat|félicit|great news|good news|bonne nouvelle|excit|happy|heureux|heureuse|ravi|thrilled|awesome|amazing|super|🎉|✅|seamless|hassle|powered by|lastly/i;
// What each kind of fact must say, so the draft cannot quietly change the action.
const MUST: Record<Lang, Record<LetterFact['kind'], RegExp>> = {
  en: { stopped: /\b(paus|cancel|stop)/i, refund: /\b(refund|return|back)/i, handover: /\bapprov/i, notice: /\bcontract/i, left: /\b(left|leave|unchanged|as it is|not changed)/i },
  fr: { stopped: /(suspend|résili|arrêt|pause)/i, refund: /(rembours|rendu|revenu|restitu)/i, handover: /approuv|approbation|valid|accept/i, notice: /contrat/i, left: /(rien changé|laissé|tel quel|inchangé)/i },
};
const MUST_NOT: Record<Lang, Partial<Record<LetterFact['kind'], RegExp>>> = {
  en: { handover: /\b(cancel|cancelled|paused|have stopped it)\b/i, notice: /\b(cancelled|have stopped)\b/i },
  fr: { handover: /résili/i, notice: /\b(résilié|j’ai arrêté|j'ai arrêté)\b/i },
};
// Pronouns would guess the gender of the person who died: the letter uses {NAME} instead.
const PRONOUNS_EN = /\b(he|him|his|she|her|hers|himself|herself)\b/i;

export function checkDraft(draft: LetterBody, c: LetterCase, lang: Lang): string | null {
  const slots = slotsFor(c, lang);
  const parts = [draft.opening, ...draft.facts, draft.waiting ?? '', draft.closing];
  if (draft.facts.length !== c.facts.length) return 'the draft did not cover every fact once';
  if (Boolean(draft.waiting) !== waitingFacts(c).length > 0) return 'the draft got wrong what is still waiting';
  for (const p of parts) {
    if (p.length > 600) return 'a paragraph was too long';
    const words = p.replace(/\{[A-Z]+\d*\}/g, 'x');
    if (/\d/.test(words)) return 'the draft wrote a number itself';
    if (/[€$£]|\bEUR\b|\bUSD\b/.test(words)) return 'the draft wrote an amount itself';
    if (NUMBER_WORDS.test(words)) return 'the draft wrote a number itself';
    if (CHEER.test(p)) return 'the draft did not keep the tone';
    if (lang === 'en' && PRONOUNS_EN.test(words)) return 'the draft guessed a pronoun';
    for (const [, key] of p.matchAll(/\{([A-Z]+\d*)\}/g)) if (!slots[key]) return `the draft used an unknown placeholder {${key}}`;
    // A capital letter inside a sentence would be a name the code did not insert.
    const midCaps = words.match(/[^.:;?\s]\s+([A-ZÀ-Ý][\p{L}’'-]+)/gu)?.map((m) => m.trim().split(/\s+/).pop()!) ?? [];
    const stray = midCaps.filter((w) => !['I', 'PayPal', 'Je', 'J’ai', "J'ai"].includes(w));
    if (stray.length) return `the draft named something itself (${stray[0]})`;
  }
  // Openings of sentences can also hold a name: only allow capitalised words the template's kind of letter uses.
  for (const p of parts) {
    for (const s of p.replace(/\{[A-Z]+\d*\}/g, 'x').split(/(?<=[.:;?])\s+/)) {
      const w = s.trim().split(/\s+/)[0]?.replace(/[^\p{L}’']/gu, '');
      if (w && /^[A-ZÀ-Ý]/.test(w) && !/^(qu|[ldjncs])[’']/i.test(w) && !OPENERS[lang].has(w.toLowerCase())) return `the draft began a sentence with a word it may not use (${w})`;
    }
  }
  // Promises the case record does not hold: only a 'waiting' line (and a retry) may look ahead.
  const promise = lang === 'fr' ? /\bje (vais|ferai|garderai|veillerai|tiendrai|reviendrai|continuerai)\b/i : /\bI(?:'ll|’ll| will| shall)\b/;
  for (const [i, p] of [draft.opening, draft.closing, ...draft.facts.filter((_, k) => c.facts[k].kind !== 'left')].entries()) if (promise.test(p)) return `the draft made a promise the case does not hold (${i})`;
  for (const [i, f] of c.facts.entries()) {
    const p = draft.facts[i];
    const n = i + 1;
    if (!p.includes(`{M${n}}`)) return `the draft left out ${f.merchant}`;
    if (f.kind === 'refund' && !p.includes(`{A${n}}`)) return `the draft left out the amount refunded`;
    if (!MUST[lang][f.kind].test(p)) return `the draft did not say what was done with ${f.merchant}`;
    if (MUST_NOT[lang][f.kind]?.test(p)) return `the draft said something different was done with ${f.merchant}`;
    if (f.kind === 'stopped' && f.how === 'paused' && /cancel|résili/i.test(p.replace(/can be (cancelled|closed)|pourra être résili/gi, ''))) return `the draft said ${f.merchant} was cancelled, but it was paused`;
    // A fact paragraph may only use its own placeholders (plus the shared ones).
    for (const m of p.matchAll(/\{[A-Z]+(\d+)\}/g)) if (Number(m[1]) !== n) return `the draft mixed up two facts`;
  }
  if (c.payout && !draft.facts.some((p) => p.includes('{PAYEE}') || (lang === 'fr' && /versé/.test(p)))) return 'the draft left out who was paid';
  if (draft.waiting) for (const { n } of waitingFacts(c)) if (!draft.waiting.includes(`{M${n}}`)) return 'the draft left out something still waiting';
  // A handover still needs one family member's approval: the letter must not say nothing at all is asked of them.
  if (c.facts.some((f) => f.kind === 'handover') && /(nothing|rien)/i.test(draft.closing) && !/(apart|except|besides|other than|approv|à part|sauf|hormis|approuv)/i.test(draft.closing)) return 'the draft said nothing is needed, but a handover waits for approval';
  if (!draft.opening.includes('{DIED}')) return 'the draft left out the date of death';
  return null;
}

// Words a sentence may start with. A name the code did not insert would start a sentence too,
// so anything else sends the letter back to the template.
const OPENERS: Record<Lang, Set<string>> = {
  en: new Set(
    `x i i've i'm i'll the this that these those it it's its in since after before when while as so but and nothing there one a an all every each our we we'll you your my now for until once if then thank thanks with please what which both some none no yes take rather because though although at on of by from to also everything here even still most apart besides beyond otherwise meanwhile anything everyone whoever whichever whatever where how why let do don't is was has have had will would should could can may might must are were be being been not just only nor or yet instead today tomorrow soon later first finally last lastly again either neither such much many more less few several like unlike over under through during within without about against between among toward towards upon onto into out up down off near far behind across along around above below beside beneath past per via whether same other another`.split(
      ' ',
    ),
  ),
  fr: new Set(
    `x je j’ai j'ai le la les l’ l' un une ce c’est c'est cet cette ces cela ça il elle ils elles on depuis après avant quand pendant comme donc mais et ou rien tout tous toutes chaque notre nos vous votre vos mon ma mes pour jusqu’à jusqu'à si alors merci avec ainsi enfin aussi même encore d’ici d'ici dès en à au aux de du des sur plus prenez à part hormis sauf quant puis ensuite désormais aujourd’hui aujourd'hui bientôt plus tard pas ne n’ n' qui que quoi dont où personne aucun aucune nul cependant pourtant toutefois néanmoins certes car parce puisque lorsque dès ni soit voici voilà d’abord d'abord surtout seul seule seuls déjà toujours jamais là ici cet`.split(
      ' ',
    ),
  ),
};

// --- Assembling -------------------------------------------------------------------------

export function fillBody(b: LetterBody, slots: Slots): LetterBody {
  return { opening: fill(b.opening, slots), facts: b.facts.map((p) => fill(p, slots)), waiting: b.waiting && fill(b.waiting, slots), closing: fill(b.closing, slots) };
}

export function assemble(c: LetterCase, lang: Lang, draft: { body: LetterBody; source: 'ai'; model: string } | { source: 'template'; fallbackReason?: string }): Letter {
  const slots = slotsFor(c, lang);
  const f = frame(c, lang);
  if (draft.source === 'ai') return { lang, ...f, body: fillBody(draft.body, slots), source: 'ai', model: draft.model };
  return { lang, ...f, body: fillBody(templateBody(c, lang), slots), source: 'template', fallbackReason: draft.fallbackReason };
}

// A stable key for one case's letter in one language (cache on both sides).
export function letterKey(c: LetterCase, lang: Lang): string {
  const { writtenOn: _w, called: _c, ...rest } = c;
  void _w;
  void _c;
  return `${lang}:${JSON.stringify(rest)}`;
}
