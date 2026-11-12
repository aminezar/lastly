# Lastly

![Lastly in 30 seconds: Marie adds her father Jean's death certificate and notary act, AI reads them, rules check they agree, she approves the plan, PayPal Sandbox pauses StreamFlix, returns the €9.99 taken after he died, hands FamilyCloud to the family, and a letter for the family is written](docs/stages/lastly-stages.gif)

The whole case in 30 seconds, from the documents to the letter for the family.

When someone dies, their PayPal subscriptions keep charging. Lastly is for the person they chose to settle their affairs. It stops those charges and refunds the ones taken after the death to the card they came from. It hands a shared subscription over to the surviving partner and writes the letter for a merchant with a contract. Then it pays the recovered money to the heir.

![The executor's plan for Jean Dupont's estate: pause StreamFlix, hand FamilyCloud over to the family, write to FitGym to end the contract, refund the €9.99 charged after his death](docs/portal-plan.png)

We built it for the PayPal AI Hackathon. It runs on the PayPal Sandbox only, and every person in it is fictional.

**Live demo: https://lastly-rdeo.onrender.com/estate**

It runs on Render's free plan, so the first load after a quiet spell can take about a minute.

## For judges: where to find each thing you score

| Criterion | What we did | Check it in under a minute |
|---|---|---|
| Technological Implementation | The running app calls 10 PayPal Sandbox endpoints (table below), and each write has its own idempotency key. The AI reads the documents, reads them again on its own, explains each decision and writes the merchant letter. | Open the demo case and approve. Each ledger row shows the ID PayPal returns. Code: [`lib/paypal.ts`](lib/paypal.ts) and [`app/api/estate/execute/route.ts`](app/api/estate/execute/route.ts). Run any attack against the live checks on [Try to cheat it](https://lastly-rdeo.onrender.com/try-to-cheat-it). |
| Design | One flow from sign-in to the report for the notary, written for someone a few weeks after a death. | [Try it](#try-it) (four steps) and [Writing for someone grieving](docs/writing-for-someone-grieving.md). |
| Potential Impact | Charges that keep running after a death, refunded to source, and a family subscription handed over instead of lost. We also say what only PayPal could do for real. | [What happens to each payment](#what-happens-to-each-payment) and [What it doesn't do](#what-it-doesnt-do). |
| Innovation/Idea | A mandate signed while alive decides who can act, and money has only two exits fixed in code: the original card and the heir on file. The AI can hold a case but never open one. | [The diagram](#where-the-ai-is-used), [Every rule has a reason](docs/every-rule-has-a-reason.md) and the [red-team results](docs/red-team-results.md) (21 of 21 attacks stopped). Try them yourself on [Try to cheat it](https://lastly-rdeo.onrender.com/try-to-cheat-it). |
| Presentation | A video under 3 minutes and a short deck. | The video is linked on our Devpost page. The deck is at https://lastly-rdeo.onrender.com/pitch. |

**PayPal APIs the app calls**

| Endpoint | What Lastly does with it | Where |
|---|---|---|
| `POST /v1/oauth2/token` | One cached server-side token for every call | [`paypal.ts:27`](https://github.com/aminezar/lastly/blob/9406fa9f8c460307edf16b0b072e443236ee6023/lib/paypal.ts#L27) |
| `GET /v1/billing/subscriptions/{id}` | Reads each subscription's status, amount and billing dates | [`paypal.ts:279`](https://github.com/aminezar/lastly/blob/9406fa9f8c460307edf16b0b072e443236ee6023/lib/paypal.ts#L279) |
| `POST /v1/billing/subscriptions/{id}/suspend` | Pauses a charge (the default stop, and it can be undone) | [`paypal.ts:290`](https://github.com/aminezar/lastly/blob/9406fa9f8c460307edf16b0b072e443236ee6023/lib/paypal.ts#L290) |
| `POST /v1/billing/subscriptions/{id}/cancel` | Stops it for good, after a second confirmation (off on the public demo) | [`paypal.ts:284`](https://github.com/aminezar/lastly/blob/9406fa9f8c460307edf16b0b072e443236ee6023/lib/paypal.ts#L284) |
| `POST /v1/billing/subscriptions` | Handover: a new subscription on the same plan for the partner to approve | [`paypal.ts:326`](https://github.com/aminezar/lastly/blob/9406fa9f8c460307edf16b0b072e443236ee6023/lib/paypal.ts#L326) |
| `GET /v2/payments/captures/{id}` | Confirms the post-death charge, its amount and its date | [`paypal.ts:386`](https://github.com/aminezar/lastly/blob/9406fa9f8c460307edf16b0b072e443236ee6023/lib/paypal.ts#L386) |
| `POST /v2/payments/captures/{id}/refund` | Refunds that charge to its original payment source | [`paypal.ts:382`](https://github.com/aminezar/lastly/blob/9406fa9f8c460307edf16b0b072e443236ee6023/lib/paypal.ts#L382) |
| `GET /v2/payments/refunds/{id}` | Confirms the refund completed before anything is paid out | [`paypal.ts:392`](https://github.com/aminezar/lastly/blob/9406fa9f8c460307edf16b0b072e443236ee6023/lib/paypal.ts#L392) |
| `POST /v1/payments/payouts`, `GET /v1/payments/payouts/{id}` | Pays each refund to the heir on file, then checks until it's delivered | [`paypal.ts:404`](https://github.com/aminezar/lastly/blob/9406fa9f8c460307edf16b0b072e443236ee6023/lib/paypal.ts#L404) |
| `GET /v1/reporting/balances` | Shows the account balance on the case overview | [`paypal.ts:250`](https://github.com/aminezar/lastly/blob/9406fa9f8c460307edf16b0b072e443236ee6023/lib/paypal.ts#L250) |

On the public demo, the app also re-activates paused subscriptions and creates a fresh post-death charge with PayPal's test card (Subscriptions `activate` and Orders), so every visitor gets the same case ([`lib/demo-mode.ts`](lib/demo-mode.ts)). The ledger is AG Grid ([`app/estate/ledger.tsx`](app/estate/ledger.tsx)), and the demo runs on Render ([`render.yaml`](render.yaml)).

## Try it

1. Click **Continue as Marie**. You're Marie Dupont, the executor her father Jean named before he died.
2. Click **Open the demo case**. It fills in both documents and runs the same checks.
   To watch the AI read a scan instead, use the upload boxes: click **Download a sample PDF** in each, then upload it. The samples have no text layer, so the AI has to read the page itself.
3. Read the ledger. Each payment has a decision and a reason. Approve it, and the actions run against PayPal Sandbox. Each row shows the PayPal ID that comes back.
4. Finish with **Print the report for the notary**.

The hosted demo resets the estate for each visitor. It pauses subscriptions instead of cancelling them, so the next judge finds the same case.

## What happens to each payment

| Demo estate | Lastly's decision | In PayPal |
|---|---|---|
| StreamFlix, charged €9.99 after the date of death | Stop and refund | Subscription paused or cancelled; capture refunded to the original card |
| FamilyCloud, shared with the household | Keep for the family | New subscription on the same plan, for the partner to approve |
| FitGym, under contract | Write to end the contract | No payment is stopped; AI writes the bereavement letter to the merchant |
| Money recovered | Paid to the heir | One payout per refund, only to the heir account on file |

## Where the AI is used

The AI (OpenAI `gpt-5.4-mini`) reads the uploaded documents. It then reads them a second time on its own and explains each decision. It also writes the merchant letter.

The AI doesn't decide anything. The rules in `lib/estate.ts` check that the death certificate, the notary act and the mandate Jean signed all agree on five facts, and they decide what happens to each payment. The executor approves every PayPal action. If the AI's second reading differs from the rules on any of the five facts, the case is held for a person to check. If OpenAI can't be reached, the screen says the check did not run, and the rules decide on their own.

```mermaid
flowchart LR
  E([Executor]) -->|death certificate + notary act| AI[AI reads the documents]
  AI --> R[Rules: documents agree<br/>with each other and the mandate]
  AI -. second reading: any difference holds the case .-> R
  R -->|plan for each payment| OK([Executor approves])
  OK --> S[Subscriptions API<br/>pause, cancel, or a new one for the partner]
  OK --> RF[Payments API<br/>refund to the original card only]
  RF --> PO[Payouts API<br/>to the heir on file only, once per refund]
  OK -. any other receiver or amount .-x X[Refused by the server]
```

## We attacked it

We ran 21 attacks against the hosted demo, and all 21 were stopped. They included changed dates, a different executor, a court correction buried in the text, and hidden instructions to the AI inside scanned documents. We also sent requests straight to the money routes, and the server refused them before any PayPal call. Both genuine cases, typed and scanned, still opened. The first hosted run had one transient 502 while reading a scan, which we counted as a failure. The rerun was clean.

**Try the attacks yourself: https://lastly-rdeo.onrender.com/try-to-cheat-it.** The page runs each attack against the live document checks, with the real AI reading and no PayPal call. It also includes the two genuine cases, a forgery that matches every fact (it opens, which is the limit described below), and a box for your own documents.

Two results we didn't expect:

- A court correction of the date, and an addendum replacing the executor, both got past the rules. The AI's second reading held both.
- A faint hidden line on a scan made the AI write 20 October where the page says 2 October, and the rules passed it. The second reading, done on the original file, read 2 October and held the case.

The full table is in [`docs/red-team-results.md`](docs/red-team-results.md). Each safety rule, the attack it stops, and the line of code that enforces it are in [Every rule has a reason](docs/every-rule-has-a-reason.md). You can rerun the attacks yourself. It only calls the AI and the rule checks, and touches nothing in PayPal:

```bash
BASE=https://lastly-rdeo.onrender.com node scripts/red-team/run.mjs
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

The AI parts need an OpenAI key: add `OPENAI_API_KEY` to `.env.local`. Without one, **Open the demo case** and **Use demo document** still work, and the rules run on their own. Uploading a PDF or photo needs the key, because only the AI can read it.

`scripts/test-estate-api.mjs` runs the API contract tests. `scripts/test-estate-flow.mjs` runs the full money flow against Sandbox, and `scripts/reset-estate.mjs` puts the estate back afterwards. Credentials stay in `.env.local` and never reach the browser.

## Built with

PayPal Sandbox REST APIs (Subscriptions, Orders, Refunds, Payouts) · AG Grid for the estate ledger · Next.js 16 / React 19 / TypeScript · OpenAI Responses API · Render

The project started from the official PayPal × AG Grid hackathon boilerplate. Its dashboard at `/dashboard` is still there for local use. On the hosted demo it redirects to the portal.

MIT licence, see [`LICENSE`](LICENSE).
