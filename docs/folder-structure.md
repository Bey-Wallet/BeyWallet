# Folder structure

The application is organized by ownership rather than by file type.

- `src/app` contains thin Expo Router entry files and route configuration. Route filenames are part
  of the navigation contract and must not be moved or renamed casually.
- `src/features` owns screens and components used by one product area. Payment flows are grouped
  under `features/payments` by operation; People and Nostr keep their feature-specific behavior in
  `features/people` and `features/nostr`.
- `src/shared` owns reusable UI, icons, layouts, hooks, utilities, and theme infrastructure. Shared
  code must not import feature internals.
- `src/services/wallet` owns Cashu and wallet orchestration. Its `index.ts` is the stable public
  barrel. Avoid static circular imports between lifecycle services.
- `src/services/platform` owns operating-system and device integrations such as secure storage,
  biometrics, files, notifications, networking, and NFC.
- `src/services/api` owns HTTP- or relay-backed integrations that are not wallet orchestration.
- `src/storage/sqlite` owns the production SQLite adapter, schema, migrations, and repositories.
- `src/state` owns Zustand stores. Persisted store names, versions, migrations, and secure-storage
  keys are compatibility contracts.
- `tests/unit` contains focused behavior tests; `tests/integration` contains tests that cross
  storage or service boundaries.

## Dependency direction

Internal imports use the `~/*` alias. Route files may import their owning feature. Features may use
shared modules, state, and services. Shared modules must not depend on feature implementations.
New cross-feature behavior should move to `shared`, an appropriate service boundary, or an explicit
feature API instead of importing another feature's internal screen or component.

Files referenced by Expo Router, `app.json`, Metro, Babel, Tamagui, Expo plugins, scripts, native
code, or patches are entry points even when ordinary TypeScript imports do not reference them.

## Change checks

When changing structure, run:

```bash
yarn check:structure
yarn typecheck
```

Before submitting the complete change, run `yarn validate`. The structure check protects expected
route paths, feature ownership, legacy-folder removal, aliases, and unresolved merge markers.
