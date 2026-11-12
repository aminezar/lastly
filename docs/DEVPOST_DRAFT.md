# Devpost Draft — Lastly (fill in brackets, submit by Nov 10)

## Title
Lastly — Nobody should keep paying after they're gone

## Tagline (short)
Settle a loved one's PayPal life: stop post-death charges, recover refunds, pay heirs — in one guided flow.

## Inspiration
[1 paragraph: recurring payments keep charging after death; families find out months later; every merchant contacted by hand.]

## What it does
Executor (pre-authorized while the account holder was alive) uploads death certificate + notary act. AI (OpenAI gpt-5.4-mini) reads the uploaded PDFs or photos; rules check that both documents agree with each other and with the Legacy Mandate, then sort each recurring payment: Stop & Refund / Keep for Family / Formal Notice Only. AI explains each decision in plain words and flags anything a person should check. AI reads and writes, rules decide, and the executor approves every action. On approval Lastly pauses or cancels subscriptions, refunds post-death charges, creates a handover checkout for family-kept services, has AI write the bereavement letter for contract-bound services, pays the recovered money to the heir named in the notary act, and exports a notary-ready audit report.

## How we built it
Next.js (official PayPal × AG Grid boilerplate), PayPal Sandbox REST via fetch client (`lib/paypal.ts`): Balances, Subscriptions (read, suspend, cancel, create for handover), Captures refund, Payouts, with idempotency keys per action. AG Grid Estate Ledger (`app/heirloom/ledger.tsx`). AI: OpenAI gpt-5.4-mini through the Responses API, server-side only, for three jobs: transcribing uploaded documents, explaining the plan, writing merchant letters. Every AI output is labelled with the model name and has a labelled rule-based fallback. Triage and the document check are deterministic rules. Hosted on Render: https://heirloom-vxgl.onrender.com/heirloom

## Challenges / honest limits
PayPal Subscriptions/Transaction Search are merchant-scoped: demo estate is seeded under our Sandbox business app and labelled seeded. Executor authority is simulated (seeded Legacy Mandate + document cross-check); production needs notary verification. Refund-to-source is real PayPal behaviour and is the anti-fraud core.

## Accomplishments / What's next
[fill after build]

## Tools used
PayPal Sandbox · AG Grid · Render · OpenAI gpt-5.4-mini (Responses API) · Next.js/React/TypeScript

## Try it
Repo: https://github.com/aminezar/lastly · Demo: https://heirloom-vxgl.onrender.com/heirloom (public demo mode: the case resets per visitor, permanent cancel is off; free Render plan, first load may take up to a minute) · Video: [YouTube URL]
Test: [Sandbox instructions; never publish live credentials]

## Video script (<3:00)
0:00 problem (father's card charged after death) → 0:30 executor uploads docs, AI reads them, rules confirm Oct 20 in both → 1:00 ledger sorts 3 subs, AI explains each → 1:45 approve: pause+refund fires, handover sent, letter drafted → 2:30 payout to heirs + audit report → close: tagline.
