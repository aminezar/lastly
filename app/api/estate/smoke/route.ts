import { NextResponse } from 'next/server';
import { getBalances, listSubscriptions, getSubscription } from '@/lib/paypal';
import { setting } from '@/lib/env';
import { publicDemo } from '@/lib/demo-mode';

export async function GET() {
  // A developer check only: on the public demo it is off, so the Sandbox account details stay private.
  if (publicDemo()) return NextResponse.json({ ok: false, error: 'Not available on the public demo.' }, { status: 404 });
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
