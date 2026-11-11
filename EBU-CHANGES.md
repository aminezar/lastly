# EBU-CHANGES

What changed in the Lastly system, apart from the frontend. Short version; full log in `docs/heirloom-changelog.md`.

## Trust and checks
- **Real document check.** The death certificate and notary act are each read separately. Deceased, date of death and executor must match each other and the Legacy Mandate. Any mismatch blocks the case. Before this, the checks were shown but never actually performed.
- **Nothing filled in silently.** A missing name or date stays empty and blocks the case. It is no longer replaced by "Jean Dupont" or "20 Oct 2026".
- **Legacy Mandate in the data.** `data/seed-estate.json` now holds the mandate (Jean Dupont named Marie Dupont, 3 May 2025, simulated) plus the heirs' names.
- **Charge date checked.** Only charges made on or after the date of death are refunded.

## Money safety (`/api/estate/execute`)
- **Payout only to the heir account**, and never more than the refunds PayPal confirms as completed.
- **No double payouts.** The payout ID is derived from the refunds being paid out, so PayPal itself refuses a second payout of the same money ("already paid out, nothing sent").
- **Retries are safe.** Each run has its own ID, and a repeated click returns the same PayPal result instead of acting twice.
- **Rehearsal by default.** Subscriptions are paused (reversible). Cancelling for good requires an explicit confirmation.
- **One action per call**, so the screen shows each real PayPal ID as it arrives.

## Fixed bugs
- **The payout never worked through the portal.** PayPal's payout API names the currency field `currency`, not `currency_code`.
- **The document reader read across line breaks** ("Jean Dupont Date"), which wrongly blocked correct documents.
- **Payout polling gave up too early.** Sandbox payouts take about 30 s; it now waits up to about 90 s and never reports "delivered" before PayPal says SUCCESS.
- **Fragile subscription lookup.** Subscriptions are now read by their own IDs instead of searching the first 20 in a list.

## Changed functionality
- **Family handover is now a real handover:** a new subscription on the same plan for the family member to approve, instead of a one-off payment.
- **Empty payout explained.** When the charge was already refunded before the case was opened, the screen now says so instead of hiding the payout.

## Tests and tools
- `npm run test:api`: 26 checks covering the document check, blocking and all money guards. All pass.
- `node scripts/test-estate-flow.mjs`: the real Sandbox money flow (refund, payout, double-pay protection, handover, pause). All pass.
- `npm run demo:reset`: resumes paused subscriptions and creates a fresh refundable charge.
- `README.md` honest limits now explain who plays which role in the Sandbox, that the document check runs on rules (no AI key), the payout guard, and what the handover means.

## Still open
- **No AI key yet.** Document reading and the letter are rules and a template; reading PDFs needs AI. Biggest risk for the hackathon requirement.
- **StreamFlix subscription is cancelled.** A new one needs one approval in the browser (`scripts/seed-estate.mjs`).
- **The Sandbox is shared with the teammate.** Agree who tests when, because test charges get refunded by each other.
- **Before submitting:** the repo is private, and the APIMatic claim is unverified.
