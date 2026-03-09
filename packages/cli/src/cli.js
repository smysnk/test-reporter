#!/usr/bin/env node
import { runCli } from './index.js';

runCli().then((code) => {
  process.exit(code);
}).catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exit(1);
});
