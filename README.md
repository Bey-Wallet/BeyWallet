# Bey Wallet ⚡️

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Expo](https://img.shields.io/badge/Made%20with-Expo-000020.svg?logo=expo&logoColor=white)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React%20Native-000000?logo=react&logoColor=61DAFB)](https://reactnative.dev)
[![Cashu](https://img.shields.io/badge/Protocol-Cashu-FFD700.svg)](https://cashu.space)

> A local-first Cashu wallet for Bitcoin and Nostr.

Bey Wallet combines ecash payments, Bitcoin funding and withdrawal flows, and Nostr identity in
an Expo and React Native application. Wallet state is stored locally, sensitive operations are
protected by device security, and wallet orchestration is built around the Coco Cashu packages.

## Preview

<div align="center" style="display: flex; flex-wrap: wrap; justify-content: center; gap: 8px;">
<img width="95" height="210" alt="Bey Wallet balance screen" src="https://github.com/user-attachments/assets/fddb0208-c9bb-4474-9837-99cbdf1331e2" />
<img width="95" height="210" alt="Bey Wallet payment screen" src="https://github.com/user-attachments/assets/b69f8b0f-0094-4768-87e1-f253a70ae7af" />
<img width="95" height="210" alt="Bey Wallet mint screen" src="https://github.com/user-attachments/assets/792bd336-f21a-4605-9137-fe037d33ea6f" />
<img width="95" height="210" alt="Bey Wallet history screen" src="https://github.com/user-attachments/assets/be0c332e-e311-4d2f-9b11-c4a9e74c14f2" />
<img width="95" height="210" alt="Bey Wallet Nostr screen" src="https://github.com/user-attachments/assets/3d1a1d52-5cf9-4861-ae48-055f3901e8d0" />
<img width="95" height="210" alt="Bey Wallet settings screen" src="https://github.com/user-attachments/assets/c0c4be99-24c1-4aa7-91b6-fae384ab6ac3" />
</div>

## Features

### Cashu and Bitcoin

- Send and receive Cashu ecash, including P2PK-locked payments.
- Fund the wallet over Lightning or with an on-chain Bitcoin address.
- Pay Lightning invoices or withdraw to an on-chain Bitcoin address.
- Manage multiple trusted mints and inspect balances and transaction history.
- Exchange ecash offline over NFC and optimize fragmented proofs.
- Restore wallet funds from a recovery phrase and export encrypted wallet backups.

### Nostr and People

- Use a wallet-derived Nostr identity and optionally register a `@bey.cash` NIP-05 identifier.
- Search for people by npub or NIP-05 and verify NIP-05 profile associations.
- Keep favorites, recent payment contacts, and person-specific payment history in one People view.
- Send P2PK-locked ecash through encrypted Nostr messages.
- Automatically claim payments from trusted mints; unknown mints require explicit approval.
- Diagnose profile, NIP-05, inbox relay-list, and relay-connectivity problems.

See [People and Nostr](docs/features/people-and-nostr.md) for behavior and security boundaries.

### Privacy and device integration

- Store application and wallet data locally with SQLite.
- Protect secret access and sensitive operations with device authentication.
- Hide balances in public and display amounts in sats or a selected fiat currency.
- Support camera scanning, NFC, notifications, secure storage, and deep links.

## Technology

- Expo Router and React Native
- TypeScript and Tamagui
- Zustand and TanStack Query
- Expo SQLite
- `coco-cashu-core`, `coco-cashu-react`, and `coco-cashu-expo-sqlite`
- `nostr-tools`

## Development

### Prerequisites

- Node.js
- Yarn 4.5.0, pinned in `package.json`
- Bun, required by the cache-clearing `yarn start` command
- Android Studio or Xcode for native development
- EAS CLI for hosted production builds

### Setup

```bash
git clone https://github.com/thehussein01/BeyWallet.git
cd BeyWallet
yarn install
yarn start
```

The app uses native modules. Device features and native payment flows should be tested with a
development build, not only in a web browser or Expo Go.

### Common commands

| Command                | Purpose                                           |
| ---------------------- | ------------------------------------------------- |
| `yarn start`           | Start Expo with a cleared cache                   |
| `yarn android`         | Build and run the Android app                     |
| `yarn ios`             | Build and run the iOS app                         |
| `yarn web`             | Start the web app                                 |
| `yarn typecheck`       | Check TypeScript without emitting files           |
| `yarn test:ci`         | Run Jest once                                     |
| `yarn check:structure` | Validate routes and feature ownership             |
| `yarn validate`        | Run type checking, tests, and the structure check |
| `yarn format:check`    | Check repository formatting                       |

### Project structure

```text
src/
├── app/                 # Thin Expo Router entry files
├── features/            # Product screens and feature-owned components
├── shared/              # Reusable UI, hooks, icons, theme, and utilities
├── services/
│   ├── wallet/          # Cashu and wallet orchestration
│   ├── platform/        # Native and operating-system integrations
│   └── api/             # HTTP and relay-backed clients
├── state/               # Zustand stores
└── storage/sqlite/      # SQLite schema, adapters, and repositories
```

Internal imports use the `~/*` alias. Read the [documentation index](docs/README.md) and
[folder-structure guide](docs/folder-structure.md) before moving code between layers.

## Production build

```bash
eas build -p android --profile production
```

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Never include recovery
phrases, private keys, proofs, credentials, or other wallet secrets in issues, screenshots, logs,
tests, or commits.

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE).
