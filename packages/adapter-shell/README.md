# @test-station/adapter-shell

Generic shell-command adapter for Test Station.

Most consumers should install `@test-station/cli` or `@test-station/core` instead of this package directly. The default core bundle already includes the shell adapter. Install this package only when you are composing adapters yourself around `@test-station/core`.

## Install

```sh
npm install --save-dev @test-station/adapter-shell
```

## What It Does

- runs arbitrary command-backed suites
- synthesizes normalized results from exit status and shell output
- supports the `single-check-json-v1` result format for structured single-check suites
- supports the `suite-json-v1` result format for full structured suite payloads, including custom benchmark metrics
- writes raw shell logs under `raw/`

## Structured Single-Check JSON

Use `resultFormat: 'single-check-json-v1'` when the command prints a single JSON object to stdout and you want that payload normalized as one structured check.

```js
{
  adapter: 'shell',
  command: [process.execPath, './scripts/check-mappings.mjs'],
  resultFormat: 'single-check-json-v1',
  resultFormatOptions: {
    name: 'Mapping parity',
    assertions: [
      'Compare local mappings against the upstream reference list.',
    ],
    module: 'transpiler',
    theme: 'analysis',
    warningFields: [
      { field: 'missingFromLocal', label: 'mappings missing locally', mode: 'count-array' },
    ],
    rawDetailsFields: ['referenceCount', 'localCount', 'missingFromLocal', 'localOnly'],
  },
}
```

The adapter stores the JSON payload as a raw artifact, maps configured warning fields into human-readable warnings, and surfaces the selected fields under `test.rawDetails`.

## Structured Suite JSON

Use `resultFormat: 'suite-json-v1'` when the command prints a full suite result object to stdout and you want the shell adapter to preserve richer fields like `tests`, `rawArtifacts`, and `performanceStats`.

```js
{
  adapter: 'shell',
  command: [process.execPath, './scripts/run-benchmarks.mjs'],
  resultFormat: 'suite-json-v1',
}
```

The stdout JSON payload can include:

- `status`
- `durationMs`
- `summary`
- `coverage`
- `tests`
- `warnings`
- `rawArtifacts`
- `performanceStats`

This is the recommended format for benchmark suites that need to publish namespaced metric rows into `report.json` without writing a custom adapter.

## Direct Use

```js
import { createShellAdapter } from '@test-station/adapter-shell';

const adapter = createShellAdapter();
```

Use adapter id `shell` in `test-station.config.mjs`.
