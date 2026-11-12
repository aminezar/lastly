// Lastly shared server logic: document extraction, triage rules, and action types.
// Server-only. The triage decision and the document check follow explicit rules, so the
// outcome is deterministic and auditable whether or not a model is available. The AI's own
// reading of the documents (lib/estate-ai.ts) is compared with the rules' reading here, and
// a difference can only hold a case, never open one.

import { aiEnabled } from '@/lib/ai';
import { readDocumentFacts, UnusableAnswer, type FactReading, type SecondReading } from '@/lib/estate-ai';

export type Triage = 'stop_and_refund' | 'keep_for_family' | 'formal_notice_only';

export type TriageDecision = {
  triage: Triage;
  confidence: 'high' | 'medium';
  source: 'ai' | 'rules';
  reason: string;
  // True when the rules found nothing to do (e.g. a charge taken before the date of death).
  noAction?: boolean;
};

const DEMO_CERTIFICATE = [
  'AKTE VAN OVERLIJDEN / ACTE DE DECES — Sample fiction only',
  'Overledene / Deceased: Jean Dupont (fictional)',
  'Datum van overlijden / Date of death: 20 October 2026',
  'Plaats / Place: Brussels, Belgium',
].join('\n');

const DEMO_NOTARY = [
  'AKTE VAN ERFOPVOLGING / ACTE D’HEREDITE — Sample fiction only',
  'Notary act for the estate of Jean Dupont, deceased 20 October 2026.',
  'Executor / executeur-testamentaire: Marie Dupont (daughter), pre-authorized by Legacy Mandate dated 3 May 2025.',
  'Heirs: Marie Dupont 50%, Luc Dupont 50%.',
].join('\n');

export function demoDocuments(): { certificateText: string; notaryText: string } {
  return { certificateText: DEMO_CERTIFICATE, notaryText: DEMO_NOTARY };
}

function normalizeDate(match: RegExpMatchArray): string {
  if (/^\d{1,2} /.test(match[0])) {
    const months: Record<string, string> = { january: '01', february: '02', march: '03', april: '04', may: '05', june: '06', july: '07', august: '08', september: '09', october: '10', november: '11', december: '12' };
    return `${match[3]}-${months[match[2].toLowerCase()]}-${match[1].padStart(2, '0')}`;
  }
  return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
}

export type MerchantFacts = {
  merchant: string;
  customId?: string;
  status?: string;
  amount?: string;
  nextBillingTime?: string;
  note?: string;
  captureId?: string;
  chargedAt?: string;
};

// Deterministic triage rules — these run identically with or without AI.
// - formal_notice_only when the merchant note flags a contract (stopping payment = estate debt)
// - keep_for_family when the note flags a shared household service
// - otherwise stop_and_refund (personal subscriptions and post-death captures)
export function classifyWithRules(item: MerchantFacts, dateOfDeath?: string): TriageDecision {
  const note = (item.note ?? '').toLowerCase();
  if (note.includes('contract')) {
    return {
      triage: 'formal_notice_only',
      confidence: 'high',
      source: 'rules',
      reason: 'Contract-bound service: cancelling payment alone would create estate debt, so Lastly drafts a formal bereavement notice instead.',
    };
  }
  if (note.includes('shared') || note.includes('household') || note.includes('family')) {
    return {
      triage: 'keep_for_family',
      confidence: 'high',
      source: 'rules',
      reason: 'Shared household service: keep it running and hand billing over to the surviving family member.',
    };
  }
  if (item.captureId && item.chargedAt && dateOfDeath && item.chargedAt.slice(0, 10) < dateOfDeath) {
    return {
      triage: 'stop_and_refund',
      confidence: 'high',
      source: 'rules',
      reason: `Charged on ${item.chargedAt.slice(0, 10)}, before the date of death (${dateOfDeath}): a valid charge, nothing to refund.`,
      noAction: true,
    };
  }
  if (item.captureId) {
    return {
      triage: 'stop_and_refund',
      confidence: 'high',
      source: 'rules',
      reason: `A charge was taken${dateOfDeath ? ` after the date of death (${dateOfDeath})` : ''}: refund it back to the estate.`,
    };
  }
  return {
    triage: 'stop_and_refund',
    confidence: 'medium',
    source: 'rules',
    reason: 'Personal recurring payment with no shared use or contract flag: stop it, and refund any post-death charge.',
  };
}

// --- Document cross-check (deterministic, auditable) -------------------------------
// Each document is read on its own, then the facts are compared with each other and with
// the seeded Legacy Mandate. Any mismatch or missing fact blocks execution. This runs the
// same with or without an AI key; it is the check the portal displays, never a fixed claim.

export type ParsedDocument = { deceased?: string; dateOfDeath?: string; executor?: string };
export type Mandate = { deceased_name: string; executor_name: string; signed?: string };
export type TrustCheck = {
  id: 'death-date' | 'deceased' | 'executor' | 'ai-reading';
  label: string;
  pass: boolean;
  detail: string;
  // ai-reading only: the model that read the documents, or why it could not run (then the check is skipped).
  model?: string;
  skipped?: boolean;
};

const MONTHS = 'January|February|March|April|May|June|July|August|September|October|November|December';
// Name words are joined by spaces/tabs only, never a line break, so the next line's first
// word ("Date of death…") is not read as part of the name.
const NAME = "([A-Z][A-Za-zÀ-ÿ'’-]+(?:[ \\t]+[A-Z][A-Za-zÀ-ÿ'’-]+)+)";

function findDate(text: string): string | undefined {
  const iso = text.match(/(20\d{2})-(\d{1,2})-(\d{1,2})/);
  const long = text.match(new RegExp(`(\\d{1,2}) (${MONTHS}) (20\\d{2})`, 'i'));
  const m = iso ?? long;
  return m ? normalizeDate(m) : undefined;
}

export function parseDocument(text: string): ParsedDocument {
  const deceased =
    text.match(new RegExp(`Deceased[ \\t]*:[ \\t]*${NAME}`))?.[1] ??
    text.match(new RegExp(`estate of[ \\t]+${NAME}`, 'i'))?.[1];
  const executor = text.match(new RegExp(`Executor[^:\\n]*:[ \\t]*${NAME}`, 'i'))?.[1];
  // Prefer a date on a "death"/"deceased" line; fall back to the first date in the text.
  const deathLine = text.split('\n').find((l) => /death|deceased|overlijden|décès|deces/i.test(l) && findDate(l));
  return { deceased, executor, dateOfDeath: deathLine ? findDate(deathLine) : findDate(text) };
}

const same = (a?: string, b?: string) =>
  Boolean(a && b && a.replace(/\s+/g, ' ').trim().toLowerCase() === b.replace(/\s+/g, ' ').trim().toLowerCase());

/**
 * The same document gate /api/estate/analyze applies, for re-checking on the server before any
 * PayPal action. No text at all means the fictional demo documents, exactly as analyze reads it.
 */
/** Longest document text accepted, so a padded text cannot slow the AI reading into a skip. */
export const MAX_DOC_CHARS = 6000;

export async function documentsVerified(docs: { certificateText?: string; notaryText?: string } | undefined, mandate: Mandate): Promise<boolean> {
  const empty = !docs?.certificateText?.trim() && !docs?.notaryText?.trim();
  const { certificateText, notaryText } = empty ? demoDocuments() : { certificateText: docs?.certificateText ?? '', notaryText: docs?.notaryText ?? '' };
  if (certificateText.length > MAX_DOC_CHARS || notaryText.length > MAX_DOC_CHARS) return false;
  const certificate = parseDocument(certificateText);
  const notary = parseDocument(notaryText);
  if (!crossCheck(certificate, notary, mandate).every((c) => c.pass)) return false;
  // The AI second reading that opened the case must still agree (cached, so usually instant).
  return (await secondReadingCheck(certificateText, notaryText, { certificate, notary })).pass;
}

/**
 * The AI second reading as a check. Differences and unusable answers hold the case. Only when
 * the model cannot be reached at all (no key, OpenAI error, 15 s timeout) is the check marked
 * "not run" and the rules decide alone, so the portal keeps working when OpenAI is down.
 */
export async function secondReadingCheck(certificateText: string, notaryText: string, rules: { certificate: ParsedDocument; notary: ParsedDocument }): Promise<TrustCheck> {
  if (!aiEnabled()) return skippedReading('No AI key is configured on this server');
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      readDocumentFacts(certificateText, notaryText).then((r) => compareReadings(rules, r)),
      new Promise<TrustCheck>((resolve) => {
        timer = setTimeout(() => resolve(skippedReading('The AI did not answer within 15 seconds')), 15_000);
      }),
    ]);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (e instanceof UnusableAnswer) {
      return { id: 'ai-reading', label: 'The AI second reading could not be used: held for a person to check', pass: false, detail: `${message}.` };
    }
    console.warn(`[AI] second reading unavailable: ${message}`);
    return skippedReading('The AI could not be reached this time');
  } finally {
    clearTimeout(timer);
  }
}

// --- Second reading: rules vs AI ------------------------------------------------------
const normName = (v?: string) =>
  (v ?? '')
    .replace(/\([^)]*\)/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z' -]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

/**
 * Compare the rules' reading of each document with the AI's own reading, fact by fact.
 * Any difference fails the check, so the case is held for a person to look at.
 */
export function compareReadings(rules: { certificate: ParsedDocument; notary: ParsedDocument }, ai: SecondReading): TrustCheck {
  const facts: { doc: 'certificate' | 'notary'; label: string; field: keyof FactReading; name: boolean }[] = [
    { doc: 'certificate', label: "The certificate's name of the deceased", field: 'deceased', name: true },
    { doc: 'certificate', label: "The certificate's date of death", field: 'dateOfDeath', name: false },
    { doc: 'notary', label: "The notary act's name of the deceased", field: 'deceased', name: true },
    { doc: 'notary', label: "The notary act's date of death", field: 'dateOfDeath', name: false },
    { doc: 'notary', label: "The notary act's executor", field: 'executor', name: true },
  ];
  const differences = facts
    .map((f) => {
      const r = rules[f.doc][f.field];
      const a = ai[f.doc][f.field];
      const agree = f.name ? normName(r) === normName(a) && Boolean(normName(r)) : Boolean(r) && r === a;
      if (agree) return null;
      if (!r) return `${f.label} could not be read automatically; the AI read ${a ?? 'nothing either'}`;
      if (!a) return `${f.label} was read as ${r}; the AI could not find it`;
      return `${f.label} was read as ${r}, but the AI read ${a}`;
    })
    .filter((d): d is string => Boolean(d));
  return {
    id: 'ai-reading',
    label: differences.length ? 'A second reading by AI found a difference: held for a person to check' : 'A second reading by AI agrees with the rules',
    pass: differences.length === 0,
    detail: differences.length
      ? `${differences.join('. ')}. Held for a person to check.`
      : `The AI read ${ai.certificate.from === 'scan' && ai.notary.from === 'scan' ? 'both uploaded files' : 'both documents'} separately and found the same ${facts.length} facts: names, date of death and executor.`,
    model: ai.model,
  };
}

export function skippedReading(reason: string): TrustCheck {
  return {
    id: 'ai-reading',
    label: 'Second reading by AI not run',
    pass: true,
    skipped: true,
    detail: `${reason}. The rules' reading above decides on its own.`,
  };
}

export function crossCheck(certificate: ParsedDocument, notary: ParsedDocument, mandate: Mandate): TrustCheck[] {
  const show = (v?: string) => v ?? 'not found';
  return [
    {
      id: 'death-date',
      label: 'Certificate and notary act give the same date of death',
      pass: Boolean(certificate.dateOfDeath && certificate.dateOfDeath === notary.dateOfDeath),
      detail: `Certificate: ${show(certificate.dateOfDeath)} · Notary act: ${show(notary.dateOfDeath)}`,
    },
    {
      id: 'deceased',
      label: 'Both documents name the person on the Legacy Mandate',
      pass: same(certificate.deceased, mandate.deceased_name) && same(notary.deceased, mandate.deceased_name),
      detail: `Certificate: ${show(certificate.deceased)} · Notary act: ${show(notary.deceased)} · Mandate: ${mandate.deceased_name}`,
    },
    {
      id: 'executor',
      label: 'Notary act names the executor from the Legacy Mandate',
      pass: same(notary.executor, mandate.executor_name),
      detail: `Notary act: ${show(notary.executor)} · Mandate: ${mandate.executor_name}`,
    },
  ];
}
