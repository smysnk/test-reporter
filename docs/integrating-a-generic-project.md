# Integrating `test-station` Into a Generic Project

## Scope

This guide describes the stable consumer-facing interface for adopting the reporter in a standalone Yarn, npm, or pnpm project.

## Public surface

Treat these packages as the public integration surface:

- `@test-station/cli`
- `@test-station/core`
- `@test-station/render-html`
- `@test-station/adapter-node-test`
- `@test-station/adapter-vitest`
- `@test-station/adapter-playwright`
- `@test-station/adapter-shell`
- `@test-station/adapter-jest`
- `@test-station/plugin-source-analysis`

A consumer project only needs the CLI for normal use. `core` and the plugin packages matter when you want programmatic control or custom policy hooks.

## Consumer modes

There are two supported ways to consume the reporter:

1. Local reference checkout
   - use this while developing a host project against a sibling checkout of `test-station`
   - stable local-reference entrypoints are:
     - `./references/test-station/config.mjs`
     - `./references/test-station/bin/test-station.mjs`
2. Installed package dependency
   - use the published `test-station` binary in package scripts
   - import `defineConfig` from the published package entrypoint your install layout provides

For local-reference mode, do not point consumers at `packages/*/src`.

## Install patterns

### Yarn

```sh
yarn add -D @test-station/cli @test-station/core @test-station/plugin-source-analysis
```

### npm

```sh
npm install --save-dev @test-station/cli @test-station/core @test-station/plugin-source-analysis
```

### pnpm

```sh
pnpm add -D @test-station/cli @test-station/core @test-station/plugin-source-analysis
```

Until the packages are published, point those dependencies at a checked-out copy of this repository or a Git reference. If you are using a direct local reference, prefer the root-level stable entrypoints above instead of package source files.

## Minimal config

A consumer can export a plain object. `defineConfig(...)` is optional.

```js
const rootDir = import.meta.dirname;

export default {
  schemaVersion: '1',
  project: {
    name: 'my-project',
    rootDir,
    outputDir: 'artifacts/test-report',
    rawDir: 'artifacts/test-report/raw',
  },
  execution: {
    dryRun: false,
    continueOnError: true,
    defaultCoverage: false,
  },
  enrichers: {
    sourceAnalysis: {
      enabled: true,
    },
  },
  suites: [
    {
      id: 'unit',
      label: 'Unit Tests',
      adapter: 'node-test',
      package: 'app',
      cwd: rootDir,
      command: ['node', '--test', './test/**/*.test.js'],
      env: {
        NODE_ENV: 'test',
      },
      coverage: {
        enabled: true,
        mode: 'same-run',
      },
    },
  ],
  adapters: [],
};
```

## Per-suite environment variables

All built-in adapters merge `suite.env` into the child-process environment after sanitizing reporter-owned internals.

Example:

```js
{
  id: 'web-e2e',
  label: 'Web E2E',
  adapter: 'playwright',
  package: 'web',
  command: ['yarn', 'workspace', 'web', 'test:e2e'],
  env: {
    PLAYWRIGHT_BASE_URL: 'http://127.0.0.1:4173',
    DEBUG_TRACES: '1',
  },
}
```

## Package-manager scripts

### Yarn

```json
{
  "scripts": {
    "test": "test-station run --config ./test-station.config.mjs",
    "test:coverage": "test-station run --config ./test-station.config.mjs --coverage"
  }
}
```

### npm

```json
{
  "scripts": {
    "test": "test-station run --config ./test-station.config.mjs",
    "test:coverage": "test-station run --config ./test-station.config.mjs --coverage"
  }
}
```

### pnpm

```json
{
  "scripts": {
    "test": "test-station run --config ./test-station.config.mjs",
    "test:coverage": "test-station run --config ./test-station.config.mjs --coverage"
  }
}
```

## Optional manifests

If you want module/theme grouping and ownership in the HTML report, provide a local manifest file:

```json
{
  "rules": [
    {
      "package": "app",
      "include": ["test/**/*.test.js"],
      "module": "runtime",
      "theme": "api"
    }
  ],
  "coverageRules": [
    {
      "package": "app",
      "include": ["src/**/*.js"],
      "module": "runtime",
      "theme": "api"
    }
  ],
  "ownership": {
    "modules": [
      { "module": "runtime", "owner": "runtime-team" }
    ],
    "themes": [
      { "module": "runtime", "theme": "api", "owner": "runtime-api-team" }
    ]
  }
}
```

Then reference it from `test-station.config.mjs`:

```js
manifests: {
  classification: './test-modules.json',
  coverageAttribution: './test-modules.json',
  ownership: './test-modules.json',
}
```

## Optional custom policy plugins

A plugin can supply any of these hooks:

- `classifyTest(...)`
- `attributeCoverageFile(...)`
- `lookupOwner(...)`
- `enrichTest(...)`

Register plugins in config like this:

```js
plugins: [
  {
    handler: './scripts/test-station/my-policy-plugin.mjs',
    options: {
      owner: 'platform-team'
    }
  }
]
```

## Empty workspaces and zero-test suites

If you define `workspaceDiscovery.packages` and one of those packages has no suites, the package remains visible in the report as `skipped` with zero suites. This is the recommended behavior for explicit monorepos that want report visibility for known packages.

If a suite executes but its framework reports zero tests, the suite is normalized as `skipped`.

## Playwright in CI

The built-in Playwright adapter assumes browsers are already installed in CI.

Typical setup:

```sh
yarn playwright install --with-deps
```

Do this before `test-station run ...` in any CI job that includes Playwright suites.

## Raw artifact contract

Suites can emit raw artifact metadata that becomes:

- copied or written under `raw/`
- visible in `report.json`
- linked from the HTML report

Supported artifact forms:

```js
rawArtifacts: [
  {
    relativePath: 'web-e2e/playwright.json',
    label: 'Playwright JSON',
    content: JSON.stringify(payload, null, 2),
  },
  {
    relativePath: 'web-e2e/trace.zip',
    label: 'Trace ZIP',
    sourcePath: '/absolute/path/to/trace.zip',
    mediaType: 'application/zip',
  },
  {
    relativePath: 'web-e2e/test-results',
    label: 'Copied test-results directory',
    kind: 'directory',
    sourcePath: '/absolute/path/to/test-results',
  },
]
```

Rules:

- `relativePath` is required and is always rooted under `raw/`
- use `content` for generated text or JSON artifacts
- use `sourcePath` for files or directories that already exist on disk
- use `kind: 'directory'` when the source path is a directory you want copied into `raw/`

This keeps artifact access stable without introducing a second report format.

## External-runtime Playwright suites

When the application is already running outside the reporter, keep that runtime choreography in a repo-local custom adapter.

Recommended shape:

1. discover or validate the external runtime before invoking Playwright
2. set `suite.env` values such as `PLAYWRIGHT_BASE_URL`
3. run Playwright or a wrapper command that produces structured results
4. normalize the result into standard suite output
5. attach traces, screenshots, or copied result directories through `rawArtifacts`

Recommended adapter responsibilities:

- dev-port or socket discovery
- runtime-health checks
- repo-specific timeout or forced-shutdown behavior
- copying trace-heavy artifacts into `raw/` through `sourcePath`

Reporter responsibilities should remain:

- suite orchestration
- normalized `report.json`
- HTML rendering
- stable raw artifact links

This is the preferred pattern for clients like `media-organizer` that need a live app and dynamic ports but should still converge on the same final report contract.

## When to keep logic out of core

Do not push repo-specific runtime choreography into the reporter core unless:

- at least two consumers need the same deeper runtime behavior
- or a consumer cannot adapt with a custom adapter without effectively rebuilding a second runner

With the current client set, these remain custom-adapter concerns:

- external app startup
- dynamic port discovery
- repo-specific timeout and forced-shutdown behavior
- framework-specific artifact harvesting that only one client needs

This keeps the public integration model uniform even when one client has a more complex runtime shape.

## Mixed-framework example

See [`../examples/mixed-framework-monorepo/test-station.config.mjs`](../examples/mixed-framework-monorepo/test-station.config.mjs) for a config that combines `jest` and `node-test` in one run while keeping one standard `report.json` output contract.

## Downstream publisher migration

If your repo currently publishes a host-owned summary file for Discord or CI, keep `report.json` as the canonical output and use a temporary transform only while migrating.

See [`./migrating-downstream-publishers.md`](./migrating-downstream-publishers.md) for:

- a compatibility transform example for `.test-results/summary.json`
- a compatibility transform example for `.ci/test-summary.json`
- a direct `report.json` publisher example
  - this is the preferred end state

## Example project

See [`../examples/generic-node-library/test-station.config.mjs`](../examples/generic-node-library/test-station.config.mjs) for a minimal standalone consumer.
