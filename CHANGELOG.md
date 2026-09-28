# Changelog

Notable user-visible and developer-facing changes are recorded here. This project follows the
structure of [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Release versions and dates
should be added when a release is cut; file sizes and source counts are intentionally excluded
because they become stale quickly.

## Unreleased

### Added

- A unified People experience with recent contacts, favorites, and payments requiring attention.
- Person profiles with Nostr metadata, verified NIP-05 state, and person-specific payment history.
- Search and recipient resolution for npubs, Nostr profiles, and NIP-05 identifiers.
- Automatic claiming for Nostr ecash payments from trusted mints.
- Explicit approval before trusting and claiming from an unknown mint.
- Persisted retry state for temporarily unavailable Nostr payments.
- Nostr diagnostics for identity, kind `0` profile metadata, NIP-05 resolution, inbox relay-list
  publication, and relay reachability.
- Focused repair actions for profile metadata and inbox relay-list publication.
- Unit coverage for People migration and sorting, profile caching, NIP-05 verification, recipient
  resolution, person history, payment claims, and diagnostics.

### Changed

- Renamed the Contacts tab and related routes to People.
- Consolidated legacy saved contacts and favorites into one persisted People store while retaining
  the existing storage key for upgrade compatibility.
- Moved Nostr-owned payment UI into the Nostr feature boundary.
- Improved Nostr profile display and payment recipient handling.
- Replaced the previous toast implementation with the application toast provider.

### Removed

- The superseded Contacts routes, feature screens, and store after migration to People.
- Obsolete shared Nostr claim and payment components now owned by the Nostr feature.

## 0.2.0

The repository did not previously maintain a release-oriented changelog. Earlier work is
available in Git history; future releases should add dated sections here rather than reconstructing
source-level metrics.
