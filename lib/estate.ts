// Lastly shared server logic: document extraction, triage rules, and action types.
// Server-only. The AI is used for document reading and per-case reasons when a key is
// configured; the triage decision itself follows explicit rules so the outcome is
// deterministic and auditable whether or not a model is available.

import { openAiKey } from '@/lib/ai';

export type Triage = 'stop_and_refund' | 'keep_for_family' | 'formal_notice_only';

export type TriageDecision = {
  triage: Triage;
  confidence: 'high' | 'medium';
  source: 'ai' | 'rules';
  reason: string;
  // True when the rules found nothing to do (e.g. a charge taken before the date of death).
  noAction?: boolean;
};

export type DocumentExtraction = {
  deceased_name?: string;
  date_of_death?: string; // YYYY-MM-DD
  executor_name?: string;
  heirs?: { name?: string; share_pct?: number }[];
  source: 'ai' | 'demo-documents';
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

function extractDemo(): DocumentExtraction {
  return {
    deceased_name: 'Jean Dupont (fictional)',
    date_of_death: '2026-10-20',
    executor_name: 'Marie Dupont',
    heirs: [{ name: 'Marie Dupont', share_pct: 50 }, { name: 'Luc Dupont', share_pct: 50 }],
    source: 'demo-documents',
  };
}

// Minimal text extraction for uploaded .txt/.md/.json files. PDF/image OCR is not
// claimed: if an upload cannot be parsed as text we fall back to the demo documents
// and say so in the response (never silently).
export async function extractDocuments(input: {
  certificateText?: string;
  notaryText?: string;
}): Promise<DocumentExtraction> {
  const cert = (input.certificateText ?? '').trim();
  const notary = (input.notaryText ?? '').trim();
  if (!cert && !notary) return extractDemo();

  const key = openAiKey();
  if (!key) {
    // Deterministic fallback so the demo works without an AI key.
    const all = `${cert}\n${notary}`;
    const date = all.match(/(20\d{2})[-/](\d{1,2})[-/](\d{1,2})/) ?? all.match(/(\d{1,2}) (January|February|March|April|May|June|July|August|September|October|November|December) (20\d{2})/i);
    const parsed = date ? normalizeDate(date) : undefined;
    return {
      date_of_death: parsed ?? '2026-10-20',
      source: 'demo-documents',
    };
  }

  try {
    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.HEIRLOOM_AI_MODEL || 'gpt-5.4-mini',
        input: [
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text:
                  'Extract JSON only. Schema: {"deceased_name":string|null,"date_of_death":"YYYY-MM-DD"|null,"executor_name":string|null,"heirs":[{"name":string,"share_pct":number}]}\n\nCERTIFICATE:\n' +
                  cert +
                  '\n\nNOTARY ACT:\n' +
                  notary,
              },
            ],
          },
        ],
        max_output_tokens: 800,
      }),
    });
    if (!res.ok) {
      // Log why (status + OpenAI's error message, never the key) so a silent fallback is debuggable.
      const err = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string } };
      console.warn(`[AI] document reading fell back to rules: OpenAI ${res.status} ${err.error?.code ?? ''} ${err.error?.message ?? ''}`.trim());
      return extractDemo();
    }
    const data = (await res.json()) as { output_text?: string; output?: { content?: { text?: string }[] }[] };
    const text = data.output_text ?? data.output?.flatMap((o) => o.content ?? []).map((c) => c.text ?? '').join('') ?? '';
    const json = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)) as Omit<DocumentExtraction, 'source'>;
    return { ...json, source: 'ai' };
  } catch (error) {
    console.warn(`[AI] document reading fell back to rules: ${error instanceof Error ? error.message : String(error)}`);
    return extractDemo();
  }
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
    reason: 'Personal recurring payment with no shared use or contract flag: cancel it, and refund any post-death charge.',
  };
}

// --- Document cross-check (deterministic, auditable) -------------------------------
// Each document is read on its own, then the facts are compared with each other and with
// the seeded Legacy Mandate. Any mismatch or missing fact blocks execution. This runs the
// same with or without an AI key; it is the check the portal displays, never a fixed claim.

export type ParsedDocument = { deceased?: string; dateOfDeath?: string; executor?: string };
export type Mandate = { deceased_name: string; executor_name: string; signed?: string };
export type TrustCheck = { id: 'death-date' | 'deceased' | 'executor'; label: string; pass: boolean; detail: string };

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
export function documentsVerified(docs: { certificateText?: string; notaryText?: string } | undefined, mandate: Mandate): boolean {
  const empty = !docs?.certificateText?.trim() && !docs?.notaryText?.trim();
  const { certificateText, notaryText } = empty ? demoDocuments() : { certificateText: docs?.certificateText ?? '', notaryText: docs?.notaryText ?? '' };
  return crossCheck(parseDocument(certificateText), parseDocument(notaryText), mandate).every((c) => c.pass);
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
