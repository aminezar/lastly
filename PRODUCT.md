# Lastly — Product Spec

**Tagline:** Nobody should keep paying after they're gone.

## Problem
After a death, recurring PayPal payments keep charging someone who is gone. Refunds for post-death charges go unclaimed, the balance sits locked, and families contact every merchant by hand during grief.

## User
The pre-authorized family executor / next-of-kin. Not a merchant, not PayPal support.

## Pitch (Devpost opening)
Lastly is an Estate Resolution Portal. The executor uploads a death certificate + notary act; Lastly checks them against the Legacy Mandate, reads each recurring payment from PayPal, sorts it with explicit rules, and executes the approved actions live in PayPal Sandbox (pause or cancel, refund to source, family handover), then pays the recovered money to the heir in the notary act with a notary-ready audit report.

**AI reads and writes, rules decide.** AI (OpenAI `gpt-5.4-mini`, Responses API) transcribes uploaded PDFs and photos, explains each payment's decision and flags concerns for a human, and writes the bereavement letter for contract-bound merchants. The document check and the triage are rules (`lib/estate.ts`); the executor approves every PayPal action.

## Trust model
1. **Legacy Mandate:** while alive, user names a Trusted Executor (Apple Legacy Contact model). Only that person can start a case.
2. **Document cross-check:** rules read name / date of death / executor from the death certificate and the notary act of heredity (AI transcribes them first when they are PDFs or photos), and compare both docs with each other and with the mandate. Mismatch = stop, in the UI and again on the server before every PayPal action. This proves consistency, not authenticity.
3. **Refund-to-source:** PayPal refunds only return to original payment source (estate), never to uploader. A forged PDF cannot redirect money.
4. **Gated payout:** final balance → pre-named / notary-verified heirs only, after wind-down. Demo: Sandbox payout to Sandbox heir accounts.
5. **Honest limit:** production executor authority is legal/notary verification. Demo simulates it (seeded mandate + docs) and says so in README.

## Demo flow (video, <3 min)
1. Executor opens case: seeded mandate + upload death certificate + notary act (sample scans in `public/samples/`). AI transcribes them; rules find the date of death, **Oct 20, 2026**, in both and match them to the mandate.
2. Lastly reads the estate's seeded Sandbox subscriptions and the post-death capture by ID; rules use the charge date and the seeded merchant notes (shared household, contract-bound).
3. **AG Grid Estate Ledger** shows the rules' decision for each item, with an AI explanation beside it:
   - **Stop & Refund** — cancel + clawback refund for post-death charges
   - **Keep for Family** — handover link to surviving partner
   - **Formal Notice Only** — AI drafts bereavement letter (stopping payment alone would create estate debt)
4. Executor approves → live Sandbox calls: pause (public demo) or cancel, refund, handover subscription. Ledger rows flip live. *This flip is the video moment.*
5. Recovered refunds → Payouts to the heir account (each refund paid out once, in its own batch). Downloadable audit report: action, amount, PayPal ID, timestamp.

## Seed estate (exactly this, no more)
| Item | Type | Expected triage |
|---|---|---|
| Streaming subscription | Sandbox subscription | Stop & Refund (charged after Oct 20) |
| Family cloud / household service | Sandbox subscription | Keep for Family (handover) |
| Gym / contract-bound service | Sandbox subscription | Formal Notice Only (letter) |
| One extra post-death charge | Capture | Refund |

Deceased: fictional. Executor: fictional son/daughter. Heirs: 2 Sandbox personal accounts.

## PayPal API map (all in `lib/paypal.ts`, run live against Sandbox)
- Read: `GET /v1/reporting/balances`, `GET /v1/billing/subscriptions/{id}`, `GET /v2/payments/captures/{id}`, `GET /v2/payments/refunds/{id}` (`GET /v1/reporting/transactions` is in the client and the smoke script, not in the estate flow)
- Pause / resume / cancel: `POST /v1/billing/subscriptions/{id}/suspend|activate|cancel`
- Refund: `POST /v2/payments/captures/{capture_id}/refund` (to the original source only)
- Handover: `POST /v1/billing/subscriptions` (new subscription on the same plan for the family member to approve)
- Payout: `POST /v1/payments/payouts`, `GET /v1/payments/payouts/{id}` (no SDK controller; fetch)
- Base: `https://api-m.sandbox.paypal.com`. Boilerplate client: `lib/paypal.ts` (plain fetch, token cache, retries).

## Prize targets
Primary: Most Impactful, Best Use of PayPal + AI. Hedge: AG Grid, APIMatic. Render = hosting only. Max 1 sponsor + 1 main prize per project.

## Non-goals / cut list
No Bryntum unless ledger done early. No real notary registry. No multi-estate. No live (non-Sandbox) anything. No consumer "list someone's Netflix" claim — Subscriptions API is merchant-scoped; demo data is seeded under our Sandbox business app and labelled seeded.

## Risks
Merchant-scoped APIs (state in README). Payouts must be enabled/funded on Sandbox business account — verify today; fallback = clearly-labelled simulated step, never faked response. AG Studio trial must survive judging Dec 1–15.
