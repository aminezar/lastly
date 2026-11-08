<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:heirloom-rules -->
# Heirloom — hackathon rules (read after PRODUCT.md)

PayPal AI Hackathon. Deadline **Nov 12, 2026 21:00 Brussels**; internal submission Nov 10. Do not invent progress.

## Read order
1. `PRODUCT.md` — what/why/demo/seed estate (product source of truth)
2. `docs/hackathon/HACKATHON.md` — rules, prizes, submission checklist
3. `docs/hackathon/spike-001-paypal-estate-apis.md` — verified PayPal routes + caveats
4. Notion if needed: main 3fef7e4d97868097aff4f8bc2ca54244 · spec 412f7e4d97868169b48be3eaec534662

## Hard rules
- Sandbox only (`api-m.sandbox.paypal.com`). Never live PayPal, never real personal data; fictional deceased/heirs only.
- Never commit secrets. `.env.local` only (gitignored). Never print secrets in logs/PRs/chat.
- Never fake a PayPal response. If Payouts unavailable, label the step simulated in UI + README.
- Merchant-scoped honesty: demo subscriptions are seeded under our Sandbox business app. Say so in README. No "lists anyone's subscriptions" claims.
- Refunds go to original source only — no redirect-refund workarounds.
- Small, reversible changes. Verify with a real run (`npm run build`, smoke script) before claiming done.

## Stack / commands
Next.js 16 + React 19 + AG Grid/Studio (official boilerplate — this README's original text is in `docs/hackathon/boilerplate-README.md`). `npm install` · `npm run dev` · `npm run build` · `npm run lint`
PayPal client: `lib/paypal.ts` (extend it; one auth path). To add: subscriptions list/cancel, capture refund, orders handover, payouts. AI keys server-side only (`lib/ai.ts`), never `NEXT_PUBLIC_`.

## Definition of done (today's gate)
Sandbox credentials in `.env.local` → `node scripts/paypal-smoke.mjs` prints token + balances + (after seeding) one cancel/refund/payout with real Sandbox IDs recorded in `data/seed-estate.json`.

Owners: Person A = PayPal/backend/AI. Person B = frontend/video/Devpost.
<!-- END:heirloom-rules -->
