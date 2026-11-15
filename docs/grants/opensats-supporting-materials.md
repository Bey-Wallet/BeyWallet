# Bey — OpenSats supporting materials

Prepared November 14, 2026, for the [application draft](opensats-application.md).
These are preparation materials; the video has not been recorded and no reference requests have
been sent. Use the public name **thehussein** consistently across the application and references.

## One-paragraph introduction

I am thehussein, working on Bey Wallet, an AGPL-licensed mobile application for Cashu payments,
Lightning payments through compatible mints, and encrypted Nostr conversations. I am seeking
$12,000 for six months of full-time development. My proposal focuses on payment reliability,
offline QR/NFC validation, and merchant usability, supported by public regression tests, physical
device results, and documentation. Bey builds on existing Cashu and Nostr libraries, and relevant
findings will be shared with upstream maintainers.

## Video script

The live General Grant form currently treats the video as optional for a $12,000 request; its
published client code requires one at $21,000 or more. The FAQ uses broader language about video
requirements. A short demonstration is still useful. If submitted, make the final video exactly
2:00 and record your own human narration. Recheck the form at submission time.

The script below is a starting point, not a guarantee of recording duration. Rehearse, adjust
pauses and demonstration footage, and verify the exported duration. Use a disposable demonstration
wallet and avoid exposing seed words, private keys, spendable tokens, or real contact information.

### Narration

Hi, I'm thehussein, and I'm working on Bey Wallet.

Bey is an open-source mobile wallet for Bitcoin ecash using Cashu. It brings together payments,
encrypted Nostr conversations, and a simple merchant checkout. The code is public under the AGPL
license, and the application builds on existing Cashu and Nostr libraries.

Here is the payment flow, and here is the point-of-sale screen. These features already exist in
the project. The work I want to fund is making them more dependable in everyday use.

A payment can be interrupted by a lost connection, an app restart, or an unfinished NFC tap.
Users need to know whether their money was sent, received, or is still pending. Delivery alone
must not be presented as confirmed payment.

I'm requesting twelve thousand dollars for six months of full-time work, at two thousand dollars
per month.

First, I will expand regression tests and address confirmed problems in interrupted payments and
recovery. Next, I will test offline QR and NFC flows on physical Android devices and publish the
results and limitations. Finally, I will seek feedback from a small group of testers and merchants,
improve checkout usability, and publish a tested release.

The outputs will include public code, regression tests, compatibility findings, and user guidance.
I will share relevant issues with upstream maintainers and provide regular progress reports.

This work aims to make Cashu payments easier to understand and more reliable, while producing
findings other developers can use. Thank you for considering Bey.

### Suggested footage

Show the repository and license, then a recent build's payment review, pending-payment details,
and point-of-sale screens. Demonstrate only behavior you have checked on the recorded build. Close
with the six-month scope and $12,000 request. Do not use the video to imply an audit, broad device
compatibility, existing merchant adoption, or a grant award.

## Reference-request message

Send this yourself to two people who have actually reviewed or collaborated on your work. Change
the bracketed sentence for each recipient. This is a request for their independent assessment,
not a letter to submit in their name.

> Hi [name],
>
> I'm applying for an OpenSats General Grant to work full-time on Bey Wallet for six months. The
> request is $12,000, focused on payment reliability, offline QR/NFC validation, and merchant
> checkout usability.
>
> [Explain how this person knows your work and link the work they have seen.]
>
> Would you be comfortable writing a reference based on your experience with me or the project?
> A useful letter would explain how you know me, what work you have observed, and your assessment
> of my ability to carry out this proposal. Please include an email OpenSats can use to verify it.
>
> You can send the letter directly to references@opensats.org with this subject:
> Reference Letter for Bey Wallet by thehussein
>
> Repository: https://github.com/Bey-Wallet/BeyWallet
>
> I can share the proposal and a demonstration build for context. Thank you for considering it.

## Evidence to prepare

Existing evidence is available, but a test file's presence is not a claim that checks were run for
this application. No app tests or physical-device checks were performed during draft preparation.

- **Project and license:** [public repository](https://github.com/Bey-Wallet/BeyWallet) and
  [LICENSE](https://github.com/Bey-Wallet/BeyWallet/blob/main/LICENSE).
- **Payment failure scenarios:** [payment acceptance notes](../payment-ui-verification.md) and
  [reclaim checklist](../testing/reclaim-checklist.md). These explicitly retain device checks.
- **Existing physical-device evidence:** [NFC compatibility notes](../nfc-compatibility.md) record
  a successful request/payment case on a Samsung SM-A546U running Android 16. Treat this as a
  recorded case, not validation of every current build or Android device.
- **Regression examples:** [receive recovery](../../tests/unit/cashu-receive-recovery.test.ts),
  [NFC request receipts](../../tests/integration/nfc-request-receipts.test.ts), and
  [POS history](../../tests/integration/pos-history.test.ts).
- **Personal contribution evidence:** add your verified developer profile and specific commits
  or pull requests. Do not attribute all repository work to yourself by default.
- **Current demonstration:** record the commit/build identifier, installation instructions,
  devices actually checked, and known limitations. Confirm external links work without special
  permissions before sending them to reviewers.

## Missing applicant information

- Application email and verified personal developer profile.
- Country or countries of work and confirmation of lead-maintainer status.
- Accurate development experience and a short personal contribution history.
- Two written reference letters with contact details and permission to share them.
- Prior funding and any additional funding expected during the proposed grant.
- Actual AI/compute costs and how they fit the budget.
- Confirmation that $2,000 monthly covers the intended personal budget, including taxes.
- Access to the devices needed for the proposed NFC scope; pilot recruitment remains a target.
- Recent build/demo links; an optional recorded two-minute video.

Do not fill missing facts with estimates presented as established history. Retain private contact
details and letters outside the public repository when completing the application.

## Source and requirement checks

Checked November 14, 2026. The application is for a General Grant, with the live form's
**Layer3 / eCash** focus option.

- [Application criteria](https://opensats.org/apply): public, freely licensed work with a Bitcoin
  benefit; the narrative should remain concise.
- [General Grant form](https://opensats.org/apply/grant): field labels and video validation were
  inspected in its published JavaScript because the static page did not expose the form. It
  includes a separate AI/compute field and human-accountability acknowledgments. AI assistance
  is permitted; applicants remain responsible for the work.
- [Application FAQ](https://opensats.org/faq/application): general grants need two written
  references before evaluation, with verification emails. Budgets are in USD and payouts in
  bitcoin. Applications close in March, June, September, and December. Review aims for under
  90 days but may take longer. Videos, when supplied, must be exactly two minutes with human
  narration. Full-time and part-time grants are available for 3–12 months.
- [Current agreement template, section B](https://opensats.org/docs/agreement.pdf): the default
  for a first-time grantee is monthly reporting during the first three months, then quarterly.
  This is more specific than the FAQ's general 90-day wording. The eventual signed agreement
  governs the actual schedule. The draft therefore plans reports at months 1, 2, 3, and 6.

The core application text and milestones are proposals prepared for Bey, not claims that
OpenSats has approved its eligibility, budget, or deliverables. Complete the applicant's own
review of the current form and agreement before submission.
