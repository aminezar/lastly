# Heirloom — Nobody should keep paying after they're gone

**PayPal AI Hackathon — Build What's Next with PayPal and AI** (deadline Nov 12, 2026)

After a death, recurring PayPal payments keep charging a person who is gone, refunds for post-death charges go unclaimed, and the balance sits locked while families contact every merchant by hand. Heirloom is an Estate Resolution Portal for the pre-authorized family executor: upload the death certificate and notary act, and an AI agent reads the date of death, scans the PayPal activity, and triages every recurring payment into **Stop & Refund**, **Keep for Family**, or **Formal Notice Only**. Approved actions execute live in PayPal Sandbox — cancel, refund, handover — and the recovered net balance pays out to the verified heirs with a notary-ready audit report.

Full product spec: [`PRODUCT.md`](PRODUCT.md) · Hackathon facts: [`docs/hackathon/HACKATHON.md`](docs/hackathon/HACKATHON.md)

## Run locally

Requires Node 20.9+ and a PayPal Sandbox REST app ([developer.paypal.com](https://developer.paypal.com/dashboard/applications/sandbox)) with Transaction Search enabled.

```bash
npm install
cp .env.example .env.local   # fill in PAYPAL_CLIENT_ID / PAYPAL_SECRET (Sandbox)
node scripts/paypal-smoke.mjs   # verify credentials before building
npm run dev                     # http://localhost:3000/heirloom

node scripts/test-estate-api.mjs     # 26 contract tests (read-only / rejected before PayPal)
node scripts/test-estate-flow.mjs    # live Sandbox money flow (refund, payout, handover); rehearsal only
node scripts/reset-estate.mjs        # after a rehearsal: re-activate paused subs + fresh capture
```

Credentials live only in `.env.local` (gitignored) and never leave the server.

## Honest limits (read this, judges)

- PayPal's Subscriptions and Transaction Search APIs are **merchant-scoped**. The demo estate is **seeded under our Sandbox business app** and labelled seeded. Heirloom does not claim a consumer API that lists anyone's third-party subscriptions.
- Executor authority is **simulated**: a seeded Legacy Mandate (named while alive) + AI cross-check of death certificate × notary act. Production requires real notary/legal verification.
- PayPal refunds return only to the original payment source — that real behaviour is the anti-fraud core: a forged upload cannot redirect money.
- If Sandbox Payouts is unavailable on the test account, that step is labelled simulated in the UI. No PayPal response is ever faked.
- **Who plays whom in the Sandbox.** One Sandbox business account plays every merchant (StreamFlix, FamilyCloud, FitGym): refunds come from it and the heir payout is sent from it. One Sandbox personal account plays the deceased's payer account and also receives the heir payout (it is the only real Sandbox personal account; the `heirs[]` emails are placeholders). In production only PayPal itself could act across merchants like this, so Heirloom is presented as a bereavement feature PayPal could build, not a third-party app.
- **Document check is rules, not magic.** The portal reads the death certificate and the notary act separately and compares deceased, date of death and executor with each other and with the seeded Legacy Mandate. Any mismatch blocks the case. With no AI key configured, this runs on plain-text rules and the UI says so.
- **Payout guard.** The server only pays the recorded heir account, never more than the refunds PayPal confirms as completed, and derives the payout ID from those refunds so the same money can never be paid out twice.
- **Family handover** creates a new subscription on the same plan for the family member to approve; the deceased's subscription keeps running until then. It is not a transfer of the original subscription.

## Tools used

PayPal Sandbox REST API · AG Grid (the Estate Ledger in the executor portal, `app/heirloom/ledger.tsx`) · Next.js / React / TypeScript · AI document extraction + triage · Render (hosting)

Built on the official `paypaldev/hackathon-paypal-ag-grid-boilerplate`. Its AG Studio dashboard at `/dashboard` is kept as it came from the boilerplate; the Heirloom portal itself uses AG Grid.

## Licence

MIT — see [`LICENSE`](LICENSE). Boilerplate base © its authors (PayPal/AG Grid hackathon boilerplate).
