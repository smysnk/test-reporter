#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { createLegacySummary, readReport, resolveGitContext, writeJson } from './report-json-migration-utils.mjs';

export async function main(argv = process.argv.slice(2), env = process.env) {
  const args = parseArgs(argv);
  if (!args.input || !args.output) {
    throw new Error('Usage: report-json-to-summary --input <report.json> --output <summary.json> [--sha <git-sha>] [--ref <git-ref>]');
  }

  const { report, path: reportPath } = readReport(args.input);
  const payload = createLegacySummary(report, {
    reportPath,
    git: resolveGitContext(args, env),
  });
  const outputPath = writeJson(args.output, payload);
  process.stdout.write(`${outputPath}\n`);
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      continue;
    }
    const [rawKey, inlineValue] = token.split('=', 2);
    const key = rawKey.slice(2);
    if (inlineValue !== undefined) {
      parsed[key] = inlineValue;
      continue;
    }
    parsed[key] = argv[index + 1];
    index += 1;
  }
  return parsed;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
