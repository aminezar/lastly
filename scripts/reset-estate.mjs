#!/usr/bin/env node
// Reset the demo after a rehearsal: re-activate every SUSPENDED seeded
// subscription, then seed a fresh zero-click capture. Subscriptions that are
// CANCELLED cannot be revived — those need `node scripts/seed-estate.mjs`
// (one browser approval round) to recreate. Nothing is deleted here.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { loadEnvLocal, call, token } from './_paypal-env.mjs';

loadEnvLocal();
const tok = await token();
const seed = JSON.parse(readFileSync('data/seed-estate.json', 'utf8'));
const pending = seed.sandbox_ids.pending_demo ?? {};
const subIds = Object.entries(pending.subscription_ids ?? {});

for (const [key, id] of subIds) {
  const sub = await call(tok, 'GET', `/v1/billing/subscriptions/${id}`);
  if (sub.status === 'SUSPENDED') {
    await call(tok, 'POST', `/v1/billing/subscriptions/${id}/activate`, { reason: 'Lastly demo reset' });
    const after = await call(tok, 'GET', `/v1/billing/subscriptions/${id}`);
    console.log(`${key}: ${id} SUSPENDED -> ${after.status}`);
  } else {
    console.log(`${key}: ${id} status=${sub.status} (left as-is)`);
  }
}

const reseed = spawnSync('node', ['scripts/seed-capture.mjs'], { stdio: 'inherit' });
if (reseed.status !== 0) process.exit(reseed.status ?? 1);
console.log('\nDemo reset complete: subscriptions ACTIVE + fresh refundable capture. Zero clicks.');
