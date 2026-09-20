# Repository Guidelines

## Project Structure & Module Organization

Bey Wallet is a TypeScript React Native app using Expo Router, Tamagui, Cashu, and Nostr. Routes live in `src/app/`, including `(tabs)` and `(modals)`. Feature screens belong in `src/screens/`; reusable UI belongs in `src/components/`. Keep wallet operations in `src/services/core/` and platform integrations in `src/services/`. Zustand stores and SQLite persistence live in `src/store/`. Despite its name, `src/store/test/` contains production database repositories. Tests live in `src/__tests__/`; fonts and images live in `src/assets/`. Native Android code, Expo plugins, and dependency patches reside in `android/`, `plugins/`, and `patches/`.

## Build, Test, and Development Commands

Use Yarn 4.5.0, as pinned in `package.json`.

- `yarn install`: install dependencies and apply patches.
- `yarn start`: start Expo with a cleared cache; this script requires Bun (`bunx`).
- `yarn android` / `yarn ios`: build and run native apps with Expo.
- `yarn web`: start web development; `yarn build:web`: export the web app.
- `yarn test --watchAll=false`: run Jest once; `yarn test` enables watch mode.
- `yarn tsc --noEmit`: check TypeScript types.
- `yarn format:check`: check Prettier formatting; `yarn format` rewrites matching files repository-wide.
- `eas build -p android --profile production`: build a production APK.

## Coding Style & Naming Conventions

Use TypeScript for new logic and theme-aware Tamagui components. Follow Prettier: two-space indentation, single quotes, semicolons, trailing commas, and a 100-character print width. A Biome configuration exists, but there is no package lint script; use the wired Prettier commands for formatting. Use PascalCase component names, camelCase services and stores, and `use`-prefixed hooks. Follow existing Expo Router filename conventions.

## Testing Guidelines

Jest uses the `jest-expo` preset. Name tests `*.test.ts` or `*.test.tsx`. Existing coverage is minimal; no coverage threshold is configured. Add focused regression tests for changed wallet behavior, mocking native APIs and network services. Document device checks for NFC, biometrics, and payment flows.

## Commit & Pull Request Guidelines

Recent commits use prefixes such as `feat:` and `refactor:` followed by a concrete description. Keep commits focused. PRs should describe the problem, resulting behavior, related issues, and validation performed. Include screenshots for UI changes and update documentation when APIs change. Never commit recovery phrases, private keys, or service-account credentials.

## Agent Instructions

Prefix shell commands with `rtk`, following `C:\Users\Zaheer\.codex\RTK.md`. Preserve unrelated working-tree changes.
