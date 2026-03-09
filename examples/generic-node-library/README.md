# generic-node-library

Minimal standalone consumer project for the test reporter.

Run from the repository root:

```sh
node ./bin/test-reporter.mjs run --config ./examples/generic-node-library/test-reporter.config.mjs
```

The example intentionally uses only:

- built-in `node:test` adapter
- built-in source-analysis enrichment
- local manifest-driven classification, coverage attribution, and ownership

It does not depend on any repo-specific integration code.
