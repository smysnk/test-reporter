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
- optionally collects browser Istanbul coverage when `suite.coverage.strategy` is `browser-istanbul`
- writes suite-scoped browser coverage artifacts under `raw/`

Playwright browsers must already be installed in CI or on the machine executing the suite.

## Browser Coverage

When coverage is enabled for the run and the suite declares:

```js
coverage: {
  enabled: true,
  strategy: 'browser-istanbul',
}
```

the adapter sets:

- `PLAYWRIGHT_BROWSER_COVERAGE=1`
- `PLAYWRIGHT_BROWSER_COVERAGE_DIR=<temp dir>`

The Playwright suite can use those environment variables to persist `window.__coverage__` payloads. Test Station merges those payloads into the normalized suite coverage summary and retains the raw files under a stable suite-scoped artifact directory such as:

```text
raw/<package>-<suite>-playwright-coverage/
```

## Direct Use

```js
import { createPlaywrightAdapter } from '@test-station/adapter-playwright';

const adapter = createPlaywrightAdapter();
```

Use adapter id `playwright` in `test-station.config.mjs`.
