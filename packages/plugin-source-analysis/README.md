# @test-station/plugin-source-analysis

Source-analysis enrichment plugin for Test Station.

Most consumers should install `@test-station/cli` or `@test-station/core` instead of this package directly. The default core bundle already includes this plugin. Install this package only when you want to import and register the plugin yourself.

## Install

```sh
npm install --save-dev @test-station/plugin-source-analysis
```

## What It Does

- parses JavaScript test files with Acorn
- enriches normalized test results with assertions, setup hooks, mocks, and source snippets
- supports shared setup and shared mock extraction

## Direct Use

```js
import { createSourceAnalysisPlugin } from '@test-station/plugin-source-analysis';

const plugin = createSourceAnalysisPlugin({
  includeSharedSetup: true,
  includeSharedMocks: true,
  includeSourceSnippet: true,
});
```

Register the plugin through `plugins` in `test-station.config.mjs` or through a custom programmatic pipeline.
