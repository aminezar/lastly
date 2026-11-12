import { NextResponse } from 'next/server';
import { getBalances, listSubscriptions, getSubscription } from '@/lib/paypal';
import { setting } from '@/lib/env';

export async function GET() {
  try {
    const balances = await getBalances();
    const list = await listSubscriptions(10);
    const cancelled = setting('SMOKE_SUBSCRIPTION_ID');
    const detail = cancelled ? await getSubscription(cancelled) : undefined;
    return NextResponse.json({ ok: true, balances, subscriptions: list.subscriptions, detail }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 502 },
    );
  }
}
