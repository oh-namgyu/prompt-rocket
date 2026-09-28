# Changelog

All notable changes are documented here. Format: [Keep a Changelog](https://keepachangelog.com/), versioning: [SemVer](https://semver.org/).

## [Unreleased]
### Added
- Behavioral tests for the local server (`test/server.test.js`, built-in `node:test`, no new dependencies): static serving and headers, path-traversal refusal, SSE broadcast, leaderboard recording/whitelisting/top-50 cap, and arm/disarm. `npm test` now runs them after the syntax checks, and CI runs `npm test`.

### Fixed
- Path-traversal guard allowed reading from sibling directories whose name starts with `public` (e.g. `/../public-private/…`).
- A request with malformed percent-encoding or a NUL byte in the path crashed the server; it now returns 400.
- A non-finite `distance` (e.g. `1e999`) was stored on the leaderboard as `null`; it is now ignored.

## [v1.0.0] - 2026-06-19
### Added
- Initial public release.
