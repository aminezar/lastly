# Lastly

When someone dies, their PayPal subscriptions keep charging. Lastly is for the person they chose to settle their affairs. It stops those charges and refunds the ones taken after the death to the card they came from. It hands a shared subscription over to the surviving partner and writes the letter for a merchant with a contract. Then it pays the recovered money to the heir.

![The executor's plan for Jean Dupont's estate: pause StreamFlix, hand FamilyCloud over to the family, send FitGym a formal notice, refund the €9.99 charged after his death](docs/portal-plan.png)

We built it for the PayPal AI Hackathon. It runs on the PayPal Sandbox only, and every person in it is fictional.

**Live demo: https://heirloom-vxgl.onrender.com/estate**

It runs on Render's free plan, so the first load after a quiet spell can take about a minute.

## Try it

1. Click **Open the demo case**. You're Marie Dupont, the executor her father Jean named before he died.
2. In each upload box, click **Download a sample PDF**, then upload it. The samples are scans with no text layer, so the AI has to read the page itself.
3. Read the ledger. Each payment has a decision and a reason. Approve it, and the actions run against PayPal Sandbox. Each row shows the PayPal ID that comes back.
4. Finish with **Print the report for the notary**.

The hosted demo resets the estate for each visitor. It pauses subscriptions instead of cancelling them, so the next judge finds the same case.

## What happens to each payment

| Demo estate | Lastly's decision | In PayPal |
|---|---|---|
| StreamFlix, charged €9.99 after the date of death | Stop and refund | Subscription paused or cancelled; capture refunded to the original card |
| FamilyCloud, shared with the household | Keep for the family | New subscription on the same plan, for the partner to approve |
| FitGym, under contract | Formal notice | No payment is stopped; AI writes the bereavement letter to the merchant |
| Money recovered | Paid to the heir | One payout per refund, only to the heir account on file |

## Where the AI is used

The AI (OpenAI `gpt-5.4-mini`) reads the uploaded documents. It then reads them a second time on its own and explains each decision. It also writes the merchant letter.

The AI doesn't decide anything. The rules in `lib/estate.ts` check that the death certificate, the notary act and the mandate Jean signed all agree on five facts, and they decide what happens to each payment. The executor approves every PayPal action. If the AI's second reading differs from the rules on any of the five facts, the case is held for a person to check. If OpenAI can't be reached, the screen says the check did not run, and the rules decide on their own.

## We attacked it

We ran 21 attacks against the hosted demo, and all 21 were stopped. They included changed dates, a different executor, a court correction buried in the text, and hidden instructions to the AI inside scanned documents. We also sent requests straight to the money routes, and the server refused them before any PayPal call. Both genuine cases, typed and scanned, still opened. The first hosted run had one transient 502 while reading a scan, which we counted as a failure. The rerun was clean.

Two results we didn't expect:

- A court correction of the date, and an addendum replacing the executor, both got past the rules. The AI's second reading held both.
- A faint hidden line on a scan made the AI write 20 October where the page says 2 October, and the rules passed it. The second reading, done on the original file, read 2 October and held the case.

The full table is in [`docs/red-team-results.md`](docs/red-team-results.md). You can rerun it yourself. It only calls the AI and the rule checks, and touches nothing in PayPal:

```bash
BASE=https://heirloom-vxgl.onrender.com node scripts/red-team/run.mjs
```

## What we got wrong along the way

- The first portal showed "Documents agree" and "Matches the mandate" without comparing anything. Now each document is read on its own and checked against the other and the mandate, and the server checks again before every PayPal call.
- The payout route paid any receiver any amount. Now it pays only the heir account on file, and never more than the refunds PayPal confirms as completed.
- A retried click could pay out twice, because request IDs came from `Date.now()`. Each payout batch ID now comes from the refund it pays out, so PayPal rejects a repeat.
- Payouts never worked from the portal. We sent `currency_code`, which is the Orders field name, where Payouts expects `currency`. Our earlier successful payouts had all come from scripts.
- "Charged after death" was hard-coded and never compared with the date of death.
- The first handover created a one-off checkout, which takes nothing over. It's now a new subscription on the same plan, and we say plainly that it isn't a transfer.
- We share one Sandbox with a teammate, and a charge we'd seeded got refunded by someone else in the middle of a test. The portal correctly showed "Already refunded". The hosted demo now re-creates the charge for each visitor.

## What it doesn't do

- **It can't spot a good forgery.** Someone who knows the names on the mandate could type documents that match, and they would pass. That's why money only goes to two places, both fixed in code: refunds go back to the original payment source, and the payout goes only to the heir account on file, once per refund.
- **The estate is seeded.** PayPal's Subscriptions and Transaction Search APIs only show a merchant its own data. The demo subscriptions are set up under our Sandbox business app, and Lastly reads them by ID. It can't list anyone's subscriptions with third parties.
- **The merchant facts are seeded too.** "Shared with the household" and "under contract" come from notes in `data/seed-estate.json`, not from PayPal. In production those would come from the merchant or from the executor.
- **The post-death charge is staged.** It's a Sandbox order paid with PayPal's test card. The hosted demo re-creates it after it has been refunded.
- **Handover isn't a transfer.** The partner approves a new subscription. The old one keeps running until then.
- **Only PayPal could run this for real.** One Sandbox business account plays all three merchants. One personal account plays both Jean and the heir. That's why we present Lastly as a feature PayPal could build, not as a third-party app.
- **The executor's authority is simulated.** The mandate is seeded data. In production it would need real legal or notary verification.

## Run it locally

You need Node 20.9 or later and a PayPal Sandbox REST app with Transaction Search enabled.

```bash
npm install
cp .env.example .env.local     # add your Sandbox PAYPAL_CLIENT_ID and PAYPAL_SECRET
node scripts/paypal-smoke.mjs  # checks the credentials
npm run dev                    # http://localhost:3000/estate
```

`scripts/test-estate-api.mjs` runs the API contract tests. `scripts/test-estate-flow.mjs` runs the full money flow against Sandbox, and `scripts/reset-estate.mjs` puts the estate back afterwards. Credentials stay in `.env.local` and never reach the browser.

## Built with

PayPal Sandbox REST APIs (Subscriptions, Orders, Refunds, Payouts) · AG Grid for the estate ledger · Next.js 16 / React 19 / TypeScript · OpenAI Responses API · Render

The project started from the official PayPal × AG Grid hackathon boilerplate. Its dashboard at `/dashboard` is unchanged, except that its AI assistant is switched off on the public demo.

MIT licence, see [`LICENSE`](LICENSE).
