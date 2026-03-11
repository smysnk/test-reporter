import fs from 'node:fs';
import path from 'node:path';

export function renderHtmlReport(report, options = {}) {
  const title = options.title || report?.meta?.projectName || 'Test Station';
  const rootDir = resolveRootDir(report, options);
  const defaultView = normalizeView(options.defaultView || report?.meta?.render?.defaultView || 'module');
  const includeDetailedAnalysisToggle = options.includeDetailedAnalysisToggle ?? report?.meta?.render?.includeDetailedAnalysisToggle ?? true;
  const summary = report?.summary || {};
  const packages = Array.isArray(report?.packages) ? report.packages : [];
  const modules = Array.isArray(report?.modules) ? report.modules : [];
  const generatedAt = typeof report?.generatedAt === 'string' ? report.generatedAt : 'unknown';
  const schemaVersion = report?.schemaVersion || '1';
  const projectName = report?.meta?.projectName || title;
  const policySummary = summary?.policy || {};
  const moduleFilterOptions = Array.isArray(summary?.filterOptions?.modules) ? summary.filterOptions.modules : dedupe(modules.map((entry) => entry.module));
  const packageFilterOptions = Array.isArray(summary?.filterOptions?.packages) ? summary.filterOptions.packages : dedupe(packages.map((entry) => entry.name));
  const frameworkFilterOptions = Array.isArray(summary?.filterOptions?.frameworks)
    ? summary.filterOptions.frameworks
    : dedupe([
        ...packages.flatMap((entry) => entry.frameworks || []),
        ...modules.flatMap((entry) => entry.frameworks || []),
      ]);

  const moduleCards = modules.map((entry) => renderModuleCard(entry)).join('');
  const moduleSections = modules.map((entry) => renderModuleSection(entry, rootDir)).join('');
  const packageCards = packages.map((entry) => renderPackageCard(entry)).join('');
  const packageSections = packages.map((entry) => renderPackageSection(entry, rootDir)).join('');
  const coverageAttribution = summary.coverageAttribution || null;
  const coverageAttributionCards = coverageAttribution?.totalFiles > 0
    ? [
        renderSummaryCard('Attributed Files', coverageAttribution.attributedFiles),
        renderSummaryCard('Shared Files', coverageAttribution.sharedFiles),
        renderSummaryCard('Unattributed Files', coverageAttribution.unattributedFiles),
      ].join('')
    : '';

  return `<!DOCTYPE html>
<html lang="en" data-view="${escapeHtml(defaultView)}" data-show-detail="false">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #07111f;
      --bg-soft: #0d1c31;
      --panel: rgba(16, 28, 49, 0.82);
      --panel-strong: rgba(22, 36, 61, 0.94);
      --border: rgba(124, 160, 224, 0.16);
      --border-strong: rgba(124, 160, 224, 0.3);
      --text: #eef4ff;
      --muted: #99a9c4;
      --pass: #4ee38b;
      --fail: #ff6f8f;
      --skip: #f7c55a;
      --accent: #6bb2ff;
      --shadow: 0 22px 80px rgba(2, 8, 20, 0.45);
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    * { box-sizing: border-box; }
    [hidden] { display: none !important; }
    body {
      margin: 0;
      min-height: 100vh;
      color: var(--text);
      background:
        radial-gradient(circle at top left, rgba(107, 178, 255, 0.22), transparent 32%),
        radial-gradient(circle at top right, rgba(78, 227, 139, 0.12), transparent 26%),
        linear-gradient(180deg, #08101b 0%, #07111f 55%, #050c16 100%);
    }
    main {
      width: min(1400px, calc(100vw - 48px));
      margin: 0 auto;
      padding: 32px 0 56px;
    }
    .hero,
    .panel,
    .module-section,
    .theme-section,
    .package-group,
    .suite,
    .test-row {
      border: 1px solid var(--border);
      background: var(--panel);
      box-shadow: var(--shadow);
      backdrop-filter: blur(18px);
    }
    .hero {
      padding: 28px;
      border-radius: 28px;
      margin-bottom: 22px;
      background:
        radial-gradient(circle at top left, rgba(107, 178, 255, 0.24), transparent 35%),
        linear-gradient(135deg, rgba(29, 45, 72, 0.96), rgba(10, 18, 34, 0.92));
    }
    h1 {
      margin: 0 0 10px;
      font-size: clamp(2.1rem, 5vw, 3.4rem);
      line-height: 0.95;
      letter-spacing: -0.05em;
    }
    .hero p {
      margin: 0;
      max-width: 72ch;
      color: var(--muted);
      font-size: 1rem;
      line-height: 1.6;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
      gap: 14px;
      margin-top: 22px;
    }
    .summary-card {
      padding: 16px 18px;
      border-radius: 18px;
      border: 1px solid var(--border);
      background: rgba(11, 20, 36, 0.7);
    }
    .summary-card__label {
      display: block;
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--muted);
      margin-bottom: 8px;
    }
    .summary-card__value {
      font-size: 1.7rem;
      letter-spacing: -0.04em;
    }
    .toolbar {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: flex-start;
      margin-bottom: 18px;
      padding: 16px 20px;
      border-radius: 20px;
      flex-wrap: wrap;
    }
    .toolbar__meta {
      color: var(--muted);
      font-size: 0.95rem;
    }
    .toolbar__controls {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .toolbar__filters {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      align-items: center;
      justify-content: flex-end;
    }
    .view-toggle {
      display: inline-flex;
      gap: 4px;
      padding: 4px;
      border-radius: 999px;
      background: rgba(11, 20, 36, 0.7);
      border: 1px solid var(--border);
    }
    .view-toggle__button {
      appearance: none;
      border: 0;
      background: transparent;
      color: var(--muted);
      cursor: pointer;
      font: inherit;
      padding: 8px 12px;
      border-radius: 999px;
    }
    html[data-view="module"] .view-toggle__button[data-view-button="module"],
    html[data-view="package"] .view-toggle__button[data-view-button="package"] {
      background: color-mix(in srgb, var(--accent) 18%, rgba(11, 20, 36, 0.92));
      color: var(--text);
    }
    .toolbar__toggle {
      display: inline-flex;
      gap: 10px;
      align-items: center;
      padding: 10px 14px;
      border-radius: 999px;
      background: rgba(11, 20, 36, 0.7);
      border: 1px solid var(--border);
      cursor: pointer;
      user-select: none;
    }
    .toolbar__toggle input { accent-color: var(--accent); }
    .filter-control {
      display: grid;
      gap: 6px;
      min-width: 150px;
    }
    .filter-control__label {
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--muted);
    }
    .filter-control__input,
    .toolbar__button {
      appearance: none;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: rgba(11, 20, 36, 0.8);
      color: var(--text);
      padding: 10px 12px;
      font: inherit;
    }
    .toolbar__button { cursor: pointer; }
    .toolbar__filtersMeta {
      color: var(--muted);
      font-size: 0.85rem;
      min-height: 20px;
      width: 100%;
    }
    html[data-view="module"] .view-pane--package,
    html[data-view="package"] .view-pane--module {
      display: none;
    }
    .module-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 14px;
      margin-bottom: 26px;
    }
    .module-card {
      appearance: none;
      width: 100%;
      text-align: left;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding: 16px 18px;
      border-radius: 22px;
      color: inherit;
      border: 1px solid var(--border);
      background: linear-gradient(160deg, rgba(17, 29, 49, 0.92), rgba(9, 17, 31, 0.82));
      box-shadow: var(--shadow);
    }
    .module-card.status-failed { border-color: color-mix(in srgb, var(--fail) 30%, transparent); }
    .module-card.status-passed { border-color: color-mix(in srgb, var(--pass) 20%, transparent); }
    .module-card.status-skipped { border-color: color-mix(in srgb, var(--skip) 20%, transparent); }
    .module-card__header {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: flex-start;
    }
    .module-card__name {
      font-size: 1rem;
      font-weight: 600;
    }
    .module-card__meta {
      font-size: 0.85rem;
      color: var(--muted);
    }
    .module-card__summary {
      display: grid;
      gap: 4px;
    }
    .owner-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      width: fit-content;
      padding: 6px 10px;
      border-radius: 999px;
      border: 1px solid color-mix(in srgb, var(--accent) 22%, transparent);
      background: color-mix(in srgb, var(--accent) 10%, rgba(11, 20, 36, 0.82));
      color: var(--text);
      font-size: 0.74rem;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .module-card__coverage { display: grid; gap: 10px; }
    .coverage-mini { display: grid; gap: 6px; }
    .coverage-mini__row {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      font-size: 0.78rem;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .coverage-mini__value {
      color: var(--text);
      letter-spacing: 0;
      text-transform: none;
    }
    .coverage-mini__bar {
      height: 8px;
      border-radius: 999px;
      overflow: hidden;
      background: rgba(255, 111, 143, 0.14);
      border: 1px solid rgba(124, 160, 224, 0.12);
    }
    .coverage-mini__fill { height: 100%; border-radius: inherit; }
    .module-stack { display: grid; gap: 18px; }
    .module-section,
    .theme-section,
    .package-group,
    .suite {
      border-radius: 24px;
      background: linear-gradient(180deg, rgba(14, 24, 42, 0.94), rgba(8, 16, 29, 0.92));
    }
    .module-section > summary,
    .theme-section > summary,
    .package-group > summary,
    .suite > summary {
      list-style: none;
      cursor: pointer;
    }
    .module-section > summary::-webkit-details-marker,
    .theme-section > summary::-webkit-details-marker,
    .package-group > summary::-webkit-details-marker,
    .suite > summary::-webkit-details-marker {
      display: none;
    }
    .module-section__summary,
    .theme-section__summary,
    .package-group__summary,
    .suite__summaryRow {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: baseline;
      flex-wrap: wrap;
      padding: 22px;
    }
    .module-section[open] > summary,
    .theme-section[open] > summary,
    .package-group[open] > summary,
    .suite[open] > summary {
      border-bottom: 1px solid rgba(124, 160, 224, 0.12);
    }
    .module-section__title,
    .theme-section__title,
    .package-group__title {
      margin: 0;
      font-size: 1.5rem;
      letter-spacing: -0.04em;
    }
    .theme-section__title { font-size: 1.18rem; }
    .package-group__title { font-size: 1rem; }
    .module-section__meta,
    .theme-section__meta,
    .package-group__meta {
      color: var(--muted);
      font-size: 0.92rem;
    }
    .module-section__body,
    .theme-section__body,
    .package-group__body,
    .suite__body {
      display: grid;
      gap: 16px;
      padding: 18px 22px 22px;
    }
    .module-section__headline,
    .theme-section__headline,
    .package-group__headline {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .module-section__packages { color: var(--muted); font-size: 0.9rem; }
    .theme-list,
    .package-list,
    .suite-list {
      display: grid;
      gap: 16px;
    }
    .theme-section {
      border-radius: 20px;
      background: linear-gradient(180deg, rgba(15, 25, 44, 0.95), rgba(9, 18, 33, 0.88));
    }
    .package-group {
      border-radius: 18px;
      background: rgba(10, 18, 33, 0.72);
      border: 1px solid rgba(124, 160, 224, 0.12);
      box-shadow: none;
    }
    .suite {
      border-radius: 18px;
      padding: 0;
      background: rgba(6, 13, 24, 0.58);
      border: 1px solid rgba(124, 160, 224, 0.1);
      box-shadow: none;
    }
    .suite__label { font-size: 1rem; font-weight: 600; }
    .suite__runtime {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--muted);
    }
    .suite__summary { color: var(--muted); font-size: 0.88rem; }
    .suite__warnings {
      margin: 0;
      padding-left: 20px;
      color: var(--skip);
    }
    .suite__artifacts {
      display: grid;
      gap: 10px;
      padding: 14px;
      border-radius: 16px;
      border: 1px solid rgba(124, 160, 224, 0.12);
      background: rgba(11, 20, 36, 0.66);
    }
    .suite__artifactsTitle {
      margin: 0;
      font-size: 0.82rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--muted);
    }
    .suite__artifactList {
      margin: 0;
      padding-left: 18px;
      display: grid;
      gap: 8px;
    }
    .suite__artifactLink {
      color: var(--accent);
      text-decoration: none;
    }
    .suite__artifactLink:hover {
      text-decoration: underline;
    }
    .suite__artifactMeta {
      color: var(--muted);
      font-size: 0.84rem;
      margin-left: 6px;
    }
    .test-list { display: grid; gap: 12px; }
    .test-row {
      border-radius: 16px;
      padding: 14px 16px;
      background: rgba(6, 13, 24, 0.78);
      border-color: rgba(124, 160, 224, 0.12);
    }
    .test-row[open] { border-color: var(--border-strong); }
    .test-row__summary {
      display: grid;
      grid-template-columns: auto 1fr auto auto;
      gap: 12px;
      align-items: start;
      list-style: none;
      cursor: pointer;
    }
    .status-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 66px;
      padding: 6px 10px;
      border-radius: 999px;
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .status-pill.pass { background: color-mix(in srgb, var(--pass) 18%, transparent); color: var(--pass); }
    .status-pill.fail { background: color-mix(in srgb, var(--fail) 18%, transparent); color: var(--fail); }
    .status-pill.skip { background: color-mix(in srgb, var(--skip) 18%, transparent); color: var(--skip); }
    .policy-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 6px 10px;
      border-radius: 999px;
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      border: 1px solid rgba(124, 160, 224, 0.14);
    }
    .policy-pill--pass { background: color-mix(in srgb, var(--pass) 16%, transparent); color: var(--pass); }
    .policy-pill--warn { background: color-mix(in srgb, var(--skip) 18%, transparent); color: var(--skip); }
    .policy-pill--fail { background: color-mix(in srgb, var(--fail) 18%, transparent); color: var(--fail); }
    .policy-pill--skip { background: rgba(124, 160, 224, 0.14); color: var(--muted); }
    .module-card__badges,
    .module-section__badges,
    .theme-section__badges {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .test-row__name { min-width: 0; }
    .test-row__title {
      display: block;
      font-weight: 600;
      margin-bottom: 4px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .test-row__file,
    .test-row__duration { font-size: 0.83rem; color: var(--muted); }
    .test-row__details {
      display: none;
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid rgba(124, 160, 224, 0.12);
    }
    html[data-show-detail="true"] .test-row__details,
    .test-row[open] .test-row__details {
      display: grid;
      gap: 14px;
    }
    .detail-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 14px;
    }
    .detail-card {
      padding: 14px;
      border-radius: 14px;
      border: 1px solid rgba(124, 160, 224, 0.12);
      background: rgba(11, 20, 36, 0.66);
    }
    .detail-card h4 {
      margin: 0 0 10px;
      font-size: 0.82rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--muted);
    }
    .detail-card ul {
      margin: 0;
      padding-left: 18px;
      display: grid;
      gap: 8px;
    }
    .detail-card pre {
      margin: 0;
      white-space: pre-wrap;
      word-break: break-word;
      font-size: 0.82rem;
      color: #d7e5ff;
    }
    .failure-list {
      margin: 0;
      padding-left: 18px;
      color: #ffd8e1;
      display: grid;
      gap: 8px;
    }
    .coverage-block {
      margin: 0 0 16px;
      padding: 14px;
      border-radius: 16px;
      border: 1px solid rgba(124, 160, 224, 0.14);
      background: rgba(8, 16, 29, 0.68);
    }
    .coverage-block__grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 10px;
      margin-bottom: 12px;
    }
    .coverage-metric {
      padding: 10px 12px;
      border-radius: 12px;
      background: rgba(11, 20, 36, 0.72);
      border: 1px solid rgba(124, 160, 224, 0.1);
    }
    .coverage-metric__label {
      display: block;
      font-size: 0.75rem;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 6px;
    }
    .coverage-metric__value {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: baseline;
      font-size: 1.1rem;
      letter-spacing: -0.03em;
    }
    .coverage-metric__counts {
      font-size: 0.78rem;
      color: var(--muted);
      letter-spacing: 0;
    }
    .coverage-metric__bar {
      margin-top: 10px;
      height: 12px;
      border-radius: 999px;
      overflow: hidden;
      background: rgba(255, 111, 143, 0.14);
      border: 1px solid rgba(124, 160, 224, 0.12);
    }
    .coverage-metric__fill {
      height: 100%;
      border-radius: inherit;
      transition: width 180ms ease-out;
    }
    .coverage-block details {
      border-top: 1px solid rgba(124, 160, 224, 0.12);
      padding-top: 12px;
    }
    .coverage-block summary {
      cursor: pointer;
      color: var(--muted);
    }
    .coverage-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 12px;
      font-size: 0.84rem;
    }
    .coverage-table th,
    .coverage-table td {
      text-align: left;
      padding: 8px 10px;
      border-bottom: 1px solid rgba(124, 160, 224, 0.08);
      vertical-align: top;
    }
    .coverage-table th {
      color: var(--muted);
      font-size: 0.74rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .coverage-table code { font-size: 0.8rem; color: #d7e5ff; }
    .policy-block {
      margin: 0 0 16px;
      padding: 14px;
      border-radius: 16px;
      border: 1px solid rgba(124, 160, 224, 0.14);
      background: rgba(8, 16, 29, 0.68);
    }
    .policy-block__header {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
      margin-bottom: 10px;
    }
    .policy-block__title {
      margin: 0;
      font-size: 0.82rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--muted);
    }
    .policy-block__meta {
      font-size: 0.85rem;
      color: var(--muted);
      word-break: break-word;
    }
    .policy-block__list {
      margin: 10px 0 0;
      padding-left: 18px;
      display: grid;
      gap: 8px;
    }
    @media (max-width: 920px) {
      main { width: min(100vw - 24px, 1400px); }
      .toolbar { align-items: flex-start; }
      .toolbar__controls { justify-content: flex-start; }
      .toolbar__filters { justify-content: flex-start; }
      .test-row__summary { grid-template-columns: auto 1fr; }
    }
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <h1>${escapeHtml(title)}</h1>
      <p>Structured test results grouped by logical module first, with package drilldowns, suite-level coverage, and test detail views that can be expanded globally or per test. The renderer consumes only the normalized report data and explicit render options.</p>
      <div class="summary-grid">
        ${renderSummaryCard('Modules', summary.totalModules || 0)}
        ${renderSummaryCard('Packages', summary.totalPackages || 0)}
        ${renderSummaryCard('Suites', summary.totalSuites || 0)}
        ${renderSummaryCard('Tests', summary.totalTests || 0)}
        ${renderSummaryCard('Passed', summary.passedTests || 0)}
        ${renderSummaryCard('Failed', summary.failedTests || 0)}
        ${renderSummaryCard('Skipped', summary.skippedTests || 0)}
        ${policySummary.failedThresholds > 0 ? renderSummaryCard('Threshold Failures', policySummary.failedThresholds) : ''}
        ${policySummary.warningThresholds > 0 ? renderSummaryCard('Threshold Warnings', policySummary.warningThresholds) : ''}
        ${policySummary.diagnosticsSuites > 0 ? renderSummaryCard('Diagnostic Reruns', policySummary.diagnosticsSuites) : ''}
        ${renderSummaryCard('Line Coverage', summary.coverage?.lines ? `${summary.coverage.lines.pct.toFixed(2)}%` : 'n/a')}
        ${renderSummaryCard('Branch Coverage', summary.coverage?.branches ? `${summary.coverage.branches.pct.toFixed(2)}%` : 'n/a')}
        ${renderSummaryCard('Function Coverage', summary.coverage?.functions ? `${summary.coverage.functions.pct.toFixed(2)}%` : 'n/a')}
        ${coverageAttributionCards}
        ${renderSummaryCard('Duration', formatDuration(report?.durationMs || 0))}
      </div>
    </section>

    <section class="panel toolbar">
      <div class="toolbar__meta">Project ${escapeHtml(projectName)} • Schema v${escapeHtml(schemaVersion)} • Generated ${escapeHtml(generatedAt)}</div>
      <div class="toolbar__controls">
        <div class="view-toggle" role="tablist" aria-label="Report view">
          <button type="button" class="view-toggle__button" data-view-button="module">Group by Module</button>
          <button type="button" class="view-toggle__button" data-view-button="package">Group by Package</button>
        </div>
        <div class="toolbar__filters">
          ${renderFilterSelect('module-filter', 'Module', moduleFilterOptions)}
          ${renderFilterSelect('package-filter', 'Package', packageFilterOptions)}
          ${renderFilterSelect('framework-filter', 'Framework', frameworkFilterOptions)}
          <label class="toolbar__toggle">
            <input id="failed-only-toggle" type="checkbox" />
            Failed only
          </label>
          <label class="toolbar__toggle">
            <input id="low-coverage-toggle" type="checkbox" />
            Low coverage only
          </label>
          <label class="filter-control" for="coverage-threshold">
            <span class="filter-control__label">Coverage Threshold</span>
            <select id="coverage-threshold" class="filter-control__input">
              <option value="50">50%</option>
              <option value="60">60%</option>
              <option value="70">70%</option>
              <option value="80" selected>80%</option>
              <option value="90">90%</option>
            </select>
          </label>
          <button type="button" id="clear-filters" class="toolbar__button">Clear filters</button>
        </div>
        ${includeDetailedAnalysisToggle ? `
        <label class="toolbar__toggle">
          <input id="detail-toggle" type="checkbox" />
          Show detailed analysis
        </label>` : ''}
      </div>
      <div id="filter-results" class="toolbar__filtersMeta">No filters applied.</div>
    </section>

    <section class="view-pane view-pane--module">
      <section class="module-grid">
        ${moduleCards || '<div class="module-card status-skipped"><div class="module-card__summary"><span class="module-card__name">No modules</span><span class="module-card__meta">The report did not contain module-grouped results.</span></div></div>'}
      </section>
      <section class="module-stack">
        ${moduleSections || ''}
      </section>
    </section>

    <section class="view-pane view-pane--package">
      <section class="module-grid">
        ${packageCards || '<div class="module-card status-skipped"><div class="module-card__summary"><span class="module-card__name">No packages</span><span class="module-card__meta">The report did not contain package-grouped results.</span></div></div>'}
      </section>
      <section class="module-stack">
        ${packageSections || ''}
      </section>
    </section>
  </main>
  <script>
    const root = document.documentElement;
    const toggle = document.getElementById('detail-toggle');
    const failedOnlyToggle = document.getElementById('failed-only-toggle');
    const lowCoverageToggle = document.getElementById('low-coverage-toggle');
    const coverageThreshold = document.getElementById('coverage-threshold');
    const moduleFilter = document.getElementById('module-filter');
    const packageFilter = document.getElementById('package-filter');
    const frameworkFilter = document.getElementById('framework-filter');
    const clearFiltersButton = document.getElementById('clear-filters');
    const filterResults = document.getElementById('filter-results');
    if (toggle) {
      toggle.addEventListener('change', () => {
        root.dataset.showDetail = toggle.checked ? 'true' : 'false';
      });
    }
    document.querySelectorAll('[data-view-button]').forEach((button) => {
      button.addEventListener('click', () => {
        root.dataset.view = button.dataset.viewButton || 'module';
        applyFilters();
      });
    });
    document.querySelectorAll('[data-open-target]').forEach((button) => {
      button.addEventListener('click', () => {
        if (button.dataset.viewTarget) {
          root.dataset.view = button.dataset.viewTarget;
        }
        const target = document.getElementById(button.dataset.openTarget || '');
        if (!target) {
          return;
        }
        if (typeof target.open === 'boolean') {
          target.open = true;
        }
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    const filterNodes = Array.from(document.querySelectorAll('[data-filter-node]'));

    function parseFilterTokens(value) {
      return new Set(String(value || '').split('|').map((item) => item.trim().toLowerCase()).filter(Boolean));
    }

    function matchesTokenFilter(datasetValue, selectedValue) {
      if (!selectedValue) {
        return true;
      }
      return parseFilterTokens(datasetValue).has(String(selectedValue).trim().toLowerCase());
    }

    function matchesFilters(node, state) {
      const dataset = node.dataset;
      if (state.failedOnly && dataset.filterHasFailures !== 'true') {
        return false;
      }
      if (state.lowCoverageOnly) {
        const pct = Number(dataset.filterLineCoverage);
        if (Number.isFinite(pct) && pct >= state.coverageThreshold) {
          return false;
        }
      }
      if (!matchesTokenFilter(dataset.filterModules, state.module)) {
        return false;
      }
      if (!matchesTokenFilter(dataset.filterPackages, state.packageName)) {
        return false;
      }
      if (!matchesTokenFilter(dataset.filterFrameworks, state.framework)) {
        return false;
      }
      return true;
    }

    function currentFilterState() {
      return {
        failedOnly: Boolean(failedOnlyToggle?.checked),
        lowCoverageOnly: Boolean(lowCoverageToggle?.checked),
        coverageThreshold: Number(coverageThreshold?.value || '80'),
        module: moduleFilter?.value || '',
        packageName: packageFilter?.value || '',
        framework: frameworkFilter?.value || '',
      };
    }

    function updateFilterSummary(state) {
      const topLevelSelector = root.dataset.view === 'package'
        ? '.view-pane--package .module-grid [data-filter-node="package-card"]'
        : '.view-pane--module .module-grid [data-filter-node="module-card"]';
      const visibleTopLevel = Array.from(document.querySelectorAll(topLevelSelector))
        .filter((node) => !node.hidden)
        .length;

      const active = [];
      if (state.failedOnly) active.push('failed');
      if (state.lowCoverageOnly) active.push('coverage < ' + state.coverageThreshold + '%');
      if (state.module) active.push('module=' + state.module);
      if (state.packageName) active.push('package=' + state.packageName);
      if (state.framework) active.push('framework=' + state.framework);

      filterResults.textContent = active.length === 0
        ? 'No filters applied.'
        : visibleTopLevel + ' top-level result' + (visibleTopLevel === 1 ? '' : 's') + ' visible • ' + active.join(' • ');
    }

    function applyFilters() {
      const state = currentFilterState();
      filterNodes.forEach((node) => {
        node.hidden = !matchesFilters(node, state);
      });
      updateFilterSummary(state);
    }

    [failedOnlyToggle, lowCoverageToggle, coverageThreshold, moduleFilter, packageFilter, frameworkFilter]
      .filter(Boolean)
      .forEach((control) => control.addEventListener('change', applyFilters));

    clearFiltersButton?.addEventListener('click', () => {
      if (failedOnlyToggle) failedOnlyToggle.checked = false;
      if (lowCoverageToggle) lowCoverageToggle.checked = false;
      if (coverageThreshold) coverageThreshold.value = '80';
      if (moduleFilter) moduleFilter.value = '';
      if (packageFilter) packageFilter.value = '';
      if (frameworkFilter) frameworkFilter.value = '';
      applyFilters();
    });

    applyFilters();
  </script>
</body>
</html>`;
}

export function writeHtmlReport(report, outputDir, options = {}) {
  const resolvedOutputDir = path.resolve(process.cwd(), outputDir);
  fs.mkdirSync(resolvedOutputDir, { recursive: true });
  const html = renderHtmlReport(report, options);
  const reportPath = path.join(resolvedOutputDir, 'index.html');
  fs.writeFileSync(reportPath, html);
  return reportPath;
}

function resolveRootDir(report, options) {
  const candidate = options.projectRootDir || report?.meta?.projectRootDir || null;
  if (!candidate || typeof candidate !== 'string') {
    return null;
  }
  return path.resolve(candidate);
}

function normalizeView(value) {
  return value === 'package' ? 'package' : 'module';
}

function renderSummaryCard(label, value) {
  return `
    <div class="summary-card">
      <span class="summary-card__label">${escapeHtml(label)}</span>
      <span class="summary-card__value">${escapeHtml(String(value))}</span>
    </div>
  `;
}

function renderStatusPill(status) {
  const normalized = status === 'failed' ? 'fail' : status === 'skipped' ? 'skip' : 'pass';
  return `<span class="status-pill ${normalized}">${escapeHtml(status)}</span>`;
}

function renderCoverageMiniMetric(label, metric) {
  const pct = metric ? metric.pct.toFixed(2) : 'n/a';
  const fillStyle = metric
    ? `width:${metric.pct.toFixed(2)}%;background:hsl(${coverageHue(metric.pct)} 68% 48%);`
    : 'width:0%;background:hsl(0deg 68% 48%);';
  return `
    <div class="coverage-mini">
      <div class="coverage-mini__row">
        <span>${escapeHtml(label)}</span>
        <span class="coverage-mini__value">${escapeHtml(metric ? `${pct}%` : 'n/a')}</span>
      </div>
      <div class="coverage-mini__bar" aria-hidden="true">
        <div class="coverage-mini__fill" style="${fillStyle}"></div>
      </div>
    </div>
  `;
}

function renderFilterSelect(id, label, options) {
  const optionMarkup = (options || [])
    .map((option) => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`)
    .join('');
  return `
    <label class="filter-control" for="${escapeHtml(id)}">
      <span class="filter-control__label">${escapeHtml(label)}</span>
      <select id="${escapeHtml(id)}" class="filter-control__input">
        <option value="">All</option>
        ${optionMarkup}
      </select>
    </label>
  `;
}

function renderOwnerPill(owner) {
  if (!owner) {
    return '';
  }
  return `<span class="owner-pill">Owner: ${escapeHtml(owner)}</span>`;
}

function renderThresholdPill(threshold) {
  if (!threshold?.configured) {
    return '';
  }
  const statusClass = threshold.status === 'failed'
    ? 'fail'
    : (threshold.status === 'warn' ? 'warn' : (threshold.status === 'skipped' ? 'skip' : 'pass'));
  const label = threshold.status === 'failed'
    ? 'Threshold failed'
    : (threshold.status === 'warn' ? 'Threshold warning' : (threshold.status === 'skipped' ? 'Threshold skipped' : 'Threshold met'));
  return `<span class="policy-pill policy-pill--${statusClass}">${escapeHtml(label)}</span>`;
}

function renderThresholdBlock(threshold) {
  if (!threshold?.configured) {
    return '';
  }
  const items = (Array.isArray(threshold.metrics) ? threshold.metrics : [])
    .map((metric) => {
      const actual = Number.isFinite(metric.actualPct) ? `${metric.actualPct.toFixed(2)}%` : 'n/a';
      const annotation = metric.passed
        ? ''
        : (Number.isFinite(metric.actualPct) ? ' <strong>(below threshold)</strong>' : ' <strong>(not evaluated)</strong>');
      return `<li>${escapeHtml(capitalize(metric.metric))} ${escapeHtml(actual)} / minimum ${escapeHtml(metric.minPct.toFixed(2))}%${annotation}</li>`;
    })
    .join('');
  return `
    <section class="policy-block">
      <div class="policy-block__header">
        <h4 class="policy-block__title">Coverage Policy</h4>
        ${renderThresholdPill(threshold)}
      </div>
      <div class="policy-block__meta">${escapeHtml(threshold.reason || `Enforcement: ${threshold.enforcement}`)}</div>
      <ul class="policy-block__list">
        ${items}
      </ul>
    </section>
  `;
}

function renderDiagnosticsBlock(diagnostics) {
  if (!diagnostics || typeof diagnostics !== 'object') {
    return '';
  }
  const meta = [
    formatDuration(diagnostics.durationMs || 0),
    diagnostics.command || '',
  ].filter(Boolean).join(' • ');
  const timeoutNote = diagnostics.timedOut ? '<div class="policy-block__meta">The diagnostics rerun timed out before completion.</div>' : '';
  return `
    <section class="policy-block">
      <div class="policy-block__header">
        <h4 class="policy-block__title">${escapeHtml(diagnostics.label || 'Diagnostics')}</h4>
        ${renderStatusPill(diagnostics.status || 'skipped')}
      </div>
      <div class="policy-block__meta">${escapeHtml(meta || 'No diagnostics metadata recorded.')}</div>
      ${timeoutNote}
    </section>
  `;
}

function renderFilterAttributes({ nodeType, moduleNames = [], packageNames = [], frameworks = [], hasFailures = false, lineCoverage = null }) {
  const attributes = [
    ['data-filter-node', nodeType || 'node'],
    ['data-filter-modules', serializeFilterValues(moduleNames)],
    ['data-filter-packages', serializeFilterValues(packageNames)],
    ['data-filter-frameworks', serializeFilterValues(frameworks)],
    ['data-filter-has-failures', hasFailures ? 'true' : 'false'],
  ];
  if (Number.isFinite(lineCoverage)) {
    attributes.push(['data-filter-line-coverage', Number(lineCoverage).toFixed(2)]);
  }
  return attributes.map(([key, value]) => `${key}="${escapeHtml(value)}"`).join(' ');
}

function renderModuleCard(moduleEntry) {
  const status = deriveStatusFromSummary(moduleEntry.summary);
  const targetId = `module-${slugify(moduleEntry.module)}`;
  const dominantPackages = Array.isArray(moduleEntry.dominantPackages) && moduleEntry.dominantPackages.length > 0
    ? moduleEntry.dominantPackages.join(', ')
    : 'No packages';
  const filterAttrs = renderFilterAttributes({
    nodeType: 'module-card',
    moduleNames: [moduleEntry.module],
    packageNames: moduleEntry.packages,
    frameworks: moduleEntry.frameworks,
    hasFailures: (moduleEntry.summary?.failed || 0) > 0,
    lineCoverage: moduleEntry.coverage?.lines?.pct,
  });
  return `
    <button type="button" class="module-card status-${status}" data-open-target="${escapeHtml(targetId)}" data-view-target="module" ${filterAttrs}>
      <div class="module-card__header">
        <div class="module-card__summary">
          <span class="module-card__name">${escapeHtml(moduleEntry.module)}</span>
          <span class="module-card__meta">${escapeHtml(formatSummary(moduleEntry.summary))}</span>
          <span class="module-card__meta">${escapeHtml(formatDuration(moduleEntry.durationMs || 0))} • ${escapeHtml(`${moduleEntry.packageCount || 0} package${moduleEntry.packageCount === 1 ? '' : 's'}`)}</span>
        </div>
        ${renderStatusPill(status)}
      </div>
      <div class="module-card__badges">
        ${renderOwnerPill(moduleEntry.owner)}
        ${renderThresholdPill(moduleEntry.threshold)}
      </div>
      <div class="module-card__coverage">
        ${renderCoverageMiniMetric('Lines', moduleEntry.coverage?.lines)}
        ${renderCoverageMiniMetric('Branches', moduleEntry.coverage?.branches)}
        ${renderCoverageMiniMetric('Functions', moduleEntry.coverage?.functions)}
      </div>
      <span class="module-card__meta">Packages: ${escapeHtml(dominantPackages)}</span>
    </button>
  `;
}

function renderPackageCard(pkg) {
  const status = pkg.status || deriveStatusFromSummary(pkg.summary);
  const targetId = `package-${slugify(pkg.name)}`;
  const filterAttrs = renderFilterAttributes({
    nodeType: 'package-card',
    moduleNames: pkg.modules,
    packageNames: [pkg.name],
    frameworks: pkg.frameworks,
    hasFailures: (pkg.summary?.failed || 0) > 0,
    lineCoverage: pkg.coverage?.lines?.pct,
  });
  return `
    <button type="button" class="module-card status-${status}" data-open-target="${escapeHtml(targetId)}" data-view-target="package" ${filterAttrs}>
      <div class="module-card__header">
        <div class="module-card__summary">
          <span class="module-card__name">${escapeHtml(pkg.name)}</span>
          <span class="module-card__meta">${escapeHtml(formatSummary(pkg.summary))}</span>
          <span class="module-card__meta">${escapeHtml(formatDuration(pkg.durationMs || 0))} • ${escapeHtml(`${Array.isArray(pkg.suites) ? pkg.suites.length : 0} suite${Array.isArray(pkg.suites) && pkg.suites.length === 1 ? '' : 's'}`)}</span>
        </div>
        ${renderStatusPill(status)}
      </div>
      <div class="module-card__coverage">
        ${renderCoverageMiniMetric('Lines', pkg.coverage?.lines)}
        ${renderCoverageMiniMetric('Branches', pkg.coverage?.branches)}
        ${renderCoverageMiniMetric('Functions', pkg.coverage?.functions)}
      </div>
      <span class="module-card__meta">Location: ${escapeHtml(pkg.location || pkg.name)}</span>
    </button>
  `;
}

function renderModuleSection(moduleEntry, rootDir) {
  const status = deriveStatusFromSummary(moduleEntry.summary);
  const themes = Array.isArray(moduleEntry.themes) ? moduleEntry.themes : [];
  const themeMarkup = themes.length === 0
    ? '<div class="theme-section"><div class="theme-section__summary"><div class="theme-section__headline"><h3 class="theme-section__title">No themes</h3></div><div class="theme-section__meta">No grouped test data was available.</div></div></div>'
    : themes.map((themeEntry) => renderThemeSection(moduleEntry, themeEntry, rootDir)).join('');
  const filterAttrs = renderFilterAttributes({
    nodeType: 'module-section',
    moduleNames: [moduleEntry.module],
    packageNames: moduleEntry.packages,
    frameworks: moduleEntry.frameworks,
    hasFailures: (moduleEntry.summary?.failed || 0) > 0,
    lineCoverage: moduleEntry.coverage?.lines?.pct,
  });
  return `
    <details class="module-section" id="module-${slugify(moduleEntry.module)}" ${filterAttrs}>
      <summary class="module-section__summary">
        <div class="module-section__headline">
          <h2 class="module-section__title">${escapeHtml(moduleEntry.module)}</h2>
          ${renderStatusPill(status)}
        </div>
        <div class="module-section__meta">${escapeHtml(formatSummary(moduleEntry.summary))} • ${escapeHtml(formatDuration(moduleEntry.durationMs || 0))} • ${escapeHtml(`${moduleEntry.packageCount || 0} package${moduleEntry.packageCount === 1 ? '' : 's'}`)}</div>
      </summary>
      <div class="module-section__body">
        <div class="module-section__badges">
          ${renderOwnerPill(moduleEntry.owner)}
          ${renderThresholdPill(moduleEntry.threshold)}
        </div>
        <div class="module-section__packages">Dominant packages: ${escapeHtml((moduleEntry.dominantPackages || []).join(', ') || 'n/a')}</div>
        ${renderThresholdBlock(moduleEntry.threshold)}
        ${renderCoverageBlock(moduleEntry.coverage, rootDir)}
        <div class="theme-list">${themeMarkup}</div>
      </div>
    </details>
  `;
}

function renderPackageSection(pkg, rootDir) {
  const status = pkg.status || deriveStatusFromSummary(pkg.summary);
  const suites = Array.isArray(pkg.suites) ? pkg.suites : [];
  const suiteMarkup = suites.length === 0
    ? '<div class="suite"><div class="suite__summaryRow"><div><span class="suite__label">No test suites</span></div><div class="suite__summary">No package test script was found.</div></div></div>'
    : suites.map((suite) => renderSuite(suite, rootDir, { packageNames: [pkg.name] })).join('');
  const filterAttrs = renderFilterAttributes({
    nodeType: 'package-section',
    moduleNames: pkg.modules,
    packageNames: [pkg.name],
    frameworks: pkg.frameworks,
    hasFailures: (pkg.summary?.failed || 0) > 0,
    lineCoverage: pkg.coverage?.lines?.pct,
  });
  return `
    <details class="module-section" id="package-${slugify(pkg.name)}" ${filterAttrs}>
      <summary class="module-section__summary">
        <div class="module-section__headline">
          <h2 class="module-section__title">${escapeHtml(pkg.name)}</h2>
          ${renderStatusPill(status)}
        </div>
        <div class="module-section__meta">${escapeHtml(formatSummary(pkg.summary))} • ${escapeHtml(formatDuration(pkg.durationMs || 0))} • ${escapeHtml(`${suites.length} suite${suites.length === 1 ? '' : 's'}`)}</div>
      </summary>
      <div class="module-section__body">
        <div class="module-section__packages">Package path: ${escapeHtml(pkg.location || pkg.name)}</div>
        ${renderCoverageBlock(pkg.coverage, rootDir)}
        <div class="suite-list">${suiteMarkup}</div>
      </div>
    </details>
  `;
}

function renderThemeSection(moduleEntry, themeEntry, rootDir) {
  const status = deriveStatusFromSummary(themeEntry.summary);
  const packages = Array.isArray(themeEntry.packages) ? themeEntry.packages : [];
  const packageMarkup = packages.length === 0
    ? '<div class="package-group"><div class="package-group__summary"><div class="package-group__headline"><h4 class="package-group__title">No package groups</h4></div><div class="package-group__meta">No package-level data was available for this theme.</div></div></div>'
    : packages.map((packageEntry) => renderThemePackageSection(moduleEntry, themeEntry, packageEntry, rootDir)).join('');
  const filterAttrs = renderFilterAttributes({
    nodeType: 'theme-section',
    moduleNames: [moduleEntry.module],
    packageNames: themeEntry.packageNames,
    frameworks: themeEntry.frameworks,
    hasFailures: (themeEntry.summary?.failed || 0) > 0,
    lineCoverage: themeEntry.coverage?.lines?.pct,
  });
  return `
    <details class="theme-section" ${filterAttrs}>
      <summary class="theme-section__summary">
        <div class="theme-section__headline">
          <h3 class="theme-section__title">${escapeHtml(`${moduleEntry.module} / ${themeEntry.theme}`)}</h3>
          ${renderStatusPill(status)}
        </div>
        <div class="theme-section__meta">${escapeHtml(formatSummary(themeEntry.summary))} • ${escapeHtml(formatDuration(themeEntry.durationMs || 0))} • ${escapeHtml(`${themeEntry.packageCount || 0} package${themeEntry.packageCount === 1 ? '' : 's'}`)}</div>
      </summary>
      <div class="theme-section__body">
        <div class="theme-section__badges">
          ${renderOwnerPill(themeEntry.owner)}
          ${renderThresholdPill(themeEntry.threshold)}
        </div>
        ${renderThresholdBlock(themeEntry.threshold)}
        ${renderCoverageBlock(themeEntry.coverage, rootDir)}
        <div class="package-list">${packageMarkup}</div>
      </div>
    </details>
  `;
}

function renderThemePackageSection(moduleEntry, themeEntry, packageEntry, rootDir) {
  const status = deriveStatusFromSummary(packageEntry.summary);
  const suites = Array.isArray(packageEntry.suites) ? packageEntry.suites : [];
  const suiteMarkup = suites.length === 0
    ? '<div class="suite"><div class="suite__summaryRow"><div><span class="suite__label">No test suites</span></div><div class="suite__summary">No suite results were grouped under this package.</div></div></div>'
    : suites.map((suite) => renderSuite(suite, rootDir, { packageNames: [packageEntry.name], moduleNames: [moduleEntry.module] })).join('');
  const filterAttrs = renderFilterAttributes({
    nodeType: 'theme-package',
    moduleNames: [moduleEntry.module],
    packageNames: [packageEntry.name],
    frameworks: packageEntry.frameworks,
    hasFailures: (packageEntry.summary?.failed || 0) > 0,
  });
  return `
    <details class="package-group" ${filterAttrs}>
      <summary class="package-group__summary">
        <div class="package-group__headline">
          <h4 class="package-group__title">${escapeHtml(packageEntry.name)}</h4>
          ${renderStatusPill(status)}
        </div>
        <div class="package-group__meta">${escapeHtml(`${moduleEntry.module} / ${themeEntry.theme}`)} • ${escapeHtml(formatSummary(packageEntry.summary))} • ${escapeHtml(formatDuration(packageEntry.durationMs || 0))}</div>
      </summary>
      <div class="package-group__body">
        <div class="suite-list">${suiteMarkup}</div>
      </div>
    </details>
  `;
}

function renderSuite(suite, rootDir, filterContext = {}) {
  const warnings = Array.isArray(suite.warnings) ? suite.warnings : [];
  const tests = Array.isArray(suite.tests) ? suite.tests : [];
  const rawArtifacts = Array.isArray(suite.rawArtifacts) ? suite.rawArtifacts : [];
  const warningMarkup = warnings.length > 0
    ? `<ul class="suite__warnings">${warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join('')}</ul>`
    : '';
  const coverageMarkup = renderCoverageBlock(suite.coverage, rootDir);
  const diagnosticsMarkup = renderDiagnosticsBlock(suite.diagnostics);
  const artifactMarkup = rawArtifacts.length > 0 ? renderRawArtifactBlock(rawArtifacts) : '';
  const testsMarkup = tests.length === 0
    ? '<div class="test-row"><div class="test-row__summary"><span class="status-pill skip">skip</span><div class="test-row__name"><span class="test-row__title">No test results emitted</span></div></div></div>'
    : tests.map((test) => renderTest(suite, test, rootDir, filterContext)).join('');
  const filterAttrs = renderFilterAttributes({
    nodeType: 'suite',
    moduleNames: filterContext.moduleNames || dedupe(tests.map((test) => test.module || 'uncategorized')),
    packageNames: filterContext.packageNames || [],
    frameworks: [suite.runtime],
    hasFailures: (suite.summary?.failed || 0) > 0,
    lineCoverage: suite.coverage?.lines?.pct,
  });
  return `
    <details class="suite" ${filterAttrs}>
      <summary class="suite__summaryRow">
        <div>
          <div class="suite__label">${escapeHtml(suite.label)}</div>
          <div class="suite__runtime">${escapeHtml(suite.runtime || 'custom')} • ${escapeHtml(suite.command || '')}</div>
        </div>
        <div class="suite__summary">${escapeHtml(formatSummary(suite.summary))} • ${escapeHtml(formatDuration(suite.durationMs || 0))}</div>
      </summary>
      <div class="suite__body">
        ${warningMarkup}
        ${coverageMarkup}
        ${diagnosticsMarkup}
        ${artifactMarkup}
        <div class="test-list">${testsMarkup}</div>
      </div>
    </details>
  `;
}

function renderRawArtifactBlock(rawArtifacts) {
  return `
    <section class="suite__artifacts">
      <h4 class="suite__artifactsTitle">Raw Artifacts</h4>
      <ul class="suite__artifactList">
        ${rawArtifacts.map((artifact) => renderRawArtifactItem(artifact)).join('')}
      </ul>
    </section>
  `;
}

function renderRawArtifactItem(artifact) {
  const label = artifact?.label || artifact?.relativePath || 'artifact';
  const kind = artifact?.kind === 'directory' ? 'directory' : 'file';
  const meta = [kind, artifact?.mediaType].filter(Boolean).join(' • ');
  const href = typeof artifact?.href === 'string' && artifact.href.length > 0
    ? artifact.href
    : `raw/${artifact?.relativePath || ''}`;
  return `
    <li>
      <a class="suite__artifactLink" href="${escapeHtml(href)}">${escapeHtml(label)}</a>
      <span class="suite__artifactMeta">${escapeHtml(meta || artifact?.relativePath || '')}</span>
    </li>
  `;
}

function capitalize(value) {
  const normalized = String(value || '');
  return normalized.length > 0 ? normalized[0].toUpperCase() + normalized.slice(1) : normalized;
}

function renderTest(suite, test, rootDir, filterContext = {}) {
  const statusClass = test.status === 'failed' ? 'fail' : test.status === 'skipped' ? 'skip' : 'pass';
  const assertions = Array.isArray(test.assertions) && test.assertions.length > 0
    ? `<div class="detail-card"><h4>Assertions</h4><ul>${test.assertions.map((item) => `<li><code>${escapeHtml(item)}</code></li>`).join('')}</ul></div>`
    : '';
  const setup = Array.isArray(test.setup) && test.setup.length > 0
    ? `<div class="detail-card"><h4>Setup</h4><ul>${test.setup.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>`
    : '';
  const mocks = Array.isArray(test.mocks) && test.mocks.length > 0
    ? `<div class="detail-card"><h4>Mocks</h4><ul>${test.mocks.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>`
    : '';
  const failures = Array.isArray(test.failureMessages) && test.failureMessages.length > 0
    ? `<div class="detail-card"><h4>Failures</h4><ul class="failure-list">${test.failureMessages.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>`
    : '';
  const rawDetails = test.rawDetails && Object.keys(test.rawDetails).length > 0
    ? `<div class="detail-card"><h4>Detail</h4><pre>${escapeHtml(JSON.stringify(test.rawDetails, null, 2))}</pre></div>`
    : '';
  const snippet = test.sourceSnippet
    ? `<div class="detail-card"><h4>Source</h4><pre>${escapeHtml(test.sourceSnippet)}</pre></div>`
    : '';
  const filterAttrs = renderFilterAttributes({
    nodeType: 'test',
    moduleNames: [test.module || 'uncategorized'],
    packageNames: filterContext.packageNames || [],
    frameworks: [suite.runtime],
    hasFailures: test.status === 'failed',
  });
  return `
    <details class="test-row" ${filterAttrs}>
      <summary class="test-row__summary">
        <span class="status-pill ${statusClass}">${escapeHtml(test.status || 'passed')}</span>
        <div class="test-row__name">
          <span class="test-row__title">${escapeHtml(test.fullName || test.name || 'Unnamed test')}</span>
          <span class="test-row__file">${escapeHtml(formatTestLocation(test, rootDir))}</span>
        </div>
        <span class="test-row__duration">${escapeHtml(formatDuration(test.durationMs || 0))}</span>
        <span class="test-row__file">${escapeHtml(suite.label || '')}</span>
      </summary>
      <div class="test-row__details">
        <div class="detail-grid">
          ${assertions}
          ${setup}
          ${mocks}
          ${failures}
          ${snippet}
          ${rawDetails}
        </div>
      </div>
    </details>
  `;
}

function formatTestLocation(test, rootDir) {
  if (!test?.file) {
    return 'No source file';
  }
  const file = rootDir ? path.relative(rootDir, test.file) : test.file;
  if (Number.isFinite(test.line)) {
    return `${file}:${test.line}${Number.isFinite(test.column) ? `:${test.column}` : ''}`;
  }
  return file;
}

function renderCoverageBlock(coverage, rootDir) {
  if (!coverage) {
    return '';
  }
  const files = Array.isArray(coverage.files) ? coverage.files : [];
  const showAttribution = files.some((file) => file.module || file.shared || file.attributionReason);
  const fileRows = files
    .slice(0, 20)
    .map((file) => {
      const displayPath = rootDir ? path.relative(rootDir, file.path) : file.path;
      return `
      <tr>
        <td><code>${escapeHtml(displayPath)}</code></td>
        <td>${escapeHtml(file.lines ? `${file.lines.pct.toFixed(2)}%` : 'n/a')}</td>
        <td>${escapeHtml(file.branches ? `${file.branches.pct.toFixed(2)}%` : 'n/a')}</td>
        <td>${escapeHtml(file.functions ? `${file.functions.pct.toFixed(2)}%` : 'n/a')}</td>
        <td>${escapeHtml(file.statements ? `${file.statements.pct.toFixed(2)}%` : 'n/a')}</td>
        ${showAttribution ? `<td>${escapeHtml(formatCoverageAttribution(file))}</td>` : ''}
      </tr>`;
    })
    .join('');
  return `
    <section class="coverage-block">
      <div class="coverage-block__grid">
        ${renderCoverageMetric('Lines', coverage.lines)}
        ${renderCoverageMetric('Branches', coverage.branches)}
        ${renderCoverageMetric('Functions', coverage.functions)}
        ${renderCoverageMetric('Statements', coverage.statements)}
      </div>
      <details>
        <summary>Coverage by file (${files.length} files, lowest line coverage first)</summary>
        <table class="coverage-table">
          <thead>
            <tr>
              <th>File</th>
              <th>Lines</th>
              <th>Branches</th>
              <th>Functions</th>
              <th>Statements</th>
              ${showAttribution ? '<th>Attribution</th>' : ''}
            </tr>
          </thead>
          <tbody>${fileRows || '<tr><td colspan="6">No coverage files</td></tr>'}</tbody>
        </table>
      </details>
    </section>
  `;
}

function renderCoverageMetric(label, metric) {
  const pct = metric ? metric.pct.toFixed(2) : '0.00';
  const counts = metric ? `${formatCoverageCount(metric.covered)}/${formatCoverageCount(metric.total)}` : 'n/a';
  const fillStyle = metric
    ? `width:${metric.pct.toFixed(2)}%;background:hsl(${coverageHue(metric.pct)} 68% 48%);`
    : 'width:0%;background:hsl(0 68% 48%);';
  return `
    <div class="coverage-metric">
      <span class="coverage-metric__label">${escapeHtml(label)}</span>
      <span class="coverage-metric__value">
        <strong>${escapeHtml(metric ? `${pct}%` : 'n/a')}</strong>
        <span class="coverage-metric__counts">${escapeHtml(counts)}</span>
      </span>
      <div class="coverage-metric__bar" aria-hidden="true">
        <div class="coverage-metric__fill" style="${fillStyle}"></div>
      </div>
    </div>
  `;
}

function formatCoverageAttribution(file) {
  const parts = [];
  if (file.module) {
    parts.push(file.theme ? `${file.module}/${file.theme}` : `${file.module} (module-wide)`);
  }
  if (file.shared) {
    parts.push(file.attributionWeight < 1 ? `shared ${formatCoverageCount(file.attributionWeight)}` : 'shared');
  }
  if (file.attributionSource === 'heuristic') {
    parts.push('heuristic');
  }
  if (file.attributionReason) {
    parts.push(trimForReport(file.attributionReason, 80));
  }
  return parts.join(' • ') || 'n/a';
}

function deriveStatusFromSummary(summary) {
  if (!summary || summary.total === 0) return 'skipped';
  if (summary.failed > 0) return 'failed';
  if (summary.skipped === summary.total) return 'skipped';
  return 'passed';
}

function formatSummary(summary = {}) {
  const total = Number.isFinite(summary.total) ? summary.total : 0;
  const passed = Number.isFinite(summary.passed) ? summary.passed : 0;
  const failed = Number.isFinite(summary.failed) ? summary.failed : 0;
  const skipped = Number.isFinite(summary.skipped) ? summary.skipped : 0;
  return `${total} total • ${passed} passed • ${failed} failed • ${skipped} skipped`;
}

function formatDuration(value) {
  const durationMs = Number.isFinite(value) ? Math.max(0, value) : 0;
  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }
  const seconds = durationMs / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(2)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds.toFixed(1)}s`;
}

function coverageHue(pct) {
  const normalized = Math.max(0, Math.min(100, pct));
  return `${Math.round((normalized / 100) * 120)}deg`;
}

function formatCoverageCount(value) {
  if (!Number.isFinite(value)) {
    return '0';
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function serializeFilterValues(values) {
  return dedupe((values || []).map((value) => normalizeFilterValue(value))).join('|');
}

function normalizeFilterValue(value) {
  return String(value || '').trim().toLowerCase();
}

function dedupe(values) {
  return Array.from(new Set((values || []).filter(Boolean)));
}

function slugify(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function trimForReport(value, maxLength) {
  if (typeof value !== 'string') {
    return value;
  }
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength)}…`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
