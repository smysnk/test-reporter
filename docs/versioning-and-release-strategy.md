# Versioning And Release Strategy

## Versioning model

All publishable `@test-station/*` packages move in lockstep on the same version.

Current baseline for external consumers:

- `0.1.0`

That version means:

- the config shape is stable enough for early adopters
- the normalized report schema is stable enough for generated HTML and downstream tooling
- the built-in adapter and policy hook contracts are intentionally public

## Semantic versioning rules

### Major

Bump the major version when any of these break:

- `test-station.config.mjs` contract
- `report.json` normalized schema
- adapter hook contract
- policy plugin hook contract
- CLI command names or required flags

### Minor

Bump the minor version for additive changes:

- new optional config fields
- new adapter capabilities
- new optional report metadata
- new built-in plugins
- new renderer features that do not break the report schema

### Patch

Bump the patch version for:

- bug fixes
- parser improvements
- renderer fixes
- coverage normalization fixes
- source-analysis improvements that do not change public contracts

Published npm artifacts do not use the checked-in patch number directly. The release workflow computes the published patch from CI build metadata, so published npm versions follow `major.minor.<build_number>` unless explicitly overridden.

## Publish boundary

Only these package entrypoints should be treated as public:

- `@test-station/cli`
- `@test-station/core`
- `@test-station/render-html`
- `@test-station/adapter-node-test`
- `@test-station/adapter-vitest`
- `@test-station/adapter-playwright`
- `@test-station/adapter-shell`
- `@test-station/adapter-jest`
- `@test-station/plugin-source-analysis`

Internal source layout inside `packages/*/src` is not a compatibility promise.

## Release checklist

1. Run `yarn lint`.
2. Run `yarn test`.
3. Run `yarn build`.
4. Run the external consumer example:
   - `node ./bin/test-station.mjs run --config ./examples/generic-node-library/test-station.config.mjs`
5. Verify the generated HTML report opens and renders module/package drilldown correctly.
6. Push the validated release commit to the `release` branch.
7. Let the publish workflow compute the npm package version from the GitHub Actions build number.
8. Let the publish workflow run the npm release helper and publish all non-private `@test-station/*` packages at that computed version.

Manual workflow dispatch can run the same npm release helper in validation-only mode, and only publishes when `publish_npm` is explicitly enabled.

## Build-number npm publishing

The npm release workflow uses a build-number versioning model:

- checked-in package manifests keep the baseline semver line such as `0.1.0`
- the publish workflow computes a concrete publish version from CI metadata
- the default mode is `major.minor.<github_run_number>`
- all publishable `@test-station/*` packages are rewritten to that same concrete version before `npm pack` or `npm publish`
- internal `@test-station/*` package dependencies are rewritten from `workspace:*` to the same concrete publish version for the release artifact

Release helpers:

- `./scripts/release/set-version.sh <X.Y.Z>`
- `./scripts/release/set-version-from-build.sh`

Versioning controls:

- `BUILD_NUMBER`: defaults to GitHub `run_number`
- `VERSION_MAJOR`: optional override for major, otherwise current package major
- `VERSION_MINOR`: optional override for minor, otherwise current package minor
- `PATCH_MODE`: `build` or `fixed-minus-build`
- `PATCH_FIXED`: required only when `PATCH_MODE=fixed-minus-build`

Examples:

- `PATCH_MODE=build`, `BUILD_NUMBER=412`, `VERSION_MAJOR=0`, `VERSION_MINOR=1` -> `0.1.412`
- `PATCH_MODE=fixed-minus-build`, `PATCH_FIXED=10000`, `BUILD_NUMBER=412`, `VERSION_MAJOR=1`, `VERSION_MINOR=0` -> `1.0.9588`

## Consumer compatibility promise

For `0.1.x` releases:

- config changes are additive only
- report schema changes are additive only
- built-in adapter ids remain stable
- policy plugin hook names remain stable
- CLI command names remain stable

Breaking changes should wait for `1.0.0` unless there is a correctness or security issue that requires an immediate break.
