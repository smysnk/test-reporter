# test-station

[![npm](https://img.shields.io/npm/v/%40test-station%2Fcli?label=npm)](https://www.npmjs.com/package/@test-station/cli)
[![tests](https://img.shields.io/endpoint?url=https%3A%2F%2Fsmysnk.github.io%2Ftest-station%2Fbadges%2Ftests.json)](https://smysnk.github.io/test-station/)
[![coverage](https://img.shields.io/endpoint?url=https%3A%2F%2Fsmysnk.github.io%2Ftest-station%2Fbadges%2Fcoverage.json)](https://smysnk.github.io/test-station/)

Demo: [Latest self-test report](https://smysnk.github.io/test-station/) | [Latest `report.json`](https://smysnk.github.io/test-station/report.json)

`test-station` is a framework- and language-agnostic test orchestration and reporting toolkit.

It runs suites from multiple test systems, normalizes the results into a single `report.json`, and renders a drillable HTML report with module, theme, package, suite, test, and coverage views.

Built-in adapters currently target common JavaScript tooling, but the execution contract is not tied to a specific language or framework. If a project can produce structured test results or can be wrapped by an adapter, it can be reported through `test-station`.

## Purpose

Use `test-station` when raw test output is too fragmented to be operationally useful.

Typical cases:

- monorepos with multiple packages and mixed frameworks
- projects that combine unit, browser, e2e, and shell-driven validation
- teams that need one report surface for pass/fail, duration, ownership, and coverage
- projects that want policy-aware grouping such as modules, themes, or product areas

## What It Produces

A run produces:

- `report.json`: normalized machine-readable results
- `index.html`: interactive HTML report
- `raw/`: per-suite raw artifacts and framework output

The HTML report supports:

- module-first and package-first views
- progressive drilldown from summary to individual test detail
- pass/fail, duration, and test-count rollups
- coverage rollups and per-file coverage tables
- optional ownership, classification, and source-analysis enrichment

### Report Overview

![Report overview](./docs/assets/report-overview.png)

### Drilldown View

![Report drilldown](./docs/assets/report-drilldown.png)

## Architecture

The system is split into small packages with explicit boundaries.

1. `@test-station/cli`
   Main install package. Runs configured suites and writes JSON + HTML artifacts.
2. `@test-station/core`
   Loads config, resolves adapters, executes suites, normalizes results, applies policy, and builds the report model.
3. `@test-station/render-html`
   Renders the normalized report into the interactive HTML UI.
4. Built-in adapters
   - `@test-station/adapter-node-test`
   - `@test-station/adapter-vitest`
   - `@test-station/adapter-playwright`
   - `@test-station/adapter-shell`
   - `@test-station/adapter-jest`
5. Built-in enrichment/plugin package
   - `@test-station/plugin-source-analysis`

### Execution Flow

```mermaid
flowchart LR
  A["test-station.config.mjs"] --> B["@test-station/cli"]
  B --> C["@test-station/core"]
  C --> D["Adapters"]
  D --> E["Normalized suite results"]
  E --> F["Policy and plugin pipeline"]
  F --> G["report.json"]
  F --> H["@test-station/render-html"]
  H --> I["index.html"]
```

### Package Responsibilities

- `@test-station/cli`: command entrypoint and artifact writing
- `@test-station/core`: config loading, orchestration, normalization, aggregation, coverage rollups, policy pipeline
- `@test-station/render-html`: browser report UI and report rendering
- `@test-station/adapter-node-test`: direct `node --test` execution and normalization
- `@test-station/adapter-vitest`: Vitest execution, normalization, and coverage collection
- `@test-station/adapter-playwright`: Playwright execution and normalization
- `@test-station/adapter-shell`: arbitrary command-backed suites
- `@test-station/adapter-jest`: Jest execution, normalization, and coverage collection
- `@test-station/plugin-source-analysis`: static enrichment of assertions, setup, mocks, and source snippets

## Quickstart

### Local Checkout

This is the fastest way to see the reporter running against its own test suite.

```sh
git clone https://github.com/smysnk/test-station.git
cd test-station
yarn install
yarn test:coverage
```

Artifacts are written to:

```text
.test-results/self-test-report/
```

### npm Install

For most consumers, install `@test-station/cli`. It provides the `test-station` binary and brings in `@test-station/core`, `@test-station/render-html`, and the built-in adapters used by the default runtime.

```sh
npm install --save-dev @test-station/cli
```

Install additional packages only when you need them directly:

- `@test-station/core` for `defineConfig(...)`, `runReport(...)`, or other programmatic control
- `@test-station/render-html` when rendering HTML from an existing `report.json`
- `@test-station/plugin-source-analysis` when importing the enrichment plugin directly
- `@test-station/adapter-*` when assembling a custom adapter registry outside the default core bundle

### Minimal Consumer Setup

Create `test-station.config.mjs` in the target project:

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
    continueOnError: true,
    defaultCoverage: false,
  },
  suites: [
    {
      id: 'unit',
      label: 'Unit Tests',
      adapter: 'node-test',
      package: 'app',
      cwd: rootDir,
      command: ['node', '--test', './test/**/*.test.js'],
      coverage: {
        enabled: true,
        mode: 'same-run',
      },
    },
  ],
};
```

With `@test-station/cli` installed, run it with:

```sh
npx test-station run --config ./test-station.config.mjs
npx test-station run --config ./test-station.config.mjs --coverage
```

### Package Script Integration

#### Yarn

```json
{
  "scripts": {
    "test": "test-station run --config ./test-station.config.mjs",
    "test:coverage": "test-station run --config ./test-station.config.mjs --coverage"
  }
}
```

#### npm

```json
{
  "scripts": {
    "test": "test-station run --config ./test-station.config.mjs",
    "test:coverage": "test-station run --config ./test-station.config.mjs --coverage"
  }
}
```

#### pnpm

```json
{
  "scripts": {
    "test": "test-station run --config ./test-station.config.mjs",
    "test:coverage": "test-station run --config ./test-station.config.mjs --coverage"
  }
}
```

## Integration Model

A host project typically owns only three things:

- `test-station.config.mjs`
- a classification / coverage attribution / ownership manifest
- optional host-specific plugins or custom adapters when generic ones are not enough

Everything else should be delegated to `test-station`.

### Uniform Runtime Contract

All built-in command-backed adapters follow the same integration rules:

- declare suites explicitly in `test-station.config.mjs`
- pass per-suite environment variables with `suite.env`
- consume normalized output from `report.json`
- use `raw/` for framework-native artifacts and intermediate reports

### Empty Workspaces And Zero-Test Suites

If `workspaceDiscovery.packages` lists a package with no matching suites, that package still appears in the report as `skipped` with zero suites. This is the recommended way to keep explicit monorepo packages visible without inventing synthetic suite results.

If a suite runs and the underlying framework reports zero tests, the suite is normalized as `skipped`.

### Playwright In CI

Consumers using the built-in Playwright adapter must install Playwright browsers in CI before running the reporter.

Typical prerequisite:

```sh
yarn playwright install --with-deps
```

### Raw Artifact Contract

Suites can attach raw artifacts that will be written under `raw/` and linked from the HTML report.

Supported shapes:

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

Use this contract for stable raw links. Do not treat it as a generic process-management or upload system.

### Consumer Modes

There are two supported consumer modes:

1. Local reference checkout
   - useful while the standalone repo is being developed alongside a host project
   - stable host-facing entrypoints are:
     - `./references/test-station/config.mjs`
     - `./references/test-station/bin/test-station.mjs`
2. Installed package dependency
   - install `@test-station/cli` for the published `test-station` binary
   - install `@test-station/core` if you want `defineConfig(...)` or `runReport(...)`
   - install `@test-station/render-html` only when rendering from an existing `report.json` outside the CLI
   - install direct adapter or plugin packages only for custom registries and advanced embedding

For local-reference mode, keep host imports pointed at the root-level entrypoints above rather than `packages/*/src`.

### Classification, Coverage Attribution, And Ownership

If you want the report grouped by product or subsystem instead of leaving tests uncategorized, provide a manifest file.

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

Reference it from config:

```js
manifests: {
  classification: './test-modules.json',
  coverageAttribution: './test-modules.json',
  ownership: './test-modules.json',
}
```

### Custom Policy Plugins

A plugin can hook into these stages:

- `classifyTest(...)`
- `attributeCoverageFile(...)`
- `lookupOwner(...)`
- `enrichTest(...)`

Register plugins like this:

```js
plugins: [
  {
    handler: './scripts/test-station/my-policy-plugin.mjs',
    options: {
      owner: 'platform-team',
    },
  },
]
```

## Examples

- Generic consumer example:
  [`./examples/generic-node-library/test-station.config.mjs`](./examples/generic-node-library/test-station.config.mjs)
- Mixed-framework example:
  [`./examples/mixed-framework-monorepo/test-station.config.mjs`](./examples/mixed-framework-monorepo/test-station.config.mjs)
- Integration guide:
  [`./docs/integrating-a-generic-project.md`](./docs/integrating-a-generic-project.md)

## Development

Run the standalone repo checks with:

```sh
yarn lint
yarn test
yarn build
```

The current external-consumer smoke path is:

```sh
node ./bin/test-station.mjs run --config ./examples/generic-node-library/test-station.config.mjs --coverage
```

## Versioning

All publishable `@test-station/*` packages currently move in lockstep at `0.1.0`.

For deeper release and compatibility details, see:

- [`./docs/integrating-a-generic-project.md`](./docs/integrating-a-generic-project.md)
- [`./docs/versioning-and-release-strategy.md`](./docs/versioning-and-release-strategy.md)
