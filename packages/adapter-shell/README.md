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
- writes raw shell logs under `raw/`

## Direct Use

```js
import { createShellAdapter } from '@test-station/adapter-shell';

const adapter = createShellAdapter();
```

Use adapter id `shell` in `test-station.config.mjs`.
