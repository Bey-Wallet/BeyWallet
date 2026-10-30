# Product polish: one improvement at a time

Keep the accepted Home layout. Add one feature at a time and review its behavior before moving
to the next. Mints and payment-screen redesigns are outside this rollout.
Use the shared `feat/product-polish` branch and a separate focused commit for each improvement.

## 1. History search

Implementation:

- Search opens from an icon beside Filters in the History header. The full-width bar is hidden
  until requested and focuses when opened. Closing search clears its query.
- Match saved contact names/usernames, receipt notes and token memos, satoshi amounts, mint names,
  payment types/statuses, and local calendar dates.
- Examples: `Alice coffee`, `1,000 sat`, `₿1,000`, `Oct 24`, or `2026-10-24`.
- All query terms must match. Numeric terms match complete numbers rather than numeric substrings.
- Search combines with existing quick, mint, date, and payment-type filters. Clearing just the
  query preserves those filters; Reset clears both.
- Recent History keeps its existing 200-entry load. While searching, a separate local query reads
  all persisted payments and wallet activity through the existing service and SQLite repositories.
  Its cache key contains no search text and is invalidated by the existing History events.
- Search text is indexed once per data/contact/mint update. Raw tokens and arbitrary metadata
  are not searchable; existing note extraction supplies public token memos.
- Loading and failure states prevent unavailable history from looking like an empty search.
- No mint/relay requests, payment execution, database schema changes, or new dependencies.

Device review still needed: header placement and keyboard focus, list scrolling while searching,
large histories, large text, and light/dark themes.

Validation: 33 focused tests passed across search matching, header controls, History interactions,
existing filters/notes, and a SQLite integration case finding an entry beyond the recent 200.
Type checking, the structure check, scoped formatting, and diff whitespace checks passed.

## 2. Responsiveness: shared accessibility subscription

The shared reduced-motion hook previously installed a native listener and read the device
preference for each consumer. Buttons, pressables, switches, and spinners all use this hook.
A synthetic test mounting 100 consumers reproduced 100 native subscriptions before the fix.

The hook now uses one shared native subscription and preference read while consumers are mounted.
It retains the safe initial reduced-motion state, propagates live preference changes, ignores
stale reads/events after teardown, and removes the native subscription after the last unmount.
Unchanged preference events do not re-render consumers. Existing control styling is preserved.

Local regression coverage includes subscription sharing, cleanup, live changes, failed reads,
stale callbacks, and repeated events. The 100-consumer fixture now checks one native subscription
and read. This is evidence of less native setup work, not a measurement of app tap latency.
Validation: all 40 focused hook/control tests, type checking, the button check, scoped formatting,
and diff whitespace checks passed.

No Android device was attached during this change. Follow the existing
[restored-wallet performance plan](plans/restored-wallet-performance.md) to compare actual fresh
and restored wallets. Device responsiveness remains unverified.

## 3. Clearer receiving and address sharing

- Receive now includes a direct My addresses entry alongside Request ecash and Bitcoin.
- Keep the Ecash-first default, as requested, and explicit Lightning deep links.
- Explain that the Ecash QR is a Nostr identity for compatible wallets and that the Lightning
  address uses npub.cash. Label the raw Nostr public key and make username copying discoverable.
- Add Create payment request on Ecash and Create Lightning invoice on Lightning. These open
  existing flows; their validation, quote creation, and confirmation behavior is preserved.
- Separate Lightning preference loading from setup. The QR, Copy, and Share remain unavailable
  until the existing readiness conditions are satisfied.
- Keep pending incoming payments reachable when Lightning is disabled, and provide a direct
  management link when enabled. Collection remains in the existing authenticated flow.
- Preserve exact Ecash and Lightning QR, clipboard, and share payloads; no receiving service,
  key derivation, address provider, or automatic-collection policy is changed.

Device review still needed: small screens and large text, QR scanning in compatible wallets,
native clipboard/share sheets, and return navigation from request/invoice setup.

Validation: all 50 focused address/profile, action-selector, Lightning-service, and lifecycle
tests passed, along with type checking, the button check, scoped formatting, and diff whitespace.

## Remaining queue

1. Verify responsiveness on fresh and restored wallets using the existing device measurement plan.
2. Show offline readiness and connect denomination shortages to Prepare change.
3. Give pending/interrupted payments clear explanations and appropriate next actions.
4. Add a focused merchant receiving mode.
5. Add operating-system shortcuts for Scan and Receive.
6. Improve empty states with useful next actions.
7. Offer shareable receipt images containing an appropriate public payment summary.
8. Show understandable backup status in Settings.

Each item needs its own scope review and focused checks. Device-dependent behavior and service
requirements must be verified during that item's implementation; this document does not mark
the queued work implemented.
