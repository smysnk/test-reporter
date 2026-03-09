# @test-station/adapter-vitest

Built-in Vitest adapter for Test Station.

Most consumers should install `@test-station/cli` or `@test-station/core` instead of this package directly. The default core bundle already includes the Vitest adapter. Install this package only when you are composing adapters yourself around `@test-station/core`.

## Install

```sh
npm install --save-dev @test-station/adapter-vitest
```

## What It Does

- runs Vitest with JSON output enabled
- normalizes Vitest suite and test results into the shared report model
- collects JSON-summary coverage when coverage is enabled
- writes raw Vitest artifacts under `raw/`

## Direct Use

```js
import { createVitestAdapter } from '@test-station/adapter-vitest';

const adapter = createVitestAdapter();
```

Use adapter id `vitest` in `test-station.config.mjs`.
