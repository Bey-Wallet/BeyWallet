# Repository Guidelines

## Project Structure & Module Organization

Bey Wallet is a TypeScript React Native app using Expo Router, Tamagui, Cashu, and Nostr. Routes live in `src/app/`, including `(tabs)` and `(modals)`, and should remain thin wrappers around screens in `src/features/`. Organize feature-specific screens and components under their owning feature. Reusable UI, layouts, hooks, themes, icons, and utilities belong in `src/shared/`. Keep wallet operations in `src/services/wallet/`, native/device integrations in `src/services/platform/`, and remote data clients in `src/services/api/`. Zustand stores live in `src/state/`; SQLite setup and production repositories live in `src/storage/sqlite/`. Tests live in `tests/unit/` and `tests/integration/`; fonts and images live in `src/assets/`. Native Android code, Expo plugins, maintenance scripts, and dependency patches reside in `android/`, `plugins/`, `scripts/`, and `patches/`.

## Build, Test, and Development Commands

Use Yarn 4.5.0, as pinned in `package.json`.

- `yarn install`: install dependencies and apply patches.
- `yarn start`: start Expo with a cleared cache; this script requires Bun (`bunx`).
- `yarn android` / `yarn ios`: build and run native apps with Expo.
- `yarn web`: start web development; `yarn build:web`: export the web app.
- `yarn test:ci`: run Jest once; `yarn test` enables watch mode.
- `yarn typecheck`: check TypeScript types without emitting files.
- `yarn check:structure`: validate the feature-based layout and Expo route wrappers.
- `yarn validate`: run type checking, tests, and the structure check.
- `yarn format:check`: check Prettier formatting; `yarn format` rewrites matching files repository-wide.
- `eas build -p android --profile production`: build a production APK.

## Coding Style & Naming Conventions

Use TypeScript for new logic and theme-aware Tamagui components. Follow Prettier: two-space indentation, single quotes, semicolons, trailing commas, and a 100-character print width. A Biome configuration exists, but there is no package lint script; use the wired Prettier commands for formatting. Use PascalCase component names, camelCase services and stores, and `use`-prefixed hooks. Follow existing Expo Router filename conventions and use the configured `~/` alias for imports from `src/`.

## Testing Guidelines

Jest uses the `jest-expo` preset. Name tests `*.test.ts` or `*.test.tsx` and place them under `tests/unit/` or `tests/integration/`. Existing coverage is minimal; no coverage threshold is configured. Add focused regression tests for changed wallet behavior, public-key normalization, persistence, and other bug fixes. Mock native APIs and network services where appropriate. Document device checks for NFC, biometrics, notifications, and payment flows.

## Commit & Pull Request Guidelines

Recent commits use prefixes such as `feat:` and `refactor:` followed by a concrete description. Keep commits focused. PRs should describe the problem, resulting behavior, related issues, and validation performed. Include screenshots for UI changes and update documentation when APIs change. Never commit recovery phrases, private keys, or service-account credentials.

## Agent Instructions

- Inspect relevant existing code before making changes. Treat the repository as the source of truth.
- Prefer existing architecture, patterns, and abstractions over introducing new ones.
- Keep changes minimal and scoped to the requested task.
- Do not refactor unrelated code while implementing a feature or fixing a bug.
- Preserve unrelated working-tree changes. Never discard, overwrite, or revert user changes.
- Ask before adding or replacing dependencies.
- Do not commit or push unless explicitly requested.
- For non-trivial bugs, investigate and identify the root cause before implementing a fix.
- Prefer existing `coco-cashu-core` abstractions for Cashu operations where appropriate.
- Keep Expo route files thin; put implementation details in the corresponding feature module.
- Avoid static circular imports between wallet lifecycle services. Use an existing lower-level boundary or deferred loading when lifecycle coordination would otherwise create a cycle.
- Treat files referenced by Expo Router, `app.json`, Metro/Babel/Tamagui configuration, plugins, scripts, or native code as entry points when auditing dead code.
- Remove dead code by complete dependency cluster, but preserve shared descendants that are still reachable from active features. Do not retain speculative code solely for possible future use; Git history is the archive.
- Do not disable Metro package-exports resolution merely to silence third-party fallback warnings. Trace the dependency first and ask before upgrading or patching it.

### Security-Critical Changes

Treat wallet seeds, key derivation, Cashu proofs, mint/keyset validation, Nostr private keys,
wallet recovery, backups, and payment operations as security-critical.

- Never weaken validation or security checks merely to make a flow work.
- Do not change seed/key derivation or recovery semantics without explicit approval.
- Do not expose secrets, recovery phrases, private keys, proofs, or credentials in logs.
- Explain security-sensitive behavioral changes before implementing them.

### Validation

After making changes:

- Run the narrowest relevant checks first.
- Run `yarn typecheck` when appropriate. If the repository has unrelated baseline failures, report them and confirm the changed files introduced no new errors.
- Add focused regression tests when practical.
- Run `yarn check:structure` after adding, moving, or deleting routes or feature files.
- Do not use repository-wide formatting for a small change unless necessary.
- For NFC, biometrics, notifications, or payment behavior that cannot be fully verified locally,
  explicitly state what still requires device testing.

Report the files changed, validation performed, and anything that remains unverified.
