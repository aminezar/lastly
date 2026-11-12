// Simple in-memory rate limit for the routes that call OpenAI (server-only).
// Only on the hosted public demo (LASTLY_PUBLIC_DEMO=1): a visitor can run the whole case
// several times, but nobody can drain the AI budget. One demo run makes about 6 such requests.
import { NextResponse } from 'next/server';
import { publicDemo } from '@/lib/demo-mode';

const PER_IP = 40; // requests per IP per window
const WINDOW_MS = 10 * 60_000;
const GLOBAL_PER_HOUR = 600;

const hits = new Map<string, number[]>();
let global: number[] = [];

const clientIp = (request: Request) => request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';

/** A 429 response when this caller is over the limit, otherwise null (and the request is counted). */
export function aiLimited(request: Request): NextResponse | null {
  if (!publicDemo()) return null;
  const now = Date.now();
  global = global.filter((t) => now - t < 3_600_000);
  const ip = clientIp(request);
  const mine = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (mine.length >= PER_IP || global.length >= GLOBAL_PER_HOUR) {
    return NextResponse.json({ ok: false, error: 'Too many AI requests from this demo session. Please wait a few minutes and try again.' }, { status: 429 });
  }
  mine.push(now);
  global.push(now);
  hits.set(ip, mine);
  if (hits.size > 5000) hits.delete(hits.keys().next().value as string);
  return null;
}
