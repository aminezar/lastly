#!/usr/bin/env node
// Heirloom Sandbox smoke test — proves credentials + which PayPal flows actually work.
// Usage: cp .env.example .env.local (fill values) && node scripts/paypal-smoke.mjs
// Reads PAYPAL_CLIENT_ID / PAYPAL_SECRET from .env.local or environment. Never prints secrets.
import { readFileSync, existsSync } from 'node:fs';

if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
const BASE = 'https://api-m.sandbox.paypal.com';
const { PAYPAL_CLIENT_ID, PAYPAL_SECRET } = process.env;
if (!PAYPAL_CLIENT_ID || !PAYPAL_SECRET) {
  console.error('MISSING CREDS: set PAYPAL_CLIENT_ID and PAYPAL_SECRET in .env.local (developer.paypal.com > Sandbox app).');
  process.exit(2);
}

const tokenRes = await fetch(`${BASE}/v1/oauth2/token`, {
  method: 'POST',
  headers: {
    Authorization: 'Basic ' + Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`).toString('base64'),
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: 'grant_type=client_credentials',
});
if (!tokenRes.ok) {
  console.error('AUTH FAILED', tokenRes.status, (await tokenRes.text()).slice(0, 300));
  process.exit(1);
}
const { access_token } = await tokenRes.json();
console.log('OK auth: token acquired (not printed)');

async function get(path) {
  const r = await fetch(BASE + path, { headers: { Authorization: `Bearer ${access_token}` } });
  const t = await r.text();
  return { status: r.status, body: t.slice(0, 600) };
}

for (const p of ['/v1/reporting/balances', '/v1/billing/subscriptions?page_size=5', '/v1/reporting/transactions?start_date=2026-10-01T00:00:00-0700&end_date=2026-10-31T23:59:59-0700&fields=all']) {
  const r = await get(p);
  console.log(`\nGET ${p.split('?')[0]} -> ${r.status}`);
  console.log(r.body);
}
console.log('\nNext (manual, after seeding): POST cancel /v1/billing/subscriptions/{id}/cancel, POST refund /v2/payments/captures/{id}/refund, POST payout /v1/payments/payouts. Record IDs in data/seed-estate.json.');
