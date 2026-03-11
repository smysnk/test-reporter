# @test-station/adapter-node-test

Built-in `node:test` adapter for Test Station.

Most consumers should install `@test-station/cli` or `@test-station/core` instead of this package directly. The default core bundle already includes the `node:test` adapter. Install this package only when you are composing adapters yourself around `@test-station/core`.

## Install

```sh
npm install --save-dev @test-station/adapter-node-test
```

## What It Does

- runs `node --test` suites and normalizes the output into the shared report model
- injects Node's built-in `--test-reporter` flag for NDJSON capture
- supports coverage for direct `node --test ...` commands and supported package-script wrappers
- writes raw NDJSON artifacts under `raw/`

## Direct Use

```js
import { createNodeTestAdapter } from '@test-station/adapter-node-test';

const adapter = createNodeTestAdapter();
```

Use adapter id `node-test` in `test-station.config.mjs`.

## Supported Coverage Patterns

Coverage collection works when the adapter can safely resolve the executed command to a single `node --test ...` invocation. Supported patterns are:

- direct commands such as `['node', '--test', 'tests/**/*.test.js']`
- package scripts invoked with `yarn`, `npm run`, or `pnpm run` when the script itself resolves directly to `node --test ...`
- explicit `suite.coverage.command` values that resolve to one of the patterns above

Examples:

```js
{
  adapter: 'node-test',
  command: ['yarn', 'test:runtime'],
}
```

```js
{
  adapter: 'node-test',
  command: ['yarn', 'test:runtime'],
  coverage: {
    command: ['node', '--test', 'tests/runtime/**/*.test.js'],
  },
}
```

Shell-heavy wrappers such as chained commands (`&&`, `||`, pipes, redirections) are intentionally not treated as coverage-safe.
