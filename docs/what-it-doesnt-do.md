# What Lastly doesn't do

The limits of the demo, and what production would need.

- **It can't spot a good forgery.** Someone who knows the names on the mandate could type documents that match, and they would pass. That's why money only goes to two places, both fixed in code: refunds go back to the original payment source, and the payout goes only to the heir account on file, once per refund.
- **The estate is seeded.** PayPal's Subscriptions and Transaction Search APIs only show a merchant its own data. The demo subscriptions are set up under our Sandbox business app, and Lastly reads them by ID. It can't list anyone's subscriptions with third parties.
- **The merchant facts are seeded too.** "Shared with the household" and "under contract" come from notes in `data/seed-estate.json`, not from PayPal. In production those would come from the merchant or from the executor.
- **The post-death charge is staged.** It's a Sandbox order paid with PayPal's test card. The hosted demo re-creates it after it has been refunded.
- **Handover isn't a transfer.** The partner approves a new subscription. The old one keeps running until then.
- **Only PayPal could run this for real.** One Sandbox business account plays all three merchants. One personal account plays both Jean and the heir. That's why we present Lastly as a feature PayPal could build, not as a third-party app.
- **The executor's authority is simulated.** The mandate is seeded data. In production it would need real legal or notary verification.
