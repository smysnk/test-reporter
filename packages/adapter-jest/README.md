# @test-station/adapter-jest

Built-in Jest adapter for Test Station.

Most consumers should install `@test-station/cli` or `@test-station/core` instead of this package directly. The default core bundle already includes the Jest adapter. Install this package only when you are composing adapters yourself around `@test-station/core`.

## Install

```sh
npm install --save-dev @test-station/adapter-jest
```

## What It Does

- runs Jest with JSON output enabled
- normalizes Jest suite and test results into the shared `report.json` model
- collects JSON-summary coverage when coverage is enabled
- writes raw Jest artifacts under `raw/`

## Direct Use

```js
import { createJestAdapter } from '@test-station/adapter-jest';

const adapter = createJestAdapter();
```

Use adapter id `jest` in `test-station.config.mjs`.
