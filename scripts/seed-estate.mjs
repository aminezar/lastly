#!/usr/bin/env node
// Creates a FRESH demo estate in PayPal Sandbox and prints buyer-approval links.
// It never deletes anything: old cancelled/refunded entities stay as history.
//
// Usage:
//   node scripts/seed-estate.mjs          # create product+plan+subscription+order, print links
//   (open each printed approve link, log in as the Sandbox PERSONAL buyer, approve)
//   node scripts/seed-estate.mjs --status # re-check statuses and print approve links again
//
// After approval, run --capture to create the refundable post-death capture, then
// the executor demo can cancel/refund for real. IDs are written to
// data/seed-estate.json under sandbox_ids.pending_demo.
import { readFileSync, writeFileSync } from 'node:fs';
import { loadEnvLocal, call, token } from './_paypal-env.mjs';

loadEnvLocal();
const tok = await token();
const seedPath = 'data/seed-estate.json';
const seed = JSON.parse(readFileSync(seedPath, 'utf8'));
const mode = process.argv[2] ?? 'create';
const stamp = new Date().toISOString().slice(0, 10).replaceAll('-', '');
const returnUrl = 'https://example.com/heirloom/approved';
const cancelUrl = 'https://example.com/heirloom/cancelled';

function approveLink(links = []) {
  return links.find((l) => l.rel === 'approve')?.href;
}

async function writePending(patch) {
  seed.sandbox_ids.pending_demo = { ...(seed.sandbox_ids.pending_demo ?? {}), ...patch };
  writeFileSync(seedPath, JSON.stringify(seed, null, 2) + '\n');
}

if (mode === '--status') {
  const p = seed.sandbox_ids.pending_demo;
  if (!p?.subscription_ids || !p?.order_ids) throw new Error('No pending_demo estate. Run seed first.');
  for (const [key, id] of Object.entries(p.subscription_ids)) {
    const sub = await call(tok, 'GET', `/v1/billing/subscriptions/${id}`);
    console.log(`${key}: ${id} status=${sub.status} approve=${approveLink(sub.links) ?? '-'}`);
  }
  for (const [key, id] of Object.entries(p.order_ids)) {
    const order = await call(tok, 'GET', `/v2/checkout/orders/${id}`);
    console.log(`${key}: ${id} status=${order.status} approve=${approveLink(order.links) ?? '-'}`);
  }
  process.exit(0);
}

if (mode === '--capture') {
  const p = seed.sandbox_ids.pending_demo;
  if (!p?.order_ids?.['post-death-charge']) throw new Error('No pending post-death order.');
  const orderId = p.order_ids['post-death-charge'];
  const order = await call(tok, 'GET', `/v2/checkout/orders/${orderId}`);
  if (order.status !== 'APPROVED') throw new Error(`Order ${orderId} is ${order.status}; approve it in the browser first.`);
  const captured = await call(tok, 'POST', `/v2/checkout/orders/${orderId}/capture`, {});
  const capture = captured.purchase_units?.[0]?.payments?.captures?.[0];
  await writePending({
    order_ids: { ...p.order_ids, 'post-death-charge': `${orderId} (COMPLETED)` },
    capture_ids: { 'post-death-charge': `${capture.id} (COMPLETED ${capture.amount?.value} ${capture.amount?.currency_code})` },
  });
  console.log(`captured: ${capture.id} ${capture.status} ${capture.amount?.value} ${capture.amount?.currency_code}`);
  console.log('Pending demo estate is now executable: subscription ACTIVE + capture COMPLETED.');
  process.exit(0);
}

const items = [
  { key: 'streaming', name: 'StreamFlix (fictional)', amount: '9.99' },
  { key: 'family-cloud', name: 'FamilyCloud (fictional)', amount: '12.00' },
  { key: 'gym', name: 'FitGym (fictional)', amount: '39.00' },
];
const products = {};
const plans = {};
const subs = {};
for (const item of items) {
  const product = await call(tok, 'POST', '/v1/catalogs/products', { name: item.name, type: 'SERVICE', category: 'SOFTWARE' });
  const plan = await call(tok, 'POST', '/v1/billing/plans', {
    product_id: product.id,
    name: `${item.name} Monthly`,
    status: 'ACTIVE',
    billing_cycles: [{ frequency: { interval_unit: 'MONTH', interval_count: 1 }, tenure_type: 'REGULAR', sequence: 1, total_cycles: 0, pricing_scheme: { fixed_price: { value: item.amount, currency_code: 'EUR' } } }],
    payment_preferences: { auto_bill_outstanding: true, setup_fee_failure_action: 'CONTINUE', payment_failure_threshold: 3 },
  });
  const sub = await call(tok, 'POST', '/v1/billing/subscriptions', {
    plan_id: plan.id,
    custom_id: `heirloom-${item.key}-${stamp}`,
    application_context: { return_url: returnUrl, cancel_url: cancelUrl, user_action: 'SUBSCRIBE_NOW' },
  });
  products[item.key] = product.id;
  plans[item.key] = plan.id;
  subs[item.key] = sub.id;
  console.log(`\n${item.key}: product=${product.id} plan=${plan.id} subscription=${sub.id} (${sub.status})`);
  console.log(`APPROVE ${item.key}: ${approveLink(sub.links)}`);
}
const order = await call(tok, 'POST', '/v2/checkout/orders', {
  intent: 'CAPTURE',
  purchase_units: [{ reference_id: 'heirloom-post-death-charge', custom_id: `heirloom-post-death-charge-${stamp}`, amount: { currency_code: 'EUR', value: '9.99' }, description: 'StreamFlix charge after date of death (fictional)' }],
  application_context: { return_url: returnUrl, cancel_url: cancelUrl, user_action: 'PAY_NOW' },
});
await writePending({
  note: `Created ${new Date().toISOString()}. Approve each link as the Sandbox personal buyer, then run --capture. Old entities are never deleted.`,
  product_ids: products,
  plan_ids: plans,
  subscription_ids: subs,
  order_ids: { 'post-death-charge': order.id },
});
console.log(`\npost-death-charge: order=${order.id} (${order.status})`);
console.log(`APPROVE post-death-charge: ${approveLink(order.links)}`);
console.log('\nNext: approve all 4 links as the Sandbox PERSONAL buyer, then: node scripts/seed-estate.mjs --status && node scripts/seed-estate.mjs --capture');
