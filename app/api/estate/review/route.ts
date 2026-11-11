// Lastly API: AI review of the plan.
// POST /api/estate/review { items: ReviewItem[], dateOfDeath? }
// Returns one plain-language explanation per payment, written by the model from the PayPal
// facts and the rule's decision, plus any concern for a human to check. Reads and writes
// nothing in PayPal, and never changes a decision.
import { NextResponse } from 'next/server';
import { reviewPlan, type ReviewItem } from '@/lib/estate-review';

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { items?: ReviewItem[]; dateOfDeath?: string };
    const items = (body.items ?? []).slice(0, 20);
    if (items.length === 0) return NextResponse.json({ ok: false, error: 'No items to review' }, { status: 400 });
    const review = await reviewPlan(items, body.dateOfDeath);
    return NextResponse.json({ ok: true, ...review });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[AI] plan review unavailable: ${message}`);
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
