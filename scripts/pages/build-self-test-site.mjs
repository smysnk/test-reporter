import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPagesSite } from '@test-station/render-html';

const defaultInputDir = path.resolve(import.meta.dirname, '..', '..', '.test-results', 'self-test-report');
const defaultOutputDir = path.resolve(import.meta.dirname, '..', '..', '.test-results', 'github-pages');

export function buildSelfTestPagesSite(options = {}) {
  const inputDir = path.resolve(options.inputDir || defaultInputDir);
  const outputDir = path.resolve(options.outputDir || defaultOutputDir);
  return buildPagesSite({
    input: path.join(inputDir, 'report.json'),
    outputDir,
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = buildSelfTestPagesSite();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
