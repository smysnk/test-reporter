# Release Notes Draft: 0.2.x

## Summary

`0.2.x` is the next additive Test Station release line. It expands the public CLI and reporting surface, adds policy and adapter capabilities, and keeps existing integration points stable.

This draft covers both:

- publishable `@test-station/*` package changes
- repository-private web/server and deployment changes that matter to repo operators

## Public package highlights

### CLI and artifact changes

- added repeatable workspace filters with `--workspace <name>` and `--package <name>`
- added `--output-dir <path>` to override the configured report destination for a run
- added explicit `--no-coverage` overrides for fast runs and package-script `test:fast` examples
- added `modules.json` for module/theme rollups
- added `ownership.json` for module/theme ownership rollups
- kept the existing `report.json`, `index.html`, and `raw/` artifact contract intact

### Policy and reporting changes

- added module and theme coverage thresholds through manifest-driven policy configuration
- threshold failures now appear in `report.json`, the HTML report, and the console summary
- error-enforced threshold failures now make `test-station run` exit non-zero
- added failure diagnostics reruns with captured stdout/stderr and raw artifacts under `raw/diagnostics/`
- expanded console output with package progress, module summaries, and policy status

### Adapter changes

- `@test-station/adapter-node-test`
  - supports coverage collection for direct `node --test` commands and supported package-script wrappers
- `@test-station/adapter-playwright`
  - supports suite-scoped browser Istanbul coverage with `suite.coverage.strategy = 'browser-istanbul'`
- `@test-station/adapter-shell`
  - supports `single-check-json-v1` for structured single-check JSON payloads

## Repository-private app and deployment highlights

These changes are not part of the published npm package surface, but they are part of the repository release:

- renamed `portal` to `web` across the app, env vars, Docker, Fleet, and tests
- added localhost fallbacks for `SERVER_URL`, `WEB_URL`, `WEB_GRAPHQL_PATH`, and `NEXTAUTH_URL`
- generalized Fleet values for external ConfigMaps/Secrets and NodePort services
- added a generalized Fleet `GitRepo` example
- fixed migration ordering for the reporting schema and coverage trend tables
- fixed web auth startup regressions around NextAuth handler resolution and session serialization

## Compatibility notes

- this release is intended as a semver-minor update
- existing adapter ids remain stable
- existing config continues to work without required new fields
- new CLI flags and manifest sections are optional

## Validation summary

The release-prep validation currently covers:

- `yarn test:node`
- `yarn build`
- `node ./bin/test-station.mjs run --config ./examples/generic-node-library/test-station.config.mjs --coverage`

The smoke example now explicitly verifies `report.json`, `modules.json`, `ownership.json`, `index.html`, and `raw/`.

## Release operator notes

- checked-in publishable package manifests should stay on the `0.2.0` baseline
- the publish workflow will convert that baseline to `0.2.<build_number>` unless overridden
- publishing now happens from the `staging` branch, or via manual workflow dispatch with `publish_npm=true`
