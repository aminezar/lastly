#!/usr/bin/env node
// Zero-click demo seeds — no browser approval, ever.
//
//   node scripts/seed-capture.mjs   Create a COMPLETED post-death capture instantly
//                                   (PayPal Sandbox test card, one API call) and
//                                   store its ID in data/seed-estate.json.
//   node scripts/reset-estate.mjs   Re-activate SUSPENDED seeded subscriptions and
//                                   seed a fresh capture. Run after any rehearsal.
//
// Why: orders accept payment_source.card in Sandbox and complete immediately.
// Subscriptions cannot (Belgian merchant: MERCHANT_COUNTRY_NOT_ENABLED_FOR_CARD_PAYMENTS),
// so subscriptions are seeded once with browser approval and then rehearsed with
// suspend/activate, which cycles forever. Captures are disposable: refund anytime,
// reseed in one call with no clicks.
import { readFileSync, writeFileSync } from 'node:fs';
import { loadEnvLocal, call, token } from './_paypal-env.mjs';

loadEnvLocal();
const tok = await token();
const seedPath = 'data/seed-estate.json';
const seed = JSON.parse(readFileSync(seedPath, 'utf8'));

const order = await call(tok, 'POST', '/v2/checkout/orders', {
  intent: 'CAPTURE',
  purchase_units: [
    {
      reference_id: 'lastly-post-death-charge',
      custom_id: 'lastly-post-death-charge',
      amount: { currency_code: 'EUR', value: '9.99' },
      description: 'StreamFlix charge after date of death (fictional)',
    },
  ],
  // Official PayPal Sandbox test card: completes instantly, no buyer login.
  payment_source: {
    card: {
      name: 'Jean Dupont',
      number: '4032039932256235',
      expiry: '2029-12',
      security_code: '123',
      billing_address: { address_line_1: 'Rue de la Loi 16', admin_area_2: 'Brussels', postal_code: '1000', country_code: 'BE' },
    },
  },
});
const capture = order.purchase_units?.[0]?.payments?.captures?.[0];
if (!capture?.id) throw new Error(`Auto-capture failed: order status ${order.status}`);
seed.sandbox_ids.pending_demo = {
  ...(seed.sandbox_ids.pending_demo ?? {}),
  capture_ids: { 'post-death-charge': `${capture.id} (COMPLETED 9.99 EUR, zero-click card seed)` },
  last_zero_click_capture: { order_id: order.id, capture_id: capture.id, at: new Date().toISOString() },
};
writeFileSync(seedPath, JSON.stringify(seed, null, 2) + '\n');
console.log(`zero-click capture: order=${order.id} capture=${capture.id} ${capture.status} 9.99 EUR`);
console.log('Stored in data/seed-estate.json -> sandbox_ids.pending_demo.capture_ids');
