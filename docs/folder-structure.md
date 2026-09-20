# Folder structure

The application is organized by ownership rather than by file type.

- `src/app` contains Expo Router entry files only. Route filenames are part of the public navigation contract and must not be moved or renamed.
- `src/features` owns screens and components used by one product area. Payment flows are grouped under `features/payments` by operation.
- `src/shared` owns reusable UI, icons, layouts, hooks, utilities, and theme infrastructure. Shared code must not import feature internals.
- `src/services/wallet` owns Cashu and wallet orchestration. Its `index.ts` is the stable public barrel.
- `src/services/platform` owns operating-system and device integrations such as secure storage, biometrics, files, notifications, networking, and NFC.
- `src/services/api` owns HTTP- or relay-backed integrations that are not wallet orchestration.
- `src/storage/sqlite` owns the production SQLite adapter, schema, migrations, and repositories.
- `src/state` owns Zustand stores. Persisted store names and secure-storage keys are compatibility contracts.
- `tests/unit` contains pure behavior tests; `tests/integration` contains tests crossing storage or service boundaries.

Internal imports use the `~/*` alias. New cross-feature dependencies should be promoted to `shared`, a service boundary, or an explicit public feature API rather than reaching into another feature's implementation.

When changing structure, run `yarn validate`. The structure check protects route paths, legacy-folder removal, aliases, and unresolved merge markers.
