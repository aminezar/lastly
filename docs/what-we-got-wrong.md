# What we got wrong along the way

Each of these was found in our own testing or review, then fixed. The rule each fix became is in [Every rule has a reason](every-rule-has-a-reason.md).

- The first portal showed "Documents agree" and "Matches the mandate" without comparing anything. Now each document is read on its own and checked against the other and the mandate, and the server checks again before every PayPal call.
- The payout route paid any receiver any amount. Now it pays only the heir account on file, and never more than the refunds PayPal confirms as completed.
- A retried click could pay out twice, because request IDs came from `Date.now()`. Each payout batch ID now comes from the refund it pays out, so PayPal rejects a repeat.
- Payouts never worked from the portal. We sent `currency_code`, which is the Orders field name, where Payouts expects `currency`. Our earlier successful payouts had all come from scripts.
- "Charged after death" was hard-coded and never compared with the date of death.
- The first handover created a one-off checkout, which takes nothing over. It's now a new subscription on the same plan, and we say plainly that it isn't a transfer.
- We share one Sandbox with a teammate, and a charge we'd seeded got refunded by someone else in the middle of a test. The portal correctly showed "Already refunded". The hosted demo now re-creates the charge for each visitor.
