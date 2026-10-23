# Reclaim responsiveness

Reclaim retains its full mint proof-state preflight, refund deadline checks,
sender identity validation, and normal wallet receive pipeline. Concurrent
proof-state checks for the same cleaned token share only the running request;
completed responses are never cached or reused for a later reclaim.

History guards repeat reclaim taps and overlapping status refreshes, pauses its
polling while reclaim runs, and discards status responses from before reclaim.
Legacy expiry sweeps use the same screen guard to avoid a competing redemption.
Navigation away is blocked while reclaim is running. After the mint operation
and history write succeed, the transaction cache updates immediately. Reclaim
does not wait for another mint state request or a 500 ms display timer; balances
and the history list refresh in the background.

History's saved-token Claim now action uses the same completion and stale-response
guards. It calls the normal receive pipeline, preserves the saved entry on failure
or while offline, and updates the entry immediately after receipt and persistence.
The Claim now action on the receive result screen already shows success immediately
through its existing receive flow; its mint trust and P2PK handling stay unchanged.

```sh
yarn test:ci --silent --runInBand --runTestsByPath tests/unit/history-reclaim.test.tsx tests/unit/proof-state-requests.test.ts tests/unit/reclaim-payment.test.ts tests/unit/reclaim-policy.test.ts tests/unit/expiry-sweep.test.ts tests/unit/proof-dleq.test.ts
yarn typecheck
yarn check:structure
```

## Device checks still required

Use a disposable wallet. Record aggregate timings and outcomes only; never log
tokens, proof secrets, recovery phrases, or signing keys.

- Compare reclaim with manual Receive using equivalent new bearer tokens on the
  same mint/network. A fresh reclaim still needs its proof-state preflight.
- Reclaim from History while status polling is active. Tap twice, try navigation
  back, and use a slow connection. Confirm one redemption, responsive controls,
  immediate completion after persistence, and the correct restored balance.
- Reclaim a timed P2PK refund after eligibility. Confirm refund-key validation and
  the `refunded` result; before eligibility or with a different identity, confirm
  no redemption occurs. Seed/key derivation is unchanged.
- Have the recipient redeem first and race recipient redemption against reclaim.
  Confirm no false refund success and no late "recipient claimed" overwrite of a
  successful local reclaim. Check partial/pending proofs remain protected.
- Simulate network failure, retry, and verify polling resumes without duplicate
  requests. Check legacy expiry auto-sweeps still complete normally.
- Save a token for later, then claim from History. Test repeat taps, offline/online
  retry, mint failure, navigation back, and a manual status check started just before
  claim. Confirm an immediate claimed result and the restored balance after success;
  failures must leave the saved token available. Also check Claim now on the receive
  result screen, including its normal mint trust review and P2PK receiving behavior.
