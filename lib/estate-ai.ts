// Lastly AI helpers (server-only): where a model does real work on the documents and letters.
//   1. writeNoticeLetter — writes the formal bereavement notice for one contract-bound
//      merchant from the verified case facts.
//   2. transcribeDocument — reads an uploaded PDF or photo of a document and returns its
//      text, which then goes through the same deterministic cross-check as typed text.
//   3. readDocumentFacts — a second, independent reading of both documents, compared fact by
//      fact with the rules' reading; any difference holds the case for a person.
// (The plan review in lib/estate-review.ts explains each payment's decision.)
// The AI never approves anything: triage and the document check stay rule-based, and the AI
// can only hold a case, never open one. Every result carries the model name so the portal can
// label it; on any failure we throw and the caller says so (never a fake AI result).

import { createHash } from 'node:crypto';
import { openAiKey } from '@/lib/ai';

const MODEL = () => process.env.HEIRLOOM_AI_MODEL || 'gpt-5.4-mini';

type ResponsesOutput = { output_text?: string; output?: { content?: { type?: string; text?: string }[] }[] };

async function respond(content: unknown[], maxTokens: number, instructions: string): Promise<{ text: string; model: string }> {
  const key = openAiKey();
  if (!key) throw new Error('No OpenAI key is configured');
  const model = MODEL();
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, instructions, input: [{ role: 'user', content }], max_output_tokens: maxTokens }),
  });
  if (!res.ok) {
    // Status + OpenAI's own message only, never the key.
    const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(`OpenAI ${res.status}${err.error?.message ? `: ${err.error.message}` : ''}`);
  }
  const data = (await res.json()) as ResponsesOutput;
  const text = (
    data.output_text ??
    data.output?.flatMap((o) => o.content ?? []).filter((c) => c.type === 'output_text').map((c) => c.text ?? '').join('') ??
    ''
  ).trim();
  if (!text) throw new Error('The model returned no text');
  return { text, model };
}

// --- 1. Bereavement letter -----------------------------------------------------------------

export type NoticeFacts = {
  merchant: string;
  merchantNote?: string; // what Lastly knows about the service (e.g. "Contract-bound")
  subscriptionId?: string;
  amount?: string; // "29.00 EUR"
  nextBillingAt?: string;
  deceasedName: string;
  dateOfDeath: string; // YYYY-MM-DD, already verified against both documents
  executorName: string;
};

const LETTER_INSTRUCTIONS = [
  'You write formal bereavement notices that an estate executor sends to a merchant.',
  'Write in plain, warm, professional English. 170 to 260 words. Plain text only: no markdown, no placeholders in brackets, no subject line other than the "Re:" line.',
  'Start with "To: <merchant> member services" then a "Re:" line naming the account holder and the PayPal subscription ID if given, then a greeting such as "Dear <merchant> member services team,". Open by saying the writer is the appointed executor. Keep dates in the form given.',
  'The service is bound by a contract, so the executor must NOT simply stop paying (that would create estate debt). Ask the merchant to: end the contract as of the date of death under its bereavement or death clause; confirm in writing any amount still owed or refund any fee collected after the date of death; send further correspondence to the executor.',
  'Mention that a death certificate and the notary act of heredity can be provided on request. Mention the next scheduled payment date if given, and ask that it not be collected.',
  'Use only the facts given. Never invent account numbers, addresses, amounts, clause numbers or legal citations.',
  'Sign off with the executor name and "Executor of the estate of <deceased>".',
].join('\n');

const longDate = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export async function writeNoticeLetter(f: NoticeFacts): Promise<{ text: string; model: string }> {
  const facts = [
    `Merchant: ${f.merchant}`,
    f.merchantNote && `What we know about this service: ${f.merchantNote}`,
    f.subscriptionId && `PayPal subscription ID: ${f.subscriptionId}`,
    f.amount && `Recurring amount: ${f.amount}`,
    f.nextBillingAt && `Next scheduled payment: ${longDate(f.nextBillingAt)}`,
    `Account holder (deceased): ${f.deceasedName}`,
    `Date of death (verified): ${longDate(f.dateOfDeath)}`,
    `Executor: ${f.executorName}`,
  ]
    .filter(Boolean)
    .join('\n');
  return respond([{ type: 'input_text', text: `Write the notice from these facts.\n\n${facts}` }], 900, LETTER_INSTRUCTIONS);
}

// --- 2. Document reading -------------------------------------------------------------------

export const READABLE_TYPES: Record<string, 'pdf' | 'image'> = {
  'application/pdf': 'pdf',
  'image/png': 'image',
  'image/jpeg': 'image',
  'image/webp': 'image',
};

const READ_INSTRUCTIONS = [
  'You transcribe official civil documents (death certificates, notary acts) for an estate executor.',
  'Return the document text faithfully, line by line, in its original language(s). Plain text only, no commentary, no markdown.',
  'After the transcription, add these lines in English, filled only from what the document says (write "not stated" when absent):',
  'Deceased: <full name>',
  'Date of death: <D Month YYYY>',
  'Executor: <full name>',
  'Do not correct, complete or guess any name or date.',
].join('\n');

export async function transcribeDocument(file: { name: string; type: string; base64: string }): Promise<{ text: string; model: string }> {
  const kind = READABLE_TYPES[file.type];
  if (!kind) throw new Error(`Unsupported file type ${file.type || 'unknown'}`);
  const dataUrl = `data:${file.type};base64,${file.base64}`;
  const part = kind === 'pdf' ? { type: 'input_file', filename: file.name, file_data: dataUrl } : { type: 'input_image', image_url: dataUrl };
  return respond([part, { type: 'input_text', text: 'Transcribe this document.' }], 2000, READ_INSTRUCTIONS);
}

// --- 3. Second reading of the documents ----------------------------------------------------
// The rules read each document with fixed patterns (lib/estate.ts parseDocument). The model
// reads the same two texts on its own, and the portal compares both readings fact by fact.
// Any difference holds the case for a person to check. The AI can only stop a case this way,
// never open one: when it is unavailable, the rules' reading stands and the portal says so.

export type FactReading = { deceased?: string; dateOfDeath?: string; executor?: string };
export type SecondReading = { certificate: FactReading; notary: FactReading; model: string };

const SECOND_READ_INSTRUCTIONS = [
  'You check estate documents for an executor. You get the text of a death certificate and of a notary act of heredity.',
  'Read each document on its own and report only what that document itself states. Never fill a fact from the other document, never guess or correct.',
  'Names: the full name as written, without titles, roles or remarks in brackets. Dates: YYYY-MM-DD. Use null when the document does not state the fact.',
  'The death certificate has no executor: always null there.',
  'Answer with JSON only: {"certificate":{"deceased":...,"dateOfDeath":...,"executor":null},"notary":{"deceased":...,"dateOfDeath":...,"executor":...}}',
].join('\n');

const readings = new Map<string, Promise<SecondReading>>();
const settled = new Map<string, SecondReading>();
const docsKey = (cert: string, notary: string) => createHash('sha256').update(`${cert.trim()}\u0000${notary.trim()}`).digest('hex');

const clean = (v: unknown) => (typeof v === 'string' && v.trim() && v.trim().toLowerCase() !== 'null' ? v.trim() : undefined);
const facts = (v: unknown): FactReading => {
  const o = (v ?? {}) as Record<string, unknown>;
  return { deceased: clean(o.deceased), dateOfDeath: clean(o.dateOfDeath), executor: clean(o.executor) };
};

/** The model's own reading of both documents. Same texts, same answer: cached per server. */
export function readDocumentFacts(certificateText: string, notaryText: string): Promise<SecondReading> {
  const id = docsKey(certificateText, notaryText);
  let pending = readings.get(id);
  if (!pending) {
    pending = respond(
      [{ type: 'input_text', text: `DEATH CERTIFICATE:\n${certificateText.trim()}\n\nNOTARY ACT:\n${notaryText.trim()}` }],
      600,
      SECOND_READ_INSTRUCTIONS,
    ).then(({ text, model }) => {
      const json = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)) as Record<string, unknown>;
      const reading = { certificate: facts(json.certificate), notary: facts(json.notary), model };
      settled.set(id, reading);
      return reading;
    });
    readings.set(id, pending);
    pending.catch(() => readings.delete(id));
  }
  return pending;
}

/** The second reading already made for these documents on this server, if any. */
export function settledReading(certificateText: string, notaryText: string): SecondReading | undefined {
  return settled.get(docsKey(certificateText, notaryText));
}
