# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.6.0] - 2026-07-21

Backward-compatible minor release. Existing public exports and option names from
`1.5.1` remain supported. See **Changed** and **Migration notes** for
default-behaviour updates worth scanning before upgrade.

### Added

- Optional `autoTrack` option to set Umami's `data-auto-track` flag on the
  injected script
- Optional `maxQueuedEvents` option (default `100`) to cap queued
  track/identify/page-view calls while `window.umami` is unavailable
- Optional `debug` option (default `false`) to log a successful plugin load
- Public TypeScript exports for consumer config and helpers:
  `UmamiPluginOptions`, `UmamiRouterLike`, `UmamiRouteLike`,
  `UmamiTrackPageViewOptions`, and related event/session types
- Structural router contract (`afterEach` + `fullPath`) so the package does not
  import or pin `vue-router` for types
- JSDoc on the public type and function surface (shipped in declaration files)
- Expanded README: tracker configuration via `extraDataAttributes`, SPA
  tracking guidance, TypeScript usage, and structural-router rationale
- Contributor docs from [#8](https://github.com/jaseeey/vue-umami-plugin/pull/8)
  (Cryde): common `data-*` attribute reference and Core Web Vitals notes

### Changed

- Successful load logging is opt-in via `debug` (previously always logged
  `Umami plugin loaded`)
- Queued calls are bounded by default (`maxQueuedEvents: 100`); oldest items are
  dropped when the cap is reached, with a one-time warning per overflow episode
  (including when installation lowers the cap below an already-queued backlog)
- Plugin installation is idempotent for the tracker script: repeated install
  while already installed or pending keeps the existing tracker configuration;
  a failed script load can be retried. A new router supplied on a later install
  is still attached so separate Vue roots can track navigation
- When a router is supplied, the plugin continues forwarding every router
  navigation as a page-view fallback (recommended with `autoTrack: false` to
  avoid overlap with Umami's built-in tracking)
- Explicit `autoTrack` takes precedence over
  `extraDataAttributes['data-auto-track']` (with a console warning on conflict);
  when `autoTrack` is omitted, `data-auto-track` from extras is still honoured
- Align `window.umami` typings with the tracker API (additional `track`
  overloads; identify parameter naming) and mark `window.umami` as optional
- Ship window typings from the package entry instead of a separate `global.d.ts`
  source file (npm package continues to ship only `dist`)
- Prefer US English in public documentation

### Fixed

- Avoid duplicate script injection and duplicate `afterEach` hooks on the same
  router instance
- Remove the injected script and reset install state on load failure so a later
  install can retry
- Reserve the plugin marker attribute (`data-umami-plugin`) so it cannot be
  overridden via `extraDataAttributes`
- Guard queue flush against a missing `window.umami`
- Flush module-local queues when reusing an already injected shared Umami script
  (including when the shared script is still loading)

### Migration notes (from 1.5.1)

- **Typical apps need no code changes** when upgrading.
- To restore the old always-on load log, set `debug: true`.
- If you emit more than 100 track/identify/page-view calls before the Umami
  script loads, raise `maxQueuedEvents` or expect oldest items to be dropped.
- Do not rely on calling `install()` twice to change tracker configuration after
  a successful load; reinstall only retries the script after a failed load.
  Supplying an additional router on a later install still attaches that router.
- TypeScript that assumed `window.umami` is always defined may need a presence
  check (runtime was always optional).

## [1.5.1] - 2026-04-15

### Changed

- Upgrade Vitest and coverage dependencies to the latest compatible versions

## [1.5.0] - 2026-02-25

### Added

- Support `identifyUmamiSession(id, sessionData?)` overload while keeping the
  existing session-data-only call form
- Dual ESM/CJS packaging documentation and a more reliable pack workflow
- Build scripts for cleaning `dist` and writing per-format `package.json`
  module-type markers, with a `prepack` hook

### Changed

- Align README usage examples and plugin typings with the public API

## [1.4.0] - 2025-09-01

### Added

- `extraDataAttributes` option to forward additional Umami tracker `data-*`
  attributes onto the injected script element
- Vitest test suite covering attribute handling and website ID enforcement

### Changed

- Enforce `data-*`-only attribute application and protect `data-website-id`

## [1.3.0] - 2025-01-23

### Added

- `identifyUmamiSession` for Umami session identification
- `allowLocalhost` option, with tracking disabled on localhost by default

## [1.2.0] - 2024-09-22

### Added

- Optional `scriptSrc` configuration for self-hosted or custom Umami script URLs

## [1.1.0] - 2024-04-15

### Added

- `trackUmamiPageView` for manual page view tracking

## [1.0.0] - 2024-04-15

### Added

- Initial Vue 3 plugin for loading Umami and tracking page views and events
- Dual ESM/CJS TypeScript build output
- Optional Vue Router integration for automatic page tracking
- README documentation and MIT license

[1.6.0]: https://github.com/jaseeey/vue-umami-plugin/compare/v1.5.1...v1.6.0
[1.5.1]: https://github.com/jaseeey/vue-umami-plugin/compare/v1.5.0...v1.5.1
[1.5.0]: https://github.com/jaseeey/vue-umami-plugin/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/jaseeey/vue-umami-plugin/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/jaseeey/vue-umami-plugin/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/jaseeey/vue-umami-plugin/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/jaseeey/vue-umami-plugin/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/jaseeey/vue-umami-plugin/releases/tag/v1.0.0
