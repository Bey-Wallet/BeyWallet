# Product polish: one improvement at a time

Keep the accepted Home layout. Add one feature at a time and review its behavior before moving
to the next. Mints and payment-screen redesigns are outside this rollout.

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

## Remaining queue

1. Verify responsiveness on fresh and restored wallets using the existing device measurement plan.
2. Make the receiving identity/address experience clearer and easier to share.
3. Show offline readiness and connect denomination shortages to Prepare change.
4. Give pending/interrupted payments clear explanations and appropriate next actions.
5. Add a focused merchant receiving mode.
6. Add operating-system shortcuts for Scan and Receive.
7. Improve empty states with useful next actions.
8. Offer shareable receipt images containing an appropriate public payment summary.
9. Show understandable backup status in Settings.

Each item needs its own scope review and focused checks. Device-dependent behavior and service
requirements must be verified during that item's implementation; this document does not mark
the queued work implemented.
