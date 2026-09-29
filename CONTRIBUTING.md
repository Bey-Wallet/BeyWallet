# Contributing to Bey Wallet

Thank you for helping improve Bey Wallet. Changes to a wallet can affect real funds, so favor
small, reviewable pull requests with focused tests and explicit validation notes.

## Before starting

- Search the [issue tracker](https://github.com/thehussein01/BeyWallet/issues) for related work.
- Open an issue before a large feature, storage migration, dependency change, or protocol change.
- Base new work on `main` and keep each branch focused on one problem.
- Read [docs/README.md](docs/README.md) for architecture and feature documentation.

## Local setup

```bash
git clone https://github.com/thehussein01/BeyWallet.git
cd BeyWallet
yarn install
yarn start
```

Yarn 4.5.0 is pinned in `package.json`. The development start command also requires Bun.

## Architecture and style

- Use TypeScript for new logic and theme-aware Tamagui components for UI.
- Keep `src/app` routes as thin wrappers around screens owned by `src/features`.
- Put reusable UI and utilities in `src/shared`, wallet orchestration in
  `src/services/wallet`, native integrations in `src/services/platform`, and remote clients in
  `src/services/api`.
- Prefer existing Coco Cashu abstractions over duplicating wallet behavior.
- Use the `~/*` alias for imports from `src`.
- Follow Prettier: two spaces, single quotes, semicolons, trailing commas, and a 100-character
  print width.
- Do not add or replace dependencies without discussing the change first.

See [docs/folder-structure.md](docs/folder-structure.md) for dependency and ownership rules.

## Security-sensitive changes

Treat wallet seeds, key derivation, proofs, mint and keyset validation, Nostr private keys,
recovery, backups, and payment operations as security-critical.

- Never weaken validation to make a flow succeed.
- Do not change recovery or key-derivation semantics without explicit agreement.
- Never log or commit recovery phrases, private keys, proofs, tokens, or credentials.
- Explain any security-sensitive behavior change in the pull request.
- Add regression tests for public-key normalization, persistence, recovery, and wallet behavior
  where applicable.

## Validation

Run the narrowest relevant checks while developing, followed by the full local suite:

```bash
yarn validate
yarn format:check
```

The available focused commands are:

```bash
yarn typecheck
yarn test:ci
yarn check:structure
```

Run `yarn check:structure` after adding, moving, renaming, or deleting routes or feature files.
There is currently no repository lint script; do not report a lint run unless one is added.

Native behavior cannot be fully established by Jest. For NFC, biometrics, notifications, camera,
deep links, and payment flows, document the devices and scenarios tested. The
[Nostr and People checklist](docs/testing/nostr-people-checklist.md) covers the current social
payment flows.

## Pull requests

A pull request should include:

- The problem and resulting behavior.
- Related issues.
- Security and migration considerations.
- Tests and commands run, including any unrelated baseline failures.
- Device checks that were performed or remain outstanding.
- Screenshots or recordings for visible UI changes.
- Documentation updates when behavior, APIs, routes, or storage contracts change.

Use a concrete commit prefix such as `feat:`, `fix:`, `refactor:`, `test:`, or `docs:` and keep
commits focused.

## Community

Be respectful, keep feedback constructive, and avoid including sensitive wallet information in
public discussions.

Apache 2.0 © Bey Wallet
