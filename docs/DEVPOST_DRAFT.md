# Devpost Draft — Lastly (fill in brackets, submit by Nov 10)

## Title
Lastly — Nobody should keep paying after they're gone

## Tagline (short)
Settle a loved one's PayPal life: stop post-death charges, recover refunds, pay heirs — in one guided flow.

## Inspiration
[1 paragraph: recurring payments keep charging after death; families find out months later; every merchant contacted by hand.]

## What it does
Executor (pre-authorized while the account holder was alive) uploads death certificate + notary act. AI extracts date of death, scans PayPal Sandbox activity, triages each recurring payment: Stop & Refund / Keep for Family / Formal Notice Only. On approval Lastly cancels subscriptions, refunds post-death charges, creates a handover checkout for family-kept services, drafts bereavement letters for contract-bound services, pays the net estate balance to verified heirs, and exports a notary-ready audit report.

## How we built it
Next.js (official PayPal × AG Grid boilerplate), PayPal Sandbox REST via fetch client (`lib/paypal.ts`): Transaction Search, Subscriptions cancel, Captures refund, Orders, Payouts. AG Grid Estate Ledger (`app/heirloom/ledger.tsx`). AI: [model/tool TBD] for document extraction + triage classification. Hosted on Render: https://heirloom-vxgl.onrender.com/heirloom

## Challenges / honest limits
PayPal Subscriptions/Transaction Search are merchant-scoped: demo estate is seeded under our Sandbox business app and labelled seeded. Executor authority is simulated (seeded Legacy Mandate + document cross-check); production needs notary verification. Refund-to-source is real PayPal behaviour and is the anti-fraud core.

## Accomplishments / What's next
[fill after build]

## Tools used
PayPal Sandbox · AG Grid · Render · [AI model] · Next.js/React/TypeScript

## Try it
Repo: [URL] · Demo: https://heirloom-vxgl.onrender.com/heirloom (public demo mode: the case resets per visitor, permanent cancel is off; free Render plan, first load may take up to a minute) · Video: [YouTube URL]
Test: [Sandbox instructions; never publish live credentials]

## Video script (<3:00)
0:00 problem (father's card charged after death) → 0:30 executor uploads docs, AI reads Oct 20 → 1:00 ledger triages 3 subs → 1:45 approve: cancel+refund fires, handover sent, letter drafted → 2:30 payout to heirs + audit report → close: tagline.
