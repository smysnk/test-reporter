# @test-station/adapter-playwright

Built-in Playwright adapter for Test Station.

Most consumers should install `@test-station/cli` or `@test-station/core` instead of this package directly. The default core bundle already includes the Playwright adapter. Install this package only when you are composing adapters yourself around `@test-station/core`.

## Install

```sh
npm install --save-dev @test-station/adapter-playwright
```

## What It Does

- runs Playwright with JSON reporter output
- normalizes browser suite and test results into the shared report model
- writes raw Playwright JSON artifacts under `raw/`

Playwright browsers must already be installed in CI or on the machine executing the suite.

## Direct Use

```js
import { createPlaywrightAdapter } from '@test-station/adapter-playwright';

const adapter = createPlaywrightAdapter();
```

Use adapter id `playwright` in `test-station.config.mjs`.
