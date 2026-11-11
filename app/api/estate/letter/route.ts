// Lastly API: AI-written formal bereavement notice for one contract-bound merchant.
// POST /api/estate/letter { merchant, merchantNote?, subscriptionId?, amount?, nextBillingAt?,
//                           deceasedName, dateOfDeath, executorName }
// → { ok: true, letter, model, source: 'ai' } or { ok: false, error } (503 when no AI key).
// Nothing is sent: the executor reviews the letter and sends it. No PayPal call.
import { NextResponse } from 'next/server';
import { aiEnabled } from '@/lib/ai';
import { writeNoticeLetter, type NoticeFacts } from '@/lib/estate-ai';

const str = (v: unknown, max = 200) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const facts: Partial<NoticeFacts> = {
    merchant: str(body.merchant),
    merchantNote: str(body.merchantNote, 400),
    subscriptionId: str(body.subscriptionId, 40),
    amount: str(body.amount, 40),
    nextBillingAt: str(body.nextBillingAt, 40),
    deceasedName: str(body.deceasedName),
    dateOfDeath: str(body.dateOfDeath, 10),
    executorName: str(body.executorName),
  };
  if (!facts.merchant || !facts.deceasedName || !facts.dateOfDeath || !facts.executorName) {
    return NextResponse.json({ ok: false, error: 'merchant, deceasedName, dateOfDeath and executorName are required' }, { status: 400 });
  }
  if (!aiEnabled()) return NextResponse.json({ ok: false, error: 'AI is not configured' }, { status: 503 });
  try {
    const { text, model } = await writeNoticeLetter(facts as NoticeFacts);
    return NextResponse.json({ ok: true, letter: text, model, source: 'ai', at: new Date().toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[AI] letter for ${facts.merchant} failed: ${message}`);
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
