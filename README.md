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
npm run dev                     # http://localhost:3000
```

Credentials live only in `.env.local` (gitignored) and never leave the server.

## Honest limits (read this, judges)

- PayPal's Subscriptions and Transaction Search APIs are **merchant-scoped**. The demo estate is **seeded under our Sandbox business app** and labelled seeded. Heirloom does not claim a consumer API that lists anyone's third-party subscriptions.
- Executor authority is **simulated**: a seeded Legacy Mandate (named while alive) + AI cross-check of death certificate × notary act. Production requires real notary/legal verification.
- PayPal refunds return only to the original payment source — that real behaviour is the anti-fraud core: a forged upload cannot redirect money.
- If Sandbox Payouts is unavailable on the test account, that step is labelled simulated in the UI. No PayPal response is ever faked.

## Tools used

PayPal Sandbox REST API · AG Grid / AG Studio (official `paypaldev/hackathon-paypal-ag-grid-boilerplate` base) · APIMatic (Context Plugin while building PayPal calls) · Next.js / React / TypeScript · AI document extraction + triage · Render (hosting)

## Licence

MIT — see [`LICENSE`](LICENSE). Boilerplate base © its authors (PayPal/AG Grid hackathon boilerplate).
