# Bey Wallet documentation

This directory contains the maintained technical and feature documentation for Bey Wallet.
Treat application code and tests as the final source of truth when documentation and behavior
disagree, and update both in the same change.

## Architecture

- [Folder structure](folder-structure.md) — ownership, dependency direction, route boundaries, and
  persistent compatibility contracts.

## Features

- [People and Nostr](features/people-and-nostr.md) — identity, discovery, favorites, payment
  history, payment claiming, trust boundaries, and diagnostics.

## Testing

- [Nostr and People checklist](testing/nostr-people-checklist.md) — manual and device validation
  that is not fully covered by unit tests.

## Project documents

- [README](../README.md) — product overview and local setup.
- [Contributing](../CONTRIBUTING.md) — development workflow, security rules, and pull-request
  expectations.
- [Changelog](../CHANGELOG.md) — unreleased and released user-visible changes.

## Documentation expectations

Update documentation when a change affects:

- User-visible behavior or terminology.
- Routes, feature ownership, or service boundaries.
- Persisted storage keys or migrations.
- Payment, recovery, key, proof, or mint trust semantics.
- Setup, build, validation, or device-testing commands.

Keep documentation centered on behavior and contracts. Avoid source line counts, file sizes, and
other measurements that become inaccurate without changing product behavior.
