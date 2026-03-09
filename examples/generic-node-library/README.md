# generic-node-library

Minimal standalone consumer project for Test Station.

For a published install in a real project, the main package is `@test-station/cli`.

Run from the repository root:

```sh
node ./bin/test-station.mjs run --config ./examples/generic-node-library/test-station.config.mjs
```

The example intentionally uses only:

- built-in `node:test` adapter
- built-in source-analysis enrichment
- local manifest-driven classification, coverage attribution, and ownership

It does not depend on any repo-specific integration code.
