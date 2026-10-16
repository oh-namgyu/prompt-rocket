# Changelog

All notable changes are documented here. Format: [Keep a Changelog](https://keepachangelog.com/), versioning: [SemVer](https://semver.org/).

## [1.0.1] - 2026-10-16
### Added
- `npm test`: syntax-checks `server.js` and the client scripts (`node --check`), then runs the test suite.
- Behavioral tests for the local server (`test/server.test.js`, built-in `node:test`, no new dependencies): static serving and headers, path-traversal refusal, SSE broadcast, leaderboard recording/whitelisting/top-50 cap, and arm/disarm. CI runs `npm test`.
- Dependabot weekly updates for npm and GitHub Actions, with auto-merge of patch/minor updates once checks pass.

### Fixed
- Path-traversal guard allowed reading from sibling directories whose name starts with `public` (e.g. `/../public-private/…`).
- A request with malformed percent-encoding or a NUL byte in the path crashed the server; it now returns 400.
- A non-finite `distance` (e.g. `1e999`) was stored on the leaderboard as `null`; it is now ignored.

### Changed
- README: screenshot, Korean summary at the top, CI/License/Release badges, and a `License` section that links `SECURITY.md`.
- CI and Pages actions bumped (`actions/checkout` 4 → 7, `actions/setup-node` 4 → 7, `actions/configure-pages` 5 → 6, `actions/upload-pages-artifact` 3 → 5, `actions/deploy-pages` 4 → 5, `dependabot/fetch-metadata` 2 → 3).

## [1.0.0] - 2026-06-19
### Added
- Initial public release.
