# Bey Wallet — OpenSats General Grant application

Prepared November 14, 2026. Draft for applicant review; not submitted.

This draft follows the fields in the [General Grant form](https://opensats.org/apply/grant).
Replace every `[TODO: ...]` before submission. The applicant has confirmed the public name
**thehussein**, a full-time commitment, and a request of **$2,000 per month for six months**.
Milestones below are proposed commitments for review, not completed work.

## Applicant

- **Your Name:** thehussein
- **Email:** [TODO: preferred application email]
- **Personal GitHub:** [TODO: your verified profile URL; do not infer it from your public name]
- **npub:** [TODO: public Nostr key, or leave this optional field blank]
- **Other Contact Details:** [TODO: public contact/profile URL, or leave blank]
- **Country or Countries of Work:** [TODO: country where you will carry out the funded work]
- **Lead developer or maintainer:** [TODO: confirm your role before checking this box]

The form permits a public pseudonym. Supply legal identity or payment details directly to
OpenSats when requested, rather than adding them to this public repository.

## Project Details

### Main Focus

Layer3 / eCash

### Project Name

Bey Wallet

### Project Description

Bey is an AGPL-licensed mobile wallet combining Cashu ecash payments, Lightning payments through
compatible mints, and encrypted Nostr conversations. Its existing code includes payment requests,
QR transfers, Android NFC flows, pending-payment management, and a point-of-sale screen. Wallet
state and payment records are stored locally. Cashu users still depend on their chosen mints to
hold and redeem the bitcoin backing their ecash.

I am requesting $12,000 for six months of full-time work to make these payment flows more reliable
and easier to use. The work will focus on interrupted payments and recovery, offline QR/NFC
validation, and merchant checkout usability. It will produce regression tests, documented device
results, fixes, and public release notes. Bey builds on coco-cashu-core, cashu-ts, and nostr-tools;
relevant upstream findings will be shared with their maintainers.

### Potential Impact

For a mobile wallet user, a lost connection or interrupted tap must not leave the payment's state
ambiguous. A merchant also needs to distinguish a delivered token from a payment actually received.
Bey brings these interactions into one mobile application, alongside payment conversations and
local transaction records.

This proposal will improve those existing workflows and publish evidence of their behavior under
failure and on physical devices. Public test scenarios, compatibility findings, and reproducible
bug reports can help other Cashu developers as well as Bey users. Success will be assessed through
documented outcomes and resolved defects, rather than projected adoption. The proposal does not
claim that Bey is the first wallet with these features or that the application has been independently
security-audited.

## Written References

[TODO: obtain two genuine written reference letters from people familiar with your work.
Include each person's name and verification email, with their permission. Letters may be included
here or sent directly to OpenSats. Do not submit names alone as a substitute for letters.]

## Prior Contributions

My current project is Bey Wallet. Its public repository contains the implementation, tests, and
technical documentation for Cashu payments, Nostr conversations, Android NFC, and point-of-sale
checkout. Examples of the project's existing work are linked below. These links demonstrate project
work; my personal contribution record is provided separately.

- [Source and development history](https://github.com/Bey-Wallet/BeyWallet)
- [Payment acceptance scenarios](https://github.com/Bey-Wallet/BeyWallet/blob/main/docs/payment-ui-verification.md)
- [Android NFC compatibility findings](https://github.com/Bey-Wallet/BeyWallet/blob/main/docs/nfc-compatibility.md)
- [Receive recovery regression tests](https://github.com/Bey-Wallet/BeyWallet/blob/main/tests/unit/cashu-receive-recovery.test.ts)

[TODO: add two or three sentences about your background, your role in Bey, and links to specific
contributions you can explain. Include contributions to other projects only if you made them.]

### Years of Developer Experience

[TODO: accurate number and, if useful, brief context]

## Project Source Code and Media

- **Repository:** https://github.com/Bey-Wallet/BeyWallet
- **Open-Source License:** AGPL-3.0-only
- **Project Website:** https://www.bey.cash
- **Screenshots / Videos:** [TODO: recent demonstration and installable build links you have checked]

Existing screenshots are available in the
[repository](https://github.com/Bey-Wallet/BeyWallet/tree/main/docs/screenshots). Review them for
currency and privacy before using them as application evidence.

## Project Timeline

- **Duration:** 6 months
- **Time Commitment:** 100% - Full Time
- **Start:** on an agreed date after approval; months below are relative to that date.

### Project Timeline and Potential Milestones

**Months 1–2: Payment reliability.** Establish a reproducible baseline for interrupted receive,
send, pending-payment reconciliation, and reclaim flows. Extend automated regression coverage
where gaps are found, fix confirmed defects, and publish a test matrix with expected and observed
results. Scenarios will include app restart, network interruption, duplicate actions, and stale
status updates. Existing mint validation and proof ownership checks will be preserved.

**Months 3–4: Offline payments and Android NFC.** Exercise QR and NFC handoffs on a documented
physical-device matrix, targeting at least two NFC-capable Android devices. Cover interrupted
handoffs, cancellation, repeated taps, background/resume, and offline-to-online transitions.
Publish device/build details, compatibility limits, and regression fixes. Delivery and verified
receipt will remain distinct states. Device access must be confirmed before finalizing this scope.

**Months 5–6: Merchant usability and release.** Recruit a small pilot, targeting five testers
including two merchants, to review checkout, fees, receipts, and the next-sale flow. Record
completion outcomes and points of confusion, address the highest-impact reproducible issues,
and publish a tested release with setup guidance and an anonymized evaluation. Recruitment is a
target, not an existing partnership; report the actual sample and any limitations honestly.

Throughout the grant, I will publish code and documentation, maintain an issue list, and share
useful upstream findings. I propose monthly progress reports for the first three months and a
final report at month six, subject to the signed agreement. Reports will link deliverables,
explain remaining work, and account for use of the grant.

## Project Budget

### Costs & Proposed Budget

I request **$12,000 USD** for six months of full-time development and maintenance of Bey Wallet:
**$2,000 per month × 6 months**. The requested support is for my time implementing, testing,
documenting, and maintaining the proposed work.

I selected $2,000 per month as the amount that would support my commitment to Bey. Before
submission, I will confirm that this covers my living costs and applicable taxes. No additional
hardware, hosting, travel, or external security-audit funding is included in this request.

### AI / Compute Cost

No separate AI/compute allocation is included in the $12,000 draft budget.

[TODO: disclose the AI subscriptions/API/compute costs used for this work, how they will be paid,
and whether any are included in the request. Do not describe actual costs as zero unless that is
true. If adding a funded allocation, update the breakdown and grand total consistently.]

### Grand Total

12000 USD

### Prior Funding

[TODO: answer Yes or No for prior funding received by the project or its contributors. If Yes,
provide sources, dates, amounts, and funded work. No funding history has been assumed.]

### Additional Funding Sources

[TODO: answer Yes or No for funding received or expected during the grant period. If Yes,
describe sources, amounts, and how the work and budget relate to this application.]

## Final

### Video Application

[TODO: optional public or unlisted video URL; see the accompanying script and timing notes]

### Anything Else We Should Know?

The requested grant supports public, open-source wallet development. Code will remain under
AGPL-3.0-only, with third-party notices preserved and funded documentation openly licensed.
I use AI-assisted development tools and will remain responsible for reviewing, understanding,
testing, and maintaining the resulting work. Security-sensitive findings will be handled through
coordinated disclosure. Changes to seed derivation or recovery semantics are outside this proposal.

## Applicant review before copying into the form

Confirm that the first-person statements accurately describe your work and intentions. Complete
all placeholders, confirm device access and the proposed milestones, and personally review the
form's prerequisite, human-accountability, and eligibility acknowledgments. No acknowledgments
have been made and no application has been submitted by preparing this document.

Preparation notes, source checks, a video script, and a reference-request draft are in
[supporting materials](opensats-supporting-materials.md).
