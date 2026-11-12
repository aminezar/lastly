# 001: PayPal Estate APIs (Lastly)

## Question
Given a PayPal sandbox account, when Lastly needs to (1) read transactions/subscriptions, (2) cancel a subscription, (3) refund a post-death charge, (4) create a family handover order, and (5) pay out the estate balance to heirs, then each action maps to a real, documented sandbox endpoint reachable today.

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

## Verdict: VALIDATED (Nov 8, 2026)

### Live Sandbox Verification (Nov 8, 2026)
- **Business account:** `68ZD46FA4UJQ8` (`sb-jt9zn53786252@business.example.com`, EUR 5,000.00 balance)
- **Personal buyer account:** `TFSL7HRTHXGTQ` (`sb-rz3k653741808@personal.example.com`)
- **Subscription create + approve + cancel:** Product `PROD-2EY69267NY327020F`, Plan `P-31T101149C984542GNLYHESY`, Subscription `I-41J2NEJVN16N` (`ACTIVE` -> `POST /v1/billing/subscriptions/I-41J2NEJVN16N/cancel` -> `204 No Content`, verified `CANCELLED` at `2026-11-08T13:22:33Z`). Note: cancelling an `APPROVAL_PENDING` subscription returns `404 RESOURCE_NOT_FOUND`; buyer approval to `ACTIVE` is required before cancel.
- **Order create + approve + capture + refund:** Order `89V37027MX014502L` (`APPROVED` -> `POST /v2/checkout/orders/89V37027MX014502L/capture` -> Capture `37W67583TS5206340` `COMPLETED` EUR 9.99 -> `POST /v2/payments/captures/37W67583TS5206340/refund` -> Refund `3LE899970X313934J` `COMPLETED` EUR 9.99).
- **Batch Payout:** `POST /v1/payments/payouts` -> Batch `9YNLGRH6LHK2J` (`SUCCESS`, item `8WYS96EWGD6BN`, transaction `11K76825205999437`, EUR 1.00).

### What worked
- All 5 routes exist on sandbox and were executed end-to-end with real Sandbox credentials and recorded IDs.
- Official AG Grid boilerplate is real and reusable; saves the AG Studio wiring.
- Cancel + refund + orders + payouts all work over the plain fetch client pattern.

### Caveats discovered
- Cancelling a subscription that is still `APPROVAL_PENDING` returns `404 RESOURCE_NOT_FOUND`. Seeded subscriptions for the demo must be buyer-approved to `ACTIVE` first (or the demo can reset/re-create an active one).
- Payouts requires hand-written fetch (like boilerplate's `lib/paypal.ts` pattern), not the SDK.

### Surprises
- `GET /v1/payments/payouts` returns 404 unauthenticated because payouts is POST-create + GET-by-id only; not a bug.
- Refunds always return to the original payment source — this is the anti-fraud property Lastly relies on (a forged certificate cannot redirect a refund).

### Recommendation for the real build
- Fork the AG Grid boilerplate; extend its `lib/paypal.ts` fetch client with cancel/refund/payouts instead of adding the SDK for only 3 calls (one client, one auth path). Use the APIMatic Context Plugin while writing those calls and document it for the APIMatic prize.
- Seed data honestly: subscriptions the demo cancels must be subscriptions created under the sandbox merchant/business app (PayPal subscriptions API is merchant-scoped). Label seeded estate data as seeded in README.
- First build task: get sandbox credentials, run one live cancel + one live refund + one live payout, record IDs.
