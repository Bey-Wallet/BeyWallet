# Bey supporter membership exploration

Status: **Exploration with a UI-only mock — no paid membership model approved.** Recorded 2026-10-25.

Spotlight has been deferred and its prototype reverted. Preserve the
[Spotlight design reference](bey-spotlight-design-reference.md) for later. The user subsequently
requested a compact supporter card on Home as a UI experiment. This changes the earlier
Settings-only discovery proposal, without selecting a paid offering. This document compares
voluntary support with cosmetic membership before choosing a product or payment architecture.

## Goal and comparison

Explore whether people who value Bey's maintenance, design, and ongoing development will help
fund it while ordinary wallet use remains free. There is no established supporter demand,
conversion rate, or revenue forecast. Current roadmap work still prioritizes wallet responsiveness,
receiving, and merchant usefulness; see the [product roadmap](bey-product-roadmap.md).

| Question                 | Voluntary support                                                             | Membership with cosmetic perks                                                                               |
| ------------------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Why pay?                 | Help maintain Bey and support its development                                 | Support development and receive a modest personal benefit                                                    |
| Offering                 | Optional one-time contributions or explicitly authorized recurring support    | One optional supporter tier with monthly/yearly terms                                                        |
| Possible benefits        | A thank-you shown to everyone; public progress reports accessible to everyone | Private, optional in-app supporter badge and a small set of alternate accent/icon treatments                 |
| Exclusive digital access | None; do not quietly add a paid badge or theme to this model                  | Yes; even cosmetic perks need purchase/entitlement handling                                                  |
| Audience hypothesis      | Existing users who already trust and value the project                        | Users who value the project and want a small visible expression of support                                   |
| Main weakness            | Ongoing contribution is difficult to sustain without continued goodwill       | Cosmetics may not provide enough recurring value; ongoing billing and support obligations                    |
| Operational cost         | Payment processing, receipts, refunds, communications, and bookkeeping        | All support costs plus entitlement verification, restoration, cancellation, and maintaining perks            |
| Anonymous use            | Easier if no receipt-linked app identity or public recognition is required    | Possible privacy-preserving approaches need investigation; restoration creates additional identity tradeoffs |

These benefits are candidates, not approved additions. Basic themes and currently available
features stay free. Do not sell a verified/trusted badge, mint endorsement, roadmap voting power,
guaranteed returns, or priority access to resolving lost funds. Public recognition must be opt-in;
a donation-linked public badge would change the voluntary-support comparison above.

Alby offers a free wallet with an optional paid Pro tier, including custom addresses and remote
backups. This is a relevant example of optional paid value alongside free wallet use, not proof
that Bey's users will buy cosmetic membership. [Alby pricing](https://getalby.com/pricing).

## Proposed discovery and experience

The current UI experiment includes `Become a Bey supporter` in Home's compact swipeable prompt
stack alongside wallet backup and username claiming. It uses a subtly bordered neutral surface,
a heart-and-handshake icon aligned with the title, a 14-point heading, and a 12-point description.
The next card peeks below the foreground card; there is no section heading or visible counter.
The muted X dismisses only the current prompt. The persisted supporter dismissal and its
dedicated Settings destination remain available; no paid offering has been introduced.
Tapping opens a native full-screen `Support Bey` modal explaining developer time, maintenance,
testing, documentation, and open-source contributions. It states that support is optional, core
wallet use stays free, and memberships/payments are not yet available. Mock plans show $3/month
and $30/year in USD. A separate `Or give once` option accepts a custom USD amount, with no
renewal or subscription. Only positive amounts with up to two decimal places enable its preview
button; a decimal comma is also accepted. Preview buttons show explicit no-payment confirmations;
they do not activate a membership or send a donation. Selecting a recurring preview clears the
donation confirmation and vice versa. Selection and the custom amount reset when the modal closes.
`Back to wallet`,
the left-side X, and Android hardware back dismiss it.

`Do not show again` closes the modal and hides the Home row on this device, including after
restart. Only `homeCardDismissed` is persisted under the `bey-supporter-ui-preferences` key using
the existing SQLite preference adapter. It is not an entitlement or payment record.

A permanent `Support Bey` navigation row on the Settings root opens the same content in a
dedicated Settings screen, with the existing centered title, back arrow, and hidden tab bar.
This entry remains available after hiding the Home card. Dismissing from Settings hides only the
Home card and leaves the Settings screen open; the hide action then disappears. The Home modal
and Settings screen share the same content and mock plan behavior. No Home-card restore toggle
has been added.

The modal stays mounted, guards repeated opening taps, and captures the existing reduced-motion
preference for each presentation. This avoids changing native entry animation mid-presentation.
No paid membership state, checkout, account, or entitlement is introduced. Prices are UI samples
only, not approved live offers. These Home and Settings entry points are UI experiments, not
approval of a production membership offer. Never interrupt a payment to promote support.

Manual UI checks: card placement and touch feedback; text fit at narrow widths and large text
sizes; light/dark appearance; rapid taps and close/reopen; Android hardware back; reduced-motion
entry; choosing either mock plan and seeing its no-payment message; entering a custom one-time
amount (including invalid/zero amounts and decimal separators); close/reopen clearing the
selection and amount; Do not show again remaining hidden after restart; and permanent Settings access after
Home dismissal. Device appearance and animation remain unverified.

Possible positioning to validate:

> Help keep Bey useful, maintained, and freely available.

The voluntary-support version explains that giving is optional and buys no exclusive features.
Any future recurring contribution must disclose the schedule, amount, authorization, and how to
stop it. A manually renewed contribution is not an automatically renewing subscription.

The cosmetic version shows the actual perks before purchase, renewal terms, purchase restoration,
and a manage/cancel destination appropriate to its payment channel. After cancellation, keep
already-paid access through the applicable paid period. At expiry, use a free default appearance
without touching wallet data or interfering with an in-flight operation. Refund/revocation and
offline behavior need a specified policy before implementation.

Core sending, receiving, balances, recovery, seed/key access, proof export, security controls,
and existing backup capabilities remain free. Membership expiry must never obstruct funds or
change validation, key derivation, recovery, mint choice, or payment processing.

## Pricing hypotheses and unit economics

Use **USD $3/month or $30/year** only as unapproved research anchors for either recurring
support or cosmetic membership. These are not published prices, an approved billing schedule,
or estimates of willingness to pay. The annual anchor is equivalent to $2.50/month before costs.
Do not promise a fixed sat price; exchange-rate handling and payment quotes are future decisions.

| Hypothetical supporters | All paying $3 monthly: monthly gross | All paying $30 annually: yearly gross | Annual-plan monthly equivalent |
| ----------------------- | ------------------------------------ | ------------------------------------- | ------------------------------ |
| 100                     | $300                                 | $3,000                                | $250                           |
| 500                     | $1,500                               | $15,000                               | $1,250                         |

Each column describes an alternative scenario, not additive revenue. Annual cash collection and
monthly revenue allocation are different. None of these supporter counts is a forecast or an
observed conversion rate.

```text
Net contribution = gross receipts
                 - refunds and chargebacks
                 - applicable platform/provider/payment fees
                 - taxes due or collected for remittance, as applicable
                 - incremental infrastructure and support costs

Monthly-equivalent contribution per supporter
    = monthly-equivalent price - expected variable cost per supporter

Supporters needed to cover a monthly funding target
    = ceil((target + fixed monthly membership costs)
           / monthly-equivalent contribution per supporter)
```

Use the last formula only with a positive contribution per supporter. For illustration, a $300
monthly funding target with $0 incremental fixed costs and $2.50 contribution per supporter
would require 120 supporters. The $2.50 assumption is hypothetical, not a fee estimate. Before
launch, use actual channel fees, support time, refunds, and the chosen funding target.

## Distribution and payment constraints

Policy notes below were checked against official sources on **2026-10-25**. They are planning
constraints, not confirmation that a particular checkout will be accepted. Recheck the exact
storefront, country, program enrollment, and distribution channel before implementation.

| Channel                                    | Voluntary support                                                                                                                                                                                | Cosmetic membership                                                                                                                                  |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Website / directly distributed Android APK | Explore a suitable contribution provider or explicit Bitcoin/Lightning payment flow; recurring authorization and cancellation still need definition                                              | External purchases could support a future entitlement service; verify provider terms, restoration, and refunds                                       |
| Google Play build                          | Google describes a contribution exception when 100% goes to the creator and no digital benefit is granted. Confirm applicability to Bey rather than assuming all developer contributions qualify | Digital perks generally require Play billing unless a permitted alternative applies; badges count as digital benefits                                |
| iOS App Store build                        | Apple permits developer tips through in-app purchase. Its individual-gift and nonprofit provisions are distinct; do not assume either applies to Bey                                             | Digital unlocks generally use in-app purchase. Auto-renewing subscriptions must offer ongoing value; a cosmetic-only tier's suitability needs review |

Apple's external-purchase rules vary by storefront and entitlement; Google also has regional
alternative-billing/linking programs. A website checkout is not automatically permitted inside
every store-distributed app. Paying with cryptocurrency does not itself create an exception.
Do not select a billing SDK or present a Cashu/Lightning checkout as a workaround.

Official sources:

- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/),
  especially 3.1.1, 3.1.2, and 3.2.1.
- [Google Play Payments policy explanation](https://support.google.com/googleplay/android-developer/answer/10281818?hl=en),
  especially digital benefits, contributions, external distribution, and regional programs.

Website/direct APK exploration is not approval to change the project's distribution strategy.
This task adds no checkout, provider account, wallet payment flow, or external purchase link.

## Privacy, identity, and entitlement questions

Voluntary support without exclusive perks can avoid an app membership entitlement entirely.
Payment providers may still receive payment/account metadata; do not advertise anonymity without
examining the chosen flow. Store receipts likewise create purchase records outside Bey.

For cosmetic membership, compare store-native restoration with a separately designed cross-device
receipt/entitlement service. A local boolean is appropriate only for a labeled mock, never as
evidence of a production purchase. Define pending, active, expired, refunded, and restored behavior
before building a live version; do not lock users out because a status service is temporarily down.

Nostr identity binding is optional, not assumed. It could help cross-device recognition, but it
also links payment metadata to a public identity and introduces account-recovery questions. A
wallet seed must never be collected or repurposed to prove membership. Do not derive new keys or
introduce new identity/recovery semantics incidentally. Nostr proofs of control do not by themselves
establish a valid payment or a store-compliant entitlement.

Before approving perks, decide how to restore after reinstall, handle identity changes and lost
receipts, avoid duplicate purchases across platforms, process cancellation/refunds, and expire
cosmetics without affecting private wallet data. Keep any badge local by default and make public
recognition separately opt-in. No contacts, balances, transactions, or proofs should be used for
marketing or supporter targeting.

## Recommendation and validation before building

**Start by validating voluntary support; retain cosmetic membership as the alternative to test.**
This is a recommendation, not a selected business model. It makes the initial question explicit:
will existing users fund maintenance because they value Bey? Cosmetics add product and billing
work before there is evidence they improve recurring support. If interviews show concrete demand
for a small, maintainable perk set, compare it against the pure-support offering using the same
research anchors. Do not promise hosted services or priority support capacity to justify renewal.

Propose research before production work; no outreach, sales, or fundraising is authorized here:

- Ask existing users which maintenance outcomes they value, whether they would contribute
  regularly, and what would make them stop. Separate stated interest from an actual commitment.
- Compare the two written offers. Ask whether cosmetics change willingness to pay or simply
  distract from supporting development. Check whether the offer feels fair to non-supporters.
- Establish a realistic funding target and support-time budget. Evaluate channel costs and store
  feasibility before announcing perks or taking money.
- If a later pilot is approved, agree its duration, budget, renewal/retention goals, cancellation
  expectations, and stop conditions in advance. Assess net contribution, repeat support, support
  workload, privacy feedback, and effects on wallet trust. Avoid tracking private wallet behavior.

### Decisions still needed for a launch

Choose the model and benefits, intended distribution channels and regions, one-time versus
recurring options, actual prices and payment currency, provider/billing route, refund policy,
identity/restoration design if applicable, offline access policy, and a measurable pilot target.
These are deliberate future product decisions; this exploration does not resolve them by creating
infrastructure. A new implementation proposal should address them before production payment or
entitlement code or dependencies are added.

Only the Home card, informational modal, Settings page, and plan-selection UI are mocked. No billing SDK, account system,
entitlement backend, recurring debit, wallet security change, or paid feature is implemented.
