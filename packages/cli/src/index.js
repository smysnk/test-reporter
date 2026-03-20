import path from 'node:path';
import { loadConfig, summarizeConfig, runReport, readJson, formatConsoleSummary, createConsoleProgressReporter } from '@test-station/core';
import { writeHtmlReport, buildPagesSite } from '@test-station/render-html';

export function parseCliArgs(argv) {
  const parsed = {
    command: argv[0] || 'help',
    config: './test-station.config.mjs',
    input: null,
    output: null,
    outputDir: null,
    dryRun: false,
    coverage: undefined,
    workspaceFilters: [],
  };

  for (let index = 1; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--config') {
      parsed.config = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === '--input') {
      parsed.input = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === '--output') {
      parsed.output = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === '--output-dir') {
      parsed.outputDir = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === '--workspace' || token === '--package') {
      parsed.workspaceFilters.push(argv[index + 1]);
      index += 1;
      continue;
    }
    if (token === '--dry-run') {
      parsed.dryRun = true;
      continue;
    }
    if (token === '--coverage') {
      parsed.coverage = true;
      continue;
    }
    if (token === '--no-coverage') {
      parsed.coverage = false;
    }
  }

  return parsed;
}

export function renderHelp() {
  return [
    'test-station CLI',
    '',
    'Commands:',
    '  test-station inspect --config ./test-station.config.mjs',
    '  test-station run --config ./test-station.config.mjs [--dry-run] [--coverage|--no-coverage] [--workspace <name>|--package <name>] [--output-dir <path>]',
    '  test-station render --input ./artifacts/workspace-tests/report.json --output ./artifacts/workspace-tests',
    '  test-station pages --input ./artifacts/workspace-tests/report.json --output ./artifacts/workspace-tests-pages',
  ].join('\n');
}

export async function runCli(argv = process.argv.slice(2)) {
  const args = parseCliArgs(argv);

  if (args.command === 'help' || args.command === '--help' || args.command === '-h') {
    process.stdout.write(`${renderHelp()}\n`);
    return 0;
  }

  if (args.command === 'inspect') {
    const loaded = await loadConfig(args.config);
    process.stdout.write(`${JSON.stringify({ configPath: loaded.resolvedPath, summary: summarizeConfig(loaded.config) }, null, 2)}\n`);
    return 0;
  }

  if (args.command === 'run') {
    const loaded = await loadConfig(args.config);
    const consoleEnabled = loaded.config?.render?.console !== false;
    let progressReporter = null;

    if (consoleEnabled) {
      progressReporter = createConsoleProgressReporter({ stream: process.stdout });
    }

    const execution = await runReport({
      configPath: args.config,
      dryRun: args.dryRun,
      coverage: args.coverage,
      outputDir: args.outputDir,
      workspaceFilters: args.workspaceFilters,
      onEvent: progressReporter?.onEvent,
    });

    let htmlPath = null;
    if (execution.context.config?.render?.html !== false) {
      htmlPath = writeHtmlReport(execution.report, execution.context.project.outputDir, {
        title: execution.context.project.name,
        projectRootDir: execution.context.project.rootDir,
        defaultView: execution.context.config?.render?.defaultView,
        includeDetailedAnalysisToggle: execution.context.config?.render?.includeDetailedAnalysisToggle,
      });
    }

    if (execution.context.config?.render?.console !== false) {
      process.stdout.write(formatConsoleSummary(execution.report, execution.artifactPaths, { htmlPath }));
    } else {
      process.stdout.write(`${JSON.stringify({ report: execution.artifactPaths.reportJsonPath, html: htmlPath }, null, 2)}\n`);
    }

    return execution.report.summary.failedPackages > 0
      || execution.report.summary.failedSuites > 0
      || (execution.report.summary?.policy?.failedThresholds || 0) > 0
      ? 1
      : 0;
  }

  if (args.command === 'render') {
    const inputPath = args.input || path.resolve(process.cwd(), 'artifacts/workspace-tests/report.json');
    const report = readJson(inputPath);
    const outputDir = args.output || path.dirname(inputPath);
    const reportPath = writeHtmlReport(report, outputDir, {
      title: report?.meta?.projectName || report?.summary?.projectName || 'test-station',
      projectRootDir: report?.meta?.projectRootDir || process.cwd(),
      defaultView: report?.meta?.render?.defaultView,
      includeDetailedAnalysisToggle: report?.meta?.render?.includeDetailedAnalysisToggle,
    });
    process.stdout.write(`${JSON.stringify({ input: inputPath, output: reportPath }, null, 2)}\n`);
    return 0;
  }

  if (args.command === 'pages') {
    const inputPath = args.input || path.resolve(process.cwd(), 'artifacts/workspace-tests/report.json');
    const outputDir = args.output || args.outputDir || path.dirname(inputPath);
    const result = buildPagesSite({
      input: inputPath,
      outputDir,
    });
    process.stdout.write(`${JSON.stringify({ input: inputPath, output: result.outputDir, badges: { tests: result.testsBadgePath, coverage: result.coverageBadgePath, health: result.healthBadgePath } }, null, 2)}\n`);
    return 0;
  }

  process.stderr.write(`Unknown command: ${args.command}\n\n${renderHelp()}\n`);
  return 1;
}
