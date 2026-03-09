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
- supports coverage when the suite command is a direct `node --test ...` invocation
- writes raw NDJSON artifacts under `raw/`

## Direct Use

```js
import { createNodeTestAdapter } from '@test-station/adapter-node-test';

const adapter = createNodeTestAdapter();
```

Use adapter id `node-test` in `test-station.config.mjs`.
