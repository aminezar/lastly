// Shared helpers for the plain-Node seed scripts in this folder.
// The app itself uses lib/paypal.ts (TypeScript). Scripts run with `node` and
// cannot import .ts, so they load .env.local and call the same REST endpoints
// directly. Keep endpoint shapes in sync with lib/paypal.ts.
import { readFileSync, existsSync } from 'node:fs';

export function loadEnvLocal() {
  if (!existsSync('.env.local')) return;
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

export const BASE = 'https://api-m.sandbox.paypal.com';

export async function token() {
  const { PAYPAL_CLIENT_ID, PAYPAL_SECRET } = process.env;
  if (!PAYPAL_CLIENT_ID || !PAYPAL_SECRET) {
    throw new Error('Missing PAYPAL_CLIENT_ID / PAYPAL_SECRET in .env.local');
  }
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error(`OAuth failed ${res.status}: ${await res.text()}`);
  return (await res.json()).access_token;
}

export async function call(accessToken, method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': `heirloom-seed-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = {};
  try { json = text ? JSON.parse(text) : {}; } catch { /* keep raw below */ }
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 400)}`);
  return json;
}
