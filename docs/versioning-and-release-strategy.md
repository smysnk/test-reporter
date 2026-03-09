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
6. Tag the repo with the shared package version.
7. Publish all `@test-station/*` packages at that same version.

## Consumer compatibility promise

For `0.1.x` releases:

- config changes are additive only
- report schema changes are additive only
- built-in adapter ids remain stable
- policy plugin hook names remain stable
- CLI command names remain stable

Breaking changes should wait for `1.0.0` unless there is a correctness or security issue that requires an immediate break.
