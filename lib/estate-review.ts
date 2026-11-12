// Lastly AI plan review (server-only). After the rules triage each payment, a model reads
// the same PayPal facts and the rule's decision, and writes a short explanation for the
// executor of why that action fits. It also says whether the facts support the decision;
// when they don't, the portal shows its concern for a human to check. The AI never changes
// the decision: the rules stay the single source of truth, and money only moves on approval.
// On any failure this throws, and the portal falls back to the rule's own reason, labelled.

import { createHash } from 'node:crypto';
import { openAiKey } from '@/lib/ai';
import { setting } from '@/lib/env';

const MODEL = () => setting('AI_MODEL') || 'gpt-5.4-mini';

export type ReviewItem = {
  key: string;
  merchant: string;
  kind: 'subscription' | 'one-off charge';
  plannedAction: string;
  ruleReason: string;
  paypalStatus?: string;
  amount?: string;
  chargedAt?: string;
  nextBillingAt?: string;
  noAction?: boolean;
};

export type ReviewNote = { key: string; explanation: string; agrees: boolean; concern?: string };
export type PlanReview = { notes: ReviewNote[]; model: string };

const INSTRUCTIONS = `You review an estate-resolution plan for the executor of a deceased person's PayPal account.
Each item is one recurring payment or charge, with facts read from PayPal and the action a deterministic rule chose:
- "Stop and refund": personal payment; stop it and return any charge taken after the date of death.
- "Keep for the family": shared household service; hand billing over to a surviving family member.
- "Formal notice": contract-bound service; stopping payment alone would create estate debt, so a bereavement letter is sent first.
For each item, write "explanation": at most 28 words, plain and kind, for the executor. Lead with the deciding fact, then what the action achieves. Write money as "€9.99" and dates as "11 Dec". Do not start with "You should" or restate the action's name. If a next billing date is given, say what would happen on it without action. When you mention a charge date, keep it apart from the date of death so it cannot be read as the day of death, e.g. "Charged €9.99 on 12 Nov, after the death on 20 Oct". No legal advice, no invented facts, no IDs. The reader is grieving: never write "the deceased" or "the account holder" (say "after the death"), no exclamation marks, nothing that sounds like a sale or a celebration.
Example: "Billed €9.99 a month for one person, next on 11 Dec. Pausing stops that charge, and any charge after the date of death goes back to the estate."
Set "agrees" to false only if the facts given clearly contradict the chosen action, and then give a one-sentence "concern". Otherwise "agrees": true and no concern.
Answer with JSON only: {"notes":[{"key":"...","explanation":"...","agrees":true}]}, one note per item, same keys.`;

// Same case, same answer: re-opening the case (or a second render) does not call the model again.
const cache = new Map<string, Promise<PlanReview>>();

export function reviewPlan(items: ReviewItem[], dateOfDeath?: string): Promise<PlanReview> {
  const payload = JSON.stringify({ dateOfDeath, items });
  const id = createHash('sha256').update(payload).digest('hex');
  let pending = cache.get(id);
  if (!pending) {
    pending = callModel(payload, items);
    cache.set(id, pending);
    pending.catch(() => cache.delete(id));
  }
  return pending;
}

async function callModel(payload: string, items: ReviewItem[]): Promise<PlanReview> {
  const key = openAiKey();
  if (!key) throw new Error('No OpenAI key is configured');
  const model = MODEL();
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, instructions: INSTRUCTIONS, input: payload, max_output_tokens: 1200 }),
  });
  if (!res.ok) {
    // Status + OpenAI's own message only, never the key.
    const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(`OpenAI ${res.status}${err.error?.message ? `: ${err.error.message}` : ''}`);
  }
  const data = (await res.json()) as { output_text?: string; output?: { content?: { type?: string; text?: string }[] }[] };
  const text =
    data.output_text ??
    data.output?.flatMap((o) => o.content ?? []).filter((c) => c.type === 'output_text').map((c) => c.text ?? '').join('') ??
    '';
  const parsed = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)) as { notes?: Partial<ReviewNote>[] };
  const keys = new Set(items.map((i) => i.key));
  const notes = (parsed.notes ?? [])
    .filter((n): n is ReviewNote => typeof n.key === 'string' && keys.has(n.key) && typeof n.explanation === 'string' && n.explanation.trim() !== '')
    .map((n) => ({ key: n.key, explanation: n.explanation.trim(), agrees: n.agrees !== false, concern: n.agrees === false ? n.concern?.trim() : undefined }));
  if (notes.length === 0) throw new Error('The model returned no usable notes');
  return { notes, model };
}
