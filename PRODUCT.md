# Lastly — Product Spec

**Tagline:** Nobody should keep paying after they're gone.

## Problem
After a death, recurring PayPal payments keep charging someone who is gone. Refunds for post-death charges go unclaimed, the balance sits locked, and families contact every merchant by hand during grief.

## User
The pre-authorized family executor / next-of-kin. Not a merchant, not PayPal support.

## Pitch (Devpost opening)
Lastly is an Estate Resolution Portal. The executor uploads a death certificate + notary act; AI extracts date of death, scans PayPal activity, triages every recurring payment, and executes approved actions live in PayPal Sandbox (cancel, refund, handover), then pays the recovered net balance to verified heirs with a notary-ready audit report.

## Trust model
1. **Legacy Mandate:** while alive, user names a Trusted Executor (Apple Legacy Contact model). Only that person can start a case.
2. **Document cross-check:** AI extracts name / date of death / executor from death certificate + notary act of heredity; cross-checks both docs against each other and the mandate. Mismatch = stop, human review.
3. **Refund-to-source:** PayPal refunds only return to original payment source (estate), never to uploader. A forged PDF cannot redirect money.
4. **Gated payout:** final balance → pre-named / notary-verified heirs only, after wind-down. Demo: Sandbox payout to Sandbox heir accounts.
5. **Honest limit:** production executor authority is legal/notary verification. Demo simulates it (seeded mandate + docs) and says so in README.

## Demo flow (video, <3 min)
1. Executor opens case: seeded mandate + upload death certificate + notary act. AI reads date of death: **Oct 20, 2026**.
2. AI scans Sandbox transactions + subscriptions: flags post-death charges, renewals ≤30 days, shared household, contract-bound.
3. **AG Grid Estate Ledger** triages each item:
   - **Stop & Refund** — cancel + clawback refund for post-death charges
   - **Keep for Family** — handover link to surviving partner
   - **Formal Notice Only** — AI drafts bereavement letter (stopping payment alone would create estate debt)
4. Executor approves → live Sandbox calls: cancel (204), refund, handover order. Ledger rows flip live. *This flip is the video moment.*
5. Net balance (balance + refunds) → Payouts to heirs. Downloadable audit report: action, amount, PayPal ID, timestamp.

## Seed estate (exactly this, no more)
| Item | Type | Expected triage |
|---|---|---|
| Streaming subscription | Sandbox subscription | Stop & Refund (charged after Oct 20) |
| Family cloud / household service | Sandbox subscription | Keep for Family (handover) |
| Gym / contract-bound service | Sandbox subscription | Formal Notice Only (letter) |
| One extra post-death charge | Capture | Refund |

Deceased: fictional. Executor: fictional son/daughter. Heirs: 2 Sandbox personal accounts.

## PayPal API map (Spike 001 verified routes, live run pending)
- Read: `GET /v1/reporting/transactions`, `GET /v1/reporting/balances` — in `lib/paypal.ts` ✅
- Subscriptions list/get: `GET /v1/billing/subscriptions[/{id}]` — to add
- Cancel: `POST /v1/billing/subscriptions/{id}/cancel` {reason} → 204 — to add
- Refund: `POST /v2/payments/captures/{capture_id}/refund` — to add
- Handover: `POST /v2/checkout/orders` CAPTURE — to add
- Payout: `POST /v1/payments/payouts`, `GET /v1/payments/payouts/{id}` (no SDK controller; fetch) — to add
- Base: `https://api-m.sandbox.paypal.com`. Boilerplate client: `lib/paypal.ts` (plain fetch, token cache, retries).

## Prize targets
Primary: Most Impactful, Best Use of PayPal + AI. Hedge: AG Grid, APIMatic. Render = hosting only. Max 1 sponsor + 1 main prize per project.

## Non-goals / cut list
No Bryntum unless ledger done early. No real notary registry. No multi-estate. No live (non-Sandbox) anything. No consumer "list someone's Netflix" claim — Subscriptions API is merchant-scoped; demo data is seeded under our Sandbox business app and labelled seeded.

## Risks
Merchant-scoped APIs (state in README). Payouts must be enabled/funded on Sandbox business account — verify today; fallback = clearly-labelled simulated step, never faked response. AG Studio trial must survive judging Dec 1–15.
