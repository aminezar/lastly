# Lastly — Nobody should keep paying after they're gone

**PayPal AI Hackathon — Build What's Next with PayPal and AI** (deadline Nov 12, 2026)

After a death, recurring PayPal payments keep charging a person who is gone, refunds for post-death charges go unclaimed, and the balance sits locked while families contact every merchant by hand. Lastly is an Estate Resolution Portal for the pre-authorized family executor: upload the death certificate and notary act, and Lastly checks them against the Legacy Mandate the account holder signed while alive, reads the estate's subscriptions and post-death charge from PayPal by ID, and sorts each one into **Stop & Refund**, **Keep for Family**, or **Formal Notice Only**. Approved actions execute live in PayPal Sandbox (pause or cancel, refund to source, family handover), and the recovered money is paid out to the heir named in the notary act, with a notary-ready audit report.

**AI reads and writes, rules decide.** AI (OpenAI `gpt-5.4-mini` through the Responses API) does four jobs: it reads uploaded PDFs and photos of the documents; it reads both documents a second time on its own, and any fact where its reading differs from the rules' reading holds the case for a person to check; it explains each payment's decision in plain words and flags anything a person should check; and it writes the formal bereavement letter for contract-bound merchants. Which payments are stopped, refunded or kept, and whether the documents match, is decided by explicit rules in `lib/estate.ts`, and the executor approves every PayPal action. No money moves on a model's say.

Full product spec: [`PRODUCT.md`](PRODUCT.md) · Hackathon facts: [`docs/hackathon/HACKATHON.md`](docs/hackathon/HACKATHON.md)

## Try it

Live demo: **https://heirloom-vxgl.onrender.com/heirloom** (PayPal Sandbox only, fictional people).

The hosted demo runs in public demo mode: when a visitor opens the case, the shared Sandbox estate is put back in its starting state (paused subscriptions re-activated, a fresh post-death charge created if the last one was refunded), and permanent subscription cancel is turned off, so subscriptions are paused instead and the estate stays intact for the next judge.

To see the AI read documents, choose **Download a sample PDF** in each upload box (or take them from [`public/samples/`](public/samples)) and upload them. They are fictional, scan-style specimens with no text layer, so the model has to read the page itself. It is on Render's free plan, so the first load after a quiet period can take up to a minute while the server wakes.

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

- PayPal's Subscriptions and Transaction Search APIs are **merchant-scoped**. The demo estate is **seeded under our Sandbox business app** and labelled seeded. Lastly does not claim a consumer API that lists anyone's third-party subscriptions.
- Executor authority is **simulated**: a seeded Legacy Mandate (named while alive) + a rule-based cross-check of death certificate × notary act. The check proves the documents agree with each other and with the mandate, not that they are authentic. Production requires real notary/legal verification.
- PayPal refunds return only to the original payment source — that real behaviour is the anti-fraud core: a forged upload cannot redirect money.
- If Sandbox Payouts is unavailable on the test account, that step is labelled simulated in the UI. No PayPal response is ever faked.
- **Merchant facts are seeded.** Whether a service is shared with the household or bound by a contract comes from notes in `data/seed-estate.json`, not from PayPal. In production that needs merchant metadata or the executor's confirmation.
- **Who plays whom in the Sandbox.** One Sandbox business account plays every merchant (StreamFlix, FamilyCloud, FitGym): refunds come from it and the heir payout is sent from it. One Sandbox personal account plays the deceased's payer account and also receives the heir payout (it is the only real Sandbox personal account; the `heirs[]` emails are placeholders). In production only PayPal itself could act across merchants like this, so Lastly is presented as a bereavement feature PayPal could build, not a third-party app.
- **Document check is rules, not magic.** The portal reads the death certificate and the notary act separately and compares deceased, date of death and executor with each other and with the seeded Legacy Mandate. Any mismatch blocks the case, in the UI and again on the server before every PayPal action. When a PDF or photo is uploaded, AI transcribes it; the same rules then check the transcript, which the executor can read on screen. Separately, a second AI call reads the facts of each document (for an upload, straight from the original file, not from the transcript), and the portal compares that reading with the rules' reading fact by fact (5 facts). A difference holds the case: for example, a certificate saying "20 October 2026, corrected by court order: the date of death is 2 October 2026" passes the fixed patterns but not the AI. An AI answer that cannot be used (no facts, malformed) also holds the case. Only when OpenAI cannot be reached at all (no key, an error, or no answer within 15 seconds) is the check shown as "not run", and the rules decide alone, so the demo keeps working if OpenAI is down. The AI can hold a case, never open one. Documents are capped at 6,000 characters each, and the AI routes are rate-limited on the public demo.
- **What the document check proves.** It proves that both documents agree with each other and with the mandate. It does not prove they are genuine: someone who knows the names on the mandate could type matching documents. That is why money has only two exits, both fixed in code: refunds go back to the original payment source, and the payout goes only to the heir account recorded for the estate, once per refund.
- **Payout guard.** The server only pays the recorded heir account, only from refunds of this estate's own charges that PayPal confirms as completed, and pays each refund out in its own payout batch whose ID is derived from that refund. PayPal rejects a repeated batch ID, so a refund that was already paid out is skipped, even from a new case run or another browser.
- **The post-death charge is staged.** The refunded €9.99 charge is a separate Sandbox order paid with PayPal's test card and recorded in the seed file (on the hosted demo, re-created when it has been refunded). Lastly reads it by ID; it does not discover it by searching the account's transactions.
- **Family handover** creates a new subscription on the same plan for the family member to approve; the deceased's subscription keeps running until then. It is not a transfer of the original subscription.

## Tools used

PayPal Sandbox REST API · AG Grid (the Estate Ledger in the executor portal, `app/heirloom/ledger.tsx`) · Next.js / React / TypeScript · OpenAI `gpt-5.4-mini` via the Responses API (reads uploaded documents, second-reads them against the rules, explains the plan, writes merchant letters; model set by `HEIRLOOM_AI_MODEL`) · Render (hosting)

Built on the official `paypaldev/hackathon-paypal-ag-grid-boilerplate`. Its AG Studio dashboard at `/dashboard` is kept as it came from the boilerplate, except that on the hosted public demo its free-form AI assistant is off and its OpenAI proxy (`/api/ai/responses`) refuses requests; the Lastly portal itself uses AG Grid.

## Licence

MIT — see [`LICENSE`](LICENSE). Boilerplate base © its authors (PayPal/AG Grid hackathon boilerplate).
