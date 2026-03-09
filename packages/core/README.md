# @test-station/core

Programmatic engine for Test Station.

`@test-station/core` loads config, resolves adapters, executes suites, applies policy and enrichment, and builds the normalized `report.json` model. Most consumers should install `@test-station/cli`; install `@test-station/core` when you want direct API access.

## Install

```sh
npm install --save-dev @test-station/core
```

## Install This Package When

- you want `defineConfig(...)` in `test-station.config.mjs`
- you want to call `runReport(...)` programmatically
- you want direct access to config loading or console summary helpers
- you are embedding Test Station into another tool

## Key Exports

- `defineConfig`
- `loadConfig`
- `summarizeConfig`
- `runReport`
- `readJson`
- `formatConsoleSummary`
- `createConsoleProgressReporter`
- `resolveAdapterForSuite`

## Example

```js
import { defineConfig, runReport } from '@test-station/core';

export default defineConfig({
  schemaVersion: '1',
  project: {
    name: 'my-project',
    rootDir: import.meta.dirname,
    outputDir: 'artifacts/test-report',
    rawDir: 'artifacts/test-report/raw',
  },
  suites: [],
});

await runReport({ configPath: './test-station.config.mjs' });
```
