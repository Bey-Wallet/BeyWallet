# Application license migration

The current source tree declares **AGPL-3.0-only** (GNU Affero General Public License,
version 3 only), replacing the former Apache 2.0 project declaration. This implements the
requested AGPL change and supersedes the earlier deferred GPL-3.0-or-later proposal.

## Scope

- The root `LICENSE` contains the verbatim license text from the
  [SPDX license-list data](https://raw.githubusercontent.com/spdx/license-list-data/main/text/AGPL-3.0-only.txt).
- `package.json`, the README badge and license section, CONTRIBUTING, and the font documentation
  use the same `AGPL-3.0-only` identifier.
- The README retains `Copyright 2026 Bey Wallet`.
- Third-party dependency notices, dependency patches, and the Inter font's SIL Open Font
  License remain unchanged. Earlier release files are not rewritten.

The exact identifier is documented by [SPDX](https://spdx.org/licenses/AGPL-3.0-only.html).

## Verification

Compare `LICENSE` with the upstream text, parse the package metadata, check documentation links
and formatting, and search for stale current-project license declarations. These documentation
and metadata changes do not alter wallet behavior or require application tests or a native build.
