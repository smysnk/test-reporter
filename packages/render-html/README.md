# @test-station/render-html

Standalone HTML renderer for Test Station reports.

Most consumers should install `@test-station/cli`, which already uses this package. Install `@test-station/render-html` directly when you want to render HTML from an existing `report.json` in your own scripts or tools.

## Install

```sh
npm install --save-dev @test-station/render-html
```

## What It Does

- renders the interactive Test Station HTML report from normalized report data
- supports module-first and package-first views
- links raw artifacts, suite details, and coverage summaries

## Example

```js
import fs from 'node:fs';
import { writeHtmlReport } from '@test-station/render-html';

const report = JSON.parse(fs.readFileSync('./artifacts/test-report/report.json', 'utf8'));
writeHtmlReport(report, './artifacts/test-report', {
  title: report.meta?.projectName || 'Test Station',
});
```
