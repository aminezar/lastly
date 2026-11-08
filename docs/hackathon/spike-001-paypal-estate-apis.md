# 001: PayPal Estate APIs (Heirloom)

## Question
Given a PayPal sandbox account, when Heirloom needs to (1) read transactions/subscriptions, (2) cancel a subscription, (3) refund a post-death charge, (4) create a family handover order, and (5) pay out the estate balance to heirs, then each action maps to a real, documented sandbox endpoint reachable today.

## What was checked
- Cloned official boilerplate `paypaldev/hackathon-paypal-ag-grid-boilerplate` (Next.js + plain-fetch PayPal client in `lib/paypal.ts`, AG Studio dashboard). Verified `lib/paypal.ts` covers Transaction Search + balances; env needs `PAYPAL_CLIENT_ID` / `PAYPAL_SECRET`.
- Read `@paypal/paypal-server-sdk` v2.3.0/2.5.0 controller docs (Orders, Payments, Subscriptions, Transaction-Search, Vault).
- Live probe against `https://api-m.sandbox.paypal.com` with no/bogus credentials (probe.mjs, probe2.mjs): every target route returned 401 AUTHENTICATION_FAILURE (route exists, auth required), not 404.

## Endpoint map (verified)
| Need | Endpoint | In server SDK? |
|---|---|---|
| Read activity | `GET /v1/reporting/transactions`, `GET /v1/reporting/balances` | Yes (TransactionSearch) |
| List/get subscriptions | `GET /v1/billing/subscriptions`, `GET /v1/billing/subscriptions/{id}` | Yes (Subscriptions) |
| Cancel subscription | `POST /v1/billing/subscriptions/{id}/cancel` {reason} -> 204 | Yes: cancelSubscription |
| Refund post-death charge | `POST /v2/payments/captures/{capture_id}/refund` (empty {} = full, amount = partial) | Yes: refundCapturedPayment |
| Family handover | `POST /v2/checkout/orders` (CAPTURE) | Yes (Orders) |
| Payout to heirs | `POST /v1/payments/payouts`, `GET /v1/payments/payouts/{id}` | **No — raw fetch only** (SDK has no Payouts controller) |

## Verdict: PARTIAL

### What worked
- All 5 routes exist on sandbox and reject unauthenticated calls with 401 (proves routing, not a dead path).
- Official AG Grid boilerplate is real and reusable; saves the AG Studio wiring.
- Cancel + refund + orders are typed SDK methods; payouts documented with batch/idempotency (`sender_batch_id`, `PayPal-Request-Id`).

### What didn't / not proven
- No PayPal sandbox credentials on this machine, so no live create->cancel->refund->payout run was executed. End-to-end money movement is UNPROVEN until credentials exist (Day-1 task, per Notion risk list).
- Payouts requires hand-written fetch (like boilerplate's lib/paypal.ts pattern), not the SDK.

### Surprises
- `GET /v1/payments/payouts` returns 404 unauthenticated because payouts is POST-create + GET-by-id only; not a bug.
- Refunds always return to the original payment source — this is the anti-fraud property Heirloom relies on (a forged certificate cannot redirect a refund).

### Recommendation for the real build
- Fork the AG Grid boilerplate; extend its `lib/paypal.ts` fetch client with cancel/refund/payouts instead of adding the SDK for only 3 calls (one client, one auth path). Use the APIMatic Context Plugin while writing those calls and document it for the APIMatic prize.
- Seed data honestly: subscriptions the demo cancels must be subscriptions created under the sandbox merchant/business app (PayPal subscriptions API is merchant-scoped). Label seeded estate data as seeded in README.
- First build task: get sandbox credentials, run one live cancel + one live refund + one live payout, record IDs.
