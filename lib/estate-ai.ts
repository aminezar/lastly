// Lastly AI helpers (server-only): the two places a model does real work.
//   1. writeNoticeLetter — writes the formal bereavement notice for one contract-bound
//      merchant from the verified case facts.
//   2. transcribeDocument — reads an uploaded PDF or photo of a document and returns its
//      text, which then goes through the same deterministic cross-check as typed text.
// The AI never decides anything: triage and the document check stay rule-based. Every
// result carries the model name so the portal can label it; on any failure we throw and
// the caller says so (never a fake AI result).

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
