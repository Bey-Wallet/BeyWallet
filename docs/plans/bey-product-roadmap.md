# Bey product roadmap and adoption strategy

Status: planning reference; product features described here are not implemented by this document.

Recorded: 2026-10-23. Priorities may change with demand. Protocol proposals and external projects
must be checked again before implementation.

## Product direction

Bey should make receiving and spending useful before expanding into speculative products. The
agreed direction is one public identity, reliable Lightning receiving, and a practical merchant
checkout. Nutzaps are secondary. Payments across mints are deferred.

The leading growth hypothesis is shareable money for creators and communities, connected to
merchant payments. This is an adoption wedge to validate, not a guarantee of mainstream adoption
or profitability.

### Current foundation

- Bey Wallet is a React Native/Expo Cashu and Nostr wallet. Offline pocket already works.
- The Next.js website is at `C:\Users\Zaheer\OneDrive\Desktop\Side Projects\bey-website`.
- The website inspection found username registration, public profiles, and token/request links.
  It did not find an always-on Lightning receiving backend, durable payment ledger, or merchant POS.
- The wallet's restored-wallet responsiveness investigation has its own
  [performance plan](./restored-wallet-performance.md). Its hypotheses still need device timings.

## Agreed roadmap

### 1. Wallet responsiveness

Follow the existing performance plan first. Compare restored and fresh wallets on normal preview
builds, preserve payment and recovery correctness, and verify improvements on devices. A new
feature should not conceal unresolved lag in common wallet interactions.

### 2. Unified identity and Lightning receiving

Use `username@bey.cash` as the public identifier for Nostr discovery, ecash messaging, and Lightning
receiving. Users should not have to understand the underlying protocols to share their address.

The website should provide:

- NIP-05 discovery through `/.well-known/nostr.json?name=<username>`.
- Lightning address discovery through `/.well-known/lnurlp/<username>` and an LNURL-pay callback.
- A shared `/u/<username>` profile with clear receiving options.
- Wallet-authorized registration and changes that prove control of the associated Nostr identity.

NIP-05 identifies a Nostr public key; it does not itself deliver ecash or provide Lightning
receiving. Keep those services explicit. A unified public identity does not require private-key
reuse between Nostr messaging, quote locking, and other payment operations.

Receiving must work while the phone is closed or offline. Evaluate the
[npub.cash server architecture](https://github.com/cashubtc/npubcash-server) before building an
equivalent service: the backend creates and monitors mint quotes, records paid quote metadata,
and the recipient wallet later claims ecash directly from the mint using recipient-locked quotes.
Confirm the selected mint and library support before choosing this implementation.

The website needs a durable payment database and reliable background reconciliation. In-memory
maps and process timers are not the payment ledger. Record customer payment and wallet claim as
separate states, process retries idempotently, and retain enough information to recover after a
service restart. Bind an issued invoice to its original recipient even if a username later changes.

Before implementation, document the trust boundary, mint custody and availability assumptions,
quote recovery, and what an offline recipient can recover without the receiving service. Do not
introduce seed/key derivation changes as an incidental part of this feature.

### 3. Merchant website and POS

Build a browser POS where a merchant pairs Bey, enters an amount, displays a Lightning invoice,
and sees confirmed payment. Lightning comes first: a compatible Cashu wallet can pay through its
Lightning functionality. Direct ecash acceptance is a later extension.

- Pair the merchant session using a wallet-signed, expiring challenge and explicit wallet approval.
- Use an authenticated first-party receiving API for Bey's own website.
- Show invoice expiry, pending, confirmed, and failed states clearly. Claim status is separate from
  the customer having paid.
- Reconcile payment state after browser refreshes, interrupted connections, and backend restarts.
- Price in sats first unless a separately specified fiat conversion flow is approved. A fiat display
  does not promise a stable-value balance.

Later, expose restricted receiving capabilities for external POS applications through
[Nostr Wallet Connect](https://github.com/nostr-protocol/nips/blob/master/47.md), initially
`make_invoice`, `lookup_invoice`, and required capability discovery. Grant only the needed methods;
do not grant spending by default. Check any notification extension against the implementation.

The always-on receiving service must answer those requests when the phone is offline. A NWC
listener running only on the phone cannot meet that requirement. Cashu Wallet Connect is a separate
experimental integration to evaluate later, not a universal compatibility assumption.

### 4. Offline pocket improvements

Improve the working feature rather than replacing it:

- Explain which amounts the available denominations can actually pay offline.
- Make Get Change reachable from the sending flow and explain shortages before going offline.
- Present QR and NFC as understandable delivery choices within the existing payment flow.
- Distinguish delivered, verification pending, and redeemed states; offline delivery alone does not
  prove that a token remains spendable.
- Provide a clear recovery surface for pending transfers and interrupted handoffs.

Preserve existing proof ownership and recovery semantics. Verify NFC and offline transfers on
physical devices, including cancellation and repeated taps.

### 5. Nutzaps and external integrations

Nutzaps are secondary to the receiving and merchant foundation. Publishing recipient information
alone is not full support: implement receipt, validation, redemption, and duplicate handling for
the relevant events according to [NIP-61](https://github.com/nostr-protocol/nips/blob/master/61.md).
Use explicit mint preferences and preserve existing messaging behavior.

Sequence: responsiveness → unified identity and Lightning receiving → merchant checkout → offline
improvements → Nutzaps → external receiving integrations.

## Growth experiment: Bey Drops

### Hypothesis and experience

People may share and claim small amounts of real money through links, QR codes, memes, and
community campaigns. Some recipients may return to tip creators or make purchases.

Example: a creator funds a drop and shares it; a recipient claims sats into Bey, then uses the same
identity to receive tips or pay that creator. Design a first claim with minimal friction while
making payment conditions understandable.

This category already has examples: [Awesome Cashu](https://github.com/cashubtc/awesome-cashu)
lists Meme Amigo as a project that hides ecash in memes. That establishes a related concept, not
evidence of adoption, retention, or a profitable business. Its implementation was not independently
verified during this research.

### First experiment boundaries

Treat this as a separately approved pilot after core receiving works:

- Sender-funded gifts with clear claim status and conditions.
- Shareable previews and a straightforward claim experience.
- Defined behavior for copied links, competing claims, interrupted redemption, and unclaimed funds.
- Funding limits and abuse controls appropriate to any sponsored campaign.
- No Bey-issued speculative token, promises of appreciation, or unfunded rewards.

Before development, choose whether a drop is an open bearer gift or an access-controlled claim.
A publicly shared bearer token can be copied and redeemed by whoever obtains it first; it cannot
be presented as a guaranteed gift to a particular person. Do not place spendable tokens in preview
metadata, analytics, or logs. Do not promise expiration or refunds without an enforceable design.

### Revenue hypothesis and validation

Use sharing for acquisition and useful merchant/creator tools for potential revenue. Candidate
paid services are campaign management, checkout tools, reporting, payment links, and API access.
Any processing fee must be disclosed before confirmation. Pricing needs a later validation step;
this document does not select a fee or promise a margin.

Measure:

- Claim completion and the share of recipients who make a later payment.
- Returning recipients and active merchants over consistent measurement windows.
- Merchants willing to pay for the tools, rather than only use subsidized rewards.
- Contribution margin after payment/provider costs, infrastructure, support, abuse, and acquisition.

Set pilot budgets and success thresholds before launch. Large claim counts or short-lived social
attention alone do not justify expanding the experiment.

## Alternative markets and product categories

| Direction                    | Assessment for Bey                                                                                            | Decision                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Prediction markets           | Potential engagement, but require liquidity, credible resolution, disputes, and jurisdiction-specific review. | Explore separately; do not add to the core wallet roadmap.                            |
| Stable-value balances        | Could improve pricing and retention for some users, but need a defined backing and redemption model.          | Separate financial architecture decision.                                             |
| Memecoins                    | Speculative attention does not establish repeat payment demand or sustainable revenue.                        | Prefer experiments with memes carrying real ecash before considering token issuance.  |
| Pay-per-use digital services | A plausible recurring spending use case when there is an actual service customers value.                      | Revisit after receiving and checkout; identify a provider and customer segment first. |

### Prediction markets

Cashu payments alone do not provide a prediction market. Outcome resolution, market mechanics,
liquidity, disputes, and redemption still need to exist. The conditional-token
[cashu-ts implementation inspected during research](https://github.com/cashubtc/cashu-ts/pull/682)
was a draft prototype, not a production-readiness guarantee. Recheck its status before evaluation.
This does not rule out other architectures, but it is not a ready-made feature to enable in Bey.

### Stablecoins and stable-value ecash

Displaying a sats balance in dollars does not stabilize its purchasing power. USD-denominated
ecash needs a credible issuer, backing or hedging mechanism, and redemption model. Adding a
blockchain stablecoin is another asset and infrastructure decision, not a display preference.
[Circle's USDC documentation](https://developers.circle.com/stablecoins/what-is-usdc) illustrates an
issuer-backed model; it is not a proposal to integrate USDC or evidence that such integration is
risk-free. Validate demand and operational responsibilities before considering this direction.

### Pay-per-use services

[Routstr](https://docs.routstr.com/overview/) demonstrates Cashu-funded AI access and is a useful
reference for small, recurring digital purchases. A service margin can be a business model, but
profitability depends on provider costs, demand, distribution, and support. Cashu payment privacy
does not automatically hide prompts, IP addresses, or other service metadata.

## Acceptance and implementation gates

This document records direction, not a complete implementation specification for every feature.
Before each phase, inspect current code and resolve its interfaces, funding model, failure states,
security review, and rollout criteria. Ask before adding dependencies. Keep website changes in its
own repository and wallet operations behind existing wallet abstractions where appropriate.

Future implementation validation must include:

- Username ownership, unauthorized updates, and invoices issued before a username change.
- Receiving while the app is closed, duplicate callbacks, expired invoices, worker restarts, and
  repeated claim attempts without duplicate credit or lost recovery information.
- Merchant pairing expiry/replay, session revocation, invoice reconciliation, and restricted NWC
  permissions without unintended spending access.
- Offline denomination shortages, pending-transfer recovery, QR handoffs, and NFC device checks.
- Gift-link leakage, competing claims, retries, and clear reporting of who can claim a drop.
- Focused payment regression tests and device checks before enabling features for users.

Default priority remains the receiving and merchant foundation. Bey Drops is the leading growth
hypothesis. Prediction markets, stablecoins, and token issuance remain exploratory.
