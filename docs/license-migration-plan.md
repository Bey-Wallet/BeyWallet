# Plan: Switch project licensing to GPL-3.0-or-later

Status: Deferred. This document records the plan only; no license change has been applied.

## Summary

Change the application's license declaration from Apache 2.0 to GPL-3.0-or-later,
preserving separate third-party licenses. The selected variant permits GPL version 3
or any later version.

## Planned changes

- Replace the root `LICENSE` with the canonical GNU GPL v3 text, without modifying
  the license text itself.
- Explicitly declare GPL-3.0-or-later in the README license section and preserve
  `Copyright 2026 Bey Wallet` there.
- Add `"license": "GPL-3.0-or-later"` to `package.json`.
- Update the README license badge and link, the CONTRIBUTING footer, and the
  application-license reference in `docs/fonts.md`.
- Preserve the font SIL Open Font License, upstream MIT notices in dependency
  patches, and all unrelated working-tree changes.

Use the [SPDX GPL-3.0-or-later page](https://spdx.org/licenses/GPL-3.0-or-later.html)
as the reference for the identifier and canonical license text.

## Validation when implemented

- Verify the root license text matches the canonical GNU GPL v3 text.
- Confirm `package.json` parses and declares the selected SPDX identifier.
- Search for stale project Apache declarations, preserving third-party notices.
- Review the scoped diff. Application tests and builds are unnecessary for these
  documentation and metadata changes.

## Boundaries

- This plan concerns the current project's license declaration. Earlier releases
  remain untouched.
- Do not change application code, dependency licenses, or font licenses.
- Do not commit or push unless explicitly requested.
