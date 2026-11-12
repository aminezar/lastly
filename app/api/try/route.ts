// "Try to cheat it": run one built-in attack against the portal's real document checks.
// GET  /api/try                 → { ok, attacks: AttackCard[] }  (latest result of each, no AI call)
// POST /api/try { id, live? }   → { ok, result, cached }
// The latest result of each attack is kept and returned; live: true asks for a fresh run, which is
// rate-limited. Nothing here calls PayPal (lib/try-attacks.ts).
import { NextResponse } from 'next/server';
import { attackCards, Limited, runAttack } from '@/lib/try-attacks';

export async function GET() {
  return NextResponse.json({ ok: true, attacks: attackCards() });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { id?: unknown; live?: unknown };
  if (typeof body.id !== 'string') return NextResponse.json({ ok: false, error: 'Send the id of an attack' }, { status: 400 });
  try {
    const { result, cached } = await runAttack(body.id, body.live === true, request);
    return NextResponse.json({ ok: true, result, cached });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: error instanceof Limited ? 429 : message === 'Unknown attack' ? 404 : 502 });
  }
}
