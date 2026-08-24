# Ingestion and Test Results Performance Refactoring Plan

## Status

- Phases 0-6 are implemented and the production rollout was accepted on 2026-08-24. Revision `a1d6fa807a7187bd0a8f925f8ccc95b2ef16f625` and image `sha256:84254bb9d81fab9b67d9607cac0754aa5c6197f4e53976060c2cfb72e3bd9c99` passed the release pipeline followed by three consecutive exact-image production checkpoints. The 2026-08-21 code/HAR audit remains the directional pre-refactor baseline; its unavailable historical controlled samples remain honestly marked `partial-capture`.
- Prepared from the current ingestion, GraphQL, SSR, report-rendering, and browser-performance paths.
- This plan intentionally combines ingestion correctness with read-performance work because immutable submissions and precomputed summaries are the foundation for fast result pages.
- Test Station will publish its own benchmark results so each refactoring phase is measured against a frozen pre-refactor baseline and the final state is governed by explicit green budgets.

### Execution record

- Phase 0: implemented locally. Deterministic 100/1,000/10,000-test fixtures, one excluded warm-up plus five-sample aggregation, checked-in budgets, browser/SSR/GraphQL/PostgreSQL profiling conversion, end-to-end ingest measurements, immutable checkpoint generation/validation, and the reusable self-benchmark workflow are present. On 2026-08-24 the current refactored build completed one controlled warm-up plus five budget-enforced large-fixture executions. The historical pre-refactor manifest remains honestly marked `partial-capture`: the missing controlled pre-refactor executions cannot be recreated after rollout and must not be relabeled as immutable evidence.
- Phase 1: implemented behind compatibility retention. `ReportSubmission` owns new raw reports and submission-scoped facts, relational active pointers preserve concurrent tests/coverage/performance publications, receipts distinguish create/deduplicate/revise, project/run advisory locks close concurrent creation races, projections are maintained transactionally, and bounded restartable backfill tooling has durable checkpoints. A real PostgreSQL 16 concurrency run preserved all three kinds. `Run.rawReport` is deliberately retained only for the required stable-release rollback window; normal reads do not select it.
- Phase 2: implemented, deployed, and accepted through the final production checkpoint. Home/project/run overviews are projection-backed, feed pagination uses matching `completed_at DESC, id DESC` cursor/index order, SSR returns shells, project activity and benchmark namespaces load independently, and nested run/project/suite scope is derived and checked server-side.
- Phase 3: implemented, deployed, and accepted through the final production checkpoint. Publisher artifacts carry content hashes and byte sizes; report delivery prefers stored HTML, supports authorization-preserving `ETag`/`304`, records bounded cache outcomes, and uses render-once memory/disk fallback only for legacy records.
- Phase 4: implemented and PostgreSQL-validated. Bounded repository SQL uses top-N-per-series, the 139-metric truncation is removed, benchmark namespaces are independent, Operations excludes per-test timing rows, suite filters/pagination execute in SQL, database pool/timeouts are explicit, and PostgreSQL 16 returned all 141 fixture metrics with checked-in `EXPLAIN (ANALYZE, BUFFERS)` evidence. The 10,000-test Operations response measured 224 KB instead of 8.18 MB after the final scope correction.
- Phase 5: implemented, browser-validated, deployed, and accepted through the final production checkpoint. Suites load 100 tests at a time with cancellation, server filters, stable BFF errors, independent panel retry state, windowed rendering, first-page prefetch, and pipelined next-page fetch. The final three production checkpoints kept suite expansion at or below `185.8 ms` p95 and the second-page fetch at or below `105.5 ms` p95.
- Phase 6: complete and accepted. Read and ingest roles are isolated, the read service is cluster-internal, migrations/backfill run as dedicated locked jobs, reads/web are replicated with readiness and disruption budgets, runtime metrics/dashboards/alerts/runbooks exist, the release is no longer blocked by npm publishing, and each post-deploy benchmark publishes immutable exact-image evidence before enforcing budgets. The first production aggregate exposed home-ready, Operations-render, suite-payload, and concurrent project-activity failures; the accepted implementation measures product-visible readiness directly, defers detailed Operations panels, trims suite projections, coalesces benchmark cache misses, enables a bounded 15-second production read cache, and records mixed-load failures by path. The release pipeline and three consecutive green checkpoints are [32770647334](https://github.com/smysnk/test-station/actions/runs/32770647334), [32771495634](https://github.com/smysnk/test-station/actions/runs/32771495634), and [32771965612](https://github.com/smysnk/test-station/actions/runs/32771965612). The accepted scorecard is checked in under `benchmarks/checkpoints/phase-6/`, and the compatibility `Run.rawReport` column remains intentionally retained for the plan's one-stable-release rollback window rather than being removed prematurely.

### 2026-08-21 audit decision

Continue the existing refactor, but do not deploy it as the final architecture until the Phase 2, Phase 4, and reliability corrections below are complete. The highest-value change is not a GraphQL-to-REST rewrite; it is replacing request-time reconstruction with bounded resource queries over read-optimized projections.

## Problem Statement

Test Station currently treats a CI provider run as both the pipeline identity and the identity of every report submitted by that pipeline. A later submission for the same provider run replaces the normalized facts written by an earlier submission. That makes independently published test, coverage, and performance reports capable of overwriting one another.

The web interface also reconstructs too much information on each request:

- the home route loads the complete visible run feed before showing only the first 30 rows;
- the default run route blocks server rendering on project history and a request per benchmark metric;
- the Operations view requests all nested suites and tests, plus several overlapping aggregates;
- some query-service paths load whole tables and filter them in memory;
- the runner report is regenerated from raw JSON on every view even when an HTML artifact already exists;
- large reports create a correspondingly large browser DOM instead of progressively exposing details.

These are related design problems. The write side should preserve immutable report submissions, and the read side should consume small purpose-built projections rather than rebuilding screens from raw facts.

Test Station already publishes its own correctness report, but its deployed browser-performance results are currently only local benchmark artifacts. The refactor needs a bounded self-observation loop: benchmark the deployed application, convert the measurements into Test Station performance statistics, ingest them as a distinct report submission, and show their movement in Test Station itself. This is a one-generation feedback loop, not an ingest-triggered recursive workflow.

## Current Evidence

The production interface and current code show the scaling behavior clearly:

- the attached `2026-03-23.har` file was recorded on 2026-08-21 and contains one authenticated home-to-run exploration flow;
- the authenticated home response completed in `579 ms`; `516 ms` was attributed to `home-feed-query`;
- the home response was `576,455` decoded bytes and embedded 692 runs while displaying only the initial window;
- opening run `cbeada81-7994-47da-9b42-e797607c7690` took `32,608 ms`, including `32,273 ms` waiting for the first response byte;
- `Server-Timing` attributed `32,085 ms` of the run request to `run-project-benchmark-panels`, compared with `56 ms` for the run header and `96 ms` for project history;
- the run page data was `2,177,626` bytes, of which benchmark panels contributed `2,175,803` bytes (`99.9%`);
- those panels contained 19 namespaces, 139 metrics, and 1,784 returned points; repeated point metadata alone consumed approximately `845 KB`;
- the same response recompresses to approximately `96 KB` with gzip, confirming that server work and decoded-object cost are more important than wire transfer for this incident;
- the report iframe completed in `167 ms`, so per-view report delivery was not the primary blocker in this trace;
- deployed `Server-Timing` and response shapes match the pre-refactor path, while the repository contains a separate uncommitted local implementation;
- the existing focused ingestion and GraphQL/web tests pass, demonstrating that replacement behavior is currently intentional or under-specified rather than an isolated failing test;
- 79 focused query/web/performance tests passed during the audit, but they use mocked models and do not prove PostgreSQL plans, bounded rows read, the 139-metric case, concurrency, or the 10,000-test browser path;
- the browser performance suite records useful timings, but a budget is skipped when its environment variable is not set;
- the release workflow already publishes Test Station's self-test report to its own ingest endpoint, while the Playwright performance suite writes `latest.json` and timestamped benchmark snapshots that are not yet converted or published as performance statistics.

### Confirmed request amplification

The deployed run loader expands every catalog metric into a separate internal GraphQL request. The audited project contains 139 metrics, so one browser navigation can create approximately 139 concurrent `performanceTrend` requests. Each request independently loads visible projects, project runs, active submissions, project versions, and matching statistics before sorting and limiting in JavaScript.

The local batch query removes the HTTP fan-out but does not yet bound database work. It loads all project runs and all matching historical statistics, then retains only the newest points per metric in application memory. It also applies `.slice(0, 100)` to metric selections without pagination or an explicit error, which would omit 39 metrics from the audited project.

## Goals

1. Preserve every logically distinct report published by a CI pipeline run.
2. Make test, coverage, and performance publication idempotent without allowing one report type to erase another.
3. Make the home page cost proportional to the requested page size, not the total run count.
4. Make a run shell visible without waiting for history, benchmark, or detailed test queries.
5. Serve unchanged report HTML without regenerating it on every view.
6. Keep query count and rows read bounded as suites and test cases increase.
7. Support reports with at least 10,000 test cases through pagination and progressive rendering.
8. Enforce performance budgets in CI using deterministic data-size tiers.
9. Preserve project authorization for every new query, projection, artifact, and cache path.
10. Have Test Station continuously report its own browser, API, query, ingest, and report-delivery performance metrics.
11. Freeze a reproducible pre-refactor baseline and make phase-by-phase improvements visible against it.
12. Require the final refactored implementation to reach green budgets for all critical scenarios.

## Non-Goals

- Replacing GraphQL or Next.js as part of this work.
- Adding WebSockets or streaming ingestion.
- Rebuilding the entire Operations Overview visual design.
- Deleting raw reports or normalized facts after projections are introduced.
- Making mutable historical reports the normal workflow; administrative repair remains an explicit exceptional path.

## Current Repository Seams

### Ingestion identity and persistence

- [packages/server/ingest/normalize.js](../packages/server/ingest/normalize.js) currently derives a run external key from project, provider, and provider run ID.
- the deployed [packages/server/ingest/service.js](../packages/server/ingest/service.js) path upserts that run and replaces its facts; the local implementation adds immutable submission revisions but still normalizes and persists synchronously in the read-server process;
- [tests/phase11-ingestion-api.test.js](../tests/phase11-ingestion-api.test.js) covers both the deployed replacement contract and the local submission-revision proposal.
- [scripts/ingest-report-utils.mjs](../scripts/ingest-report-utils.mjs) already publishes report artifacts, including generated HTML.

### Home and run loading

- deployed [packages/web/lib/queries.js](../packages/web/lib/queries.js) requests an unbounded home feed and verbose benchmark points; the local version limits the feed but retains a large Operations query and verbose benchmark point fields;
- deployed [packages/web/pages/index.js](../packages/web/pages/index.js) embeds the complete feed; the local version adds a paginated 31-row lookahead and network-backed “load more”;
- deployed [packages/web/lib/serverGraphql.js](../packages/web/lib/serverGraphql.js) blocks run SSR on project history and per-metric benchmark fan-out; the local version splits the run shell but still blocks project SSR and loads all run insights eagerly;
- local [packages/web/pages/runs/[id].js](../packages/web/pages/runs/%5Bid%5D.js) progressively loads suite tests but combines secondary requests into a shared failure boundary and does not virtualize accumulated rows;
- local [packages/web/pages/api/runs/[id]/report.js](../packages/web/pages/api/runs/%5Bid%5D/report.js) prefers stored artifacts and supports validators, with process-local rendering as the legacy fallback.

### Query and profiling layers

- [packages/server/graphql/query-service.js](../packages/server/graphql/query-service.js) contains current run-feed, nested test, artifact, file, trend, and comparison reads.
- [packages/server/graphql/queries.js](../packages/server/graphql/queries.js) resolves nested suites and tests.
- [packages/web/lib/pageProfiling.js](../packages/web/lib/pageProfiling.js) provides existing page and server-timing instrumentation.
- [tests/e2e/live-navigation-performance.spec.js](../tests/e2e/live-navigation-performance.spec.js) captures browser timings and resources but does not enforce unset budgets.
- [.github/workflows/publish.yml](../.github/workflows/publish.yml) publishes the repository's correctness report back to Test Station and is the existing self-reporting precedent.
- [test-station.config.mjs](../test-station.config.mjs) defines the current repository self-test suite.
- [packages/adapter-shell/README.md](../packages/adapter-shell/README.md) documents the existing `suite-json-v1` path for publishing namespaced performance statistics.

## Adjacent Refactoring Requirements

These changes are part of the performance and reliability work because they remove hidden database reads, ambiguous ownership, and repeated authorization. They should be completed in the same phased program rather than deferred as cosmetic cleanup.

### Explicit data-access use cases

The current query service is a large multi-domain object whose methods repeatedly call `listProjects`, `findRun`, and `listSuitesForRun`. `findRun` loads the full Sequelize row, including `rawReport`, and decorates it with version and coverage data even when a caller only needs to authorize a run ID. Consequently, a nominally lightweight run-shell or authorization check can deserialize a large report and repeat related reads.

Split it into explicit repositories/use cases:

- `authorizeRunRef`: run ID, project ID, visibility, and no report body;
- `getRunOverview`: compact run projection and artifact availability;
- `getRunSubmission`: immutable submission identity and summary;
- `getRawReport`: legacy report delivery only;
- `listRunFeed`, `listSuiteTests`, `listCoverageHistory`, and `listBenchmarkSeries`: bounded resource queries;
- separate administration repositories from public/read-side repositories.

Create one request-scoped data context that resolves the actor, authorized project scope, run references, versions, and active submissions once. GraphQL field composition must reuse this context so one operation does not repeat the same authorization and database reads for each field. Production data access must not contain whole-table ORM fallbacks added only to support fake test models; tests should mock repository contracts instead.

### Server-derived parent scope

Resource ownership must always be derived by the server:

```text
run ID -> authorized run -> project ID
run ID + suite ID -> authorized suite belonging to that run
submission ID -> authorized run/project
```

Do not accept a `projectKey` from the browser as authority for run insights, and do not ignore the run ID in a nested suite route. A mismatched parent/child identifier must return `404` or a stable authorization-safe error rather than combining data from different resources.

### Identity trust boundary

The web tier currently forwards actor identity to GraphQL through `x-test-station-actor-*` headers. This contract is valid only across a protected internal boundary. The final topology must do one of the following:

- keep GraphQL private to the web/read tier, strip actor headers at every external ingress, and enforce network policy; or
- sign short-lived internal actor assertions and verify audience, issuer, expiry, and signature in the server.

An unverified actor-role header must never grant administrative authority. Trust-boundary behavior belongs in integration and deployment tests, not only helper-unit tests.

### API contracts and failure semantics

Create a shared BFF handler wrapper for method validation, session resolution, trace propagation, input validation, cache policy, timeouts, and error translation. New endpoints must use a stable envelope such as:

```json
{
  "error": {
    "code": "RUN_INSIGHTS_UNAVAILABLE",
    "message": "Unable to load run insights",
    "requestId": "...",
    "retryable": true
  }
}
```

Do not return raw internal exception messages to the browser. Do not translate dependency failures into empty benchmark/trend arrays: partial responses must identify which resource failed, while independent panels retain their successful data and retry state.

Define runtime-validated request/response contracts for BFF boundaries and generated or checked GraphQL operation types. Promote stable domain values such as status, submission kind, artifact kind, and benchmark direction from unconstrained strings to shared enums/constants and database checks where migration-safe.

### Module and client-state boundaries

Split the query service, `serverGraphql`, run page, and benchmark components by domain capability rather than accumulating more conditional branches in their current large modules. Keep public exports narrow and avoid generic utility modules that merely relocate coupling.

The run UI should own independent resources instead of merging arbitrary endpoint objects into one mutable `resolvedData` value. Use dedicated resource hooks or a small query client for overview, history, benchmark namespace, Operations panels, report, and suite-test pages. Each resource requires its own cache key, cancellation, loading, stale, retry, and error state.

Do not make a repository-wide TypeScript rewrite, GraphQL replacement, Redis deployment, or broad microservice split a prerequisite. Those changes require separate evidence and should proceed only if the bounded API/projection architecture demonstrates a remaining need.

## Target Domain Model

### Pipeline run

`PipelineRun` represents the external CI execution and remains unique by:

```text
project + source provider + provider run ID
```

It owns source metadata such as branch, commit, actor, start/completion timestamps, build number, and source URL. It does not directly own raw report JSON or a replaceable set of submitted facts after the compatibility period ends.

### Report submission

`ReportSubmission` represents one immutable publication into a pipeline run. Its identity should include:

```text
pipelineRunId + kind + producerKey + submissionKey
```

Recommended fields:

- `id`
- `pipelineRunId`
- `kind`: `tests`, `coverage`, `performance`, or `combined`
- `producerKey`: workflow job, shard, framework, package, or publisher identity
- `submissionKey`: stable retry identity supplied by the publisher
- `contentHash`: hash of the canonical normalized payload
- `schemaVersion`
- `receivedAt`
- `status`
- `rawReport`
- `summary`
- `renderedReportArtifactId`
- provenance metadata

The same submission identity and content hash is an idempotent retry. The same identity with different content must either create an explicit revision or return a conflict; it must not silently destroy the prior submission.

`ReportSubmission` is the sole long-term owner of raw report JSON. During dual-write migration, `Run.rawReport` is compatibility data only and must not be loaded by run-shell, authorization, feed, or projection queries. Remove it after shadow parity and rollback retention are complete.

### Ownership of facts

Normalized suites, test executions, coverage points, performance statistics, errors, and artifacts belong to a `ReportSubmission`. The pipeline-run view composes the latest applicable submissions according to an explicit policy.

Metric-specific views and badges choose their latest qualifying submission independently:

- test status comes from the latest test-bearing submission;
- coverage comes from the latest coverage-bearing submission;
- benchmark trends come from performance-bearing submissions;
- combined reports may satisfy more than one category without erasing specialized reports.

Represent active submission selection relationally through indexed active rows or an explicit pointer table. Do not maintain the authoritative pointer as a read-modify-write JSON map on `Run`; concurrent test, coverage, and performance publishers must not be able to overwrite one another's selection metadata.

## Read-Optimized Projections

Create compact projections transactionally during ingest or in a durable post-ingest job:

- `RunOverview`: status, total/passed/failed/skipped counts, duration, latest coverage, and artifact availability;
- `SuiteSummary`: suite identity, status, counts, duration, and failure count;
- `RunFileSummary`: file/package/module test and coverage aggregates;
- `ProjectLatestMetrics`: pointers to the latest qualifying submission for each metric class;
- `ProjectRunActivity`: optional daily project/status aggregate for the overview;
- rendered report metadata keyed by submission content hash.

Raw submissions and normalized facts remain the audit source of truth. Projections are rebuildable and optimized for web queries.

## API and Query Design

### Home overview

Replace the unbounded `runFeed` use with a cursor connection:

```graphql
runFeed(first: 30, after: $cursor, projectKey: $projectKey, status: $status) {
  nodes { ...RunOverviewFields }
  pageInfo { endCursor hasNextPage }
}
```

Add a separate authorized overview query for truthful counts and latest project state. “Load more” must fetch the next page rather than reveal records already embedded in the document.

Use keyset pagination ordered by `completed_at DESC, id DESC`. Add or verify a matching index beginning with `project_id` where project-scoped feeds require it. Avoid offset pagination for deep feeds.

### Run shell

The server-rendered request should contain only:

- run and project identity;
- source metadata;
- `RunOverview`;
- available report/artifact kinds;
- authorization-derived actions.

Coverage history, benchmark panels, file aggregates, comparisons, suites, and tests load independently after first paint. A failure in one panel must not delay or blank the run shell.

### Tests and suites

Add cursor-paginated test queries scoped in SQL:

```graphql
runSuites(runId: $runId, first: 50, after: $cursor)
suiteTests(suiteRunId: $suiteRunId, status: $status, first: 100, after: $cursor)
runFailedTests(runId: $runId, first: 50, after: $cursor)
```

Return suite summaries initially and fetch test rows when a suite is expanded. Do not request all nested tests and a duplicate failed-test collection in one initial operation.

### Trends and comparisons

Replace one GraphQL request per benchmark metric with one batched query accepting the requested metric identities. Perform project/run/version filtering in SQL and cap each series before materializing the response.

Coverage comparison should read only the current coverage-bearing submission, the immediately previous qualifying submission, and their scoped comparison rows. It must not load an arbitrary large run history and then filter in memory.

Do not load every metric merely because the catalog lists it. The first benchmark response should contain the namespace catalog, summary, and ranked changes only. Fetch chart points for the selected or visible namespace, and paginate or explicitly reject requests over a documented metric limit. A server-side limit must never silently omit requested metrics.

Introduce a benchmark read projection with the minimum chart fields:

```text
project_id, report_submission_id, run_id, completed_at,
stat_group, stat_name, series_id, numeric_value, unit
```

Query the newest points with a window function or lateral query that applies top-N per metric/series inside PostgreSQL. The target index starts with:

```text
(project_id, stat_group, stat_name, series_id, completed_at DESC, id DESC)
```

Return run labels and series metadata once, followed by compact points such as `{ runId, timestamp, value }`. Do not repeat project identity, metric identity, commit data, and full metadata on every point.

### V2 read boundaries

The browser-facing API should expose independently loadable, independently failing resources. GraphQL connections or REST-style BFF endpoints are both acceptable if they preserve these boundaries:

- run overview and artifact availability;
- paginated project/all-project run feed;
- paginated suite summaries;
- paginated suite tests and failed tests;
- project benchmark catalog and summary;
- selected benchmark namespace/metric series;
- coverage history and comparison;
- immutable rendered report artifact.

Every list response must include explicit `pageInfo`, use a documented maximum page size, and have SQL work proportional to that page. The web BFF must make at most one server request per independently rendered panel and must not reintroduce per-item GraphQL fan-out.

## Report Delivery

1. Prefer the generated `index.html` artifact already produced by the publisher.
2. Associate it with the immutable submission and its content hash.
3. Authorize access through the same visible-project/run checks as the current route.
4. Redirect to a short-lived signed object URL or stream/proxy the object without loading the raw report into the web process.
5. Return an `ETag` based on the content hash and permit safe browser or authenticated-edge caching.
6. If an older submission has no HTML artifact, render once, persist the result, and reuse it.

The normal report-view path must not query a complete raw report and invoke the renderer for every request.

## Browser Rendering Strategy

- Render suite headers and counts before test-case details.
- Keep suites collapsed by default when a report exceeds a defined size threshold.
- Fetch or reveal details on expansion.
- Virtualize test rows when a visible collection can exceed approximately 200 rows.
- Keep search and filters server-side for large submissions.
- Preserve keyboard access, focus restoration, URL state, loading geometry, and explicit empty/error states.
- Avoid shipping raw report JSON in Next.js page data when the report is displayed in a separate artifact frame.
- Load coverage, benchmarks, Operations panels, and report content independently instead of combining them in one `Promise.all` failure boundary.
- Fetch benchmark points only when a namespace becomes selected or approaches the viewport.
- Cache and deduplicate panel requests by run/submission revision; abort obsolete requests during navigation.
- Prevent accumulated test pages from growing the live DOM without bound.

## Runtime and Reliability Topology

The current chart defaults specify one server replica, one web replica, no resource requests/limits, and the same shallow health route for readiness and liveness. The server process also owns both interactive reads and synchronous ingestion. This permits a large ingest or benchmark reconstruction request to exhaust the same process that serves exploration traffic.

Target topology:

```text
Browser -> Web/BFF -> replicated read API -> PostgreSQL read projections

Publisher -> raw artifact/object storage -> durable queue -> ingest worker
                                                  -> normalized facts
                                                  -> read projections
```

Requirements:

- separate read API and ingestion worker deployments and failure domains;
- accept an idempotent submission receipt quickly and return `202` while durable normalization is pending;
- store large raw reports/artifacts outside the web/read-process heap;
- use chunked bulk inserts or PostgreSQL `COPY`, not one awaited insert per fact;
- publish a completed projection atomically by switching an active submission/projection pointer;
- add bounded retries, exponential backoff, dead-letter state, queue depth, and projection-lag telemetry;
- configure explicit CPU/memory requests and limits, at least two read/web replicas, disruption budgets, and autoscaling based on measured demand;
- configure database pool bounds, acquisition timeouts, statement timeouts, and request cancellation;
- keep `/livez` process-local and make `/readyz` prove database connectivity and schema compatibility;
- use a bounded shared cache only where projections and HTTP validators are insufficient; process-local caches cannot be the correctness or availability mechanism across replicas.
- run schema migrations as a dedicated deployment job protected by a PostgreSQL advisory lock, never independently from every application replica;
- keep schema expansion fast and move historical data transformation into restartable, observable backfill jobs;
- create large production indexes concurrently where PostgreSQL permits it, then validate constraints before enforcing them.

## Recursive Self-Benchmarking Loop

### Loop contract

For every benchmarked deployment, use the following bounded sequence:

1. Build and deploy a specific commit or image digest.
2. Wait for the deployed version endpoint to confirm that exact target revision.
3. Seed or select the deterministic benchmark datasets.
4. Run browser, API/query, and ingest benchmark suites against that deployment.
5. Write the raw measurements and environment manifest as immutable artifacts.
6. Convert the measurements to a `suite-json-v1` performance report.
7. Publish that report to Test Station as a distinct `performance` submission.
8. Render the new points against both the frozen baseline and the immediately preceding accepted phase.
9. Apply the phase's observation or enforcement policy.

Receiving the benchmark submission must not trigger another deployment or benchmark workflow. The performance workflow starts only from an explicit post-deploy job, a manual dispatch, or a controlled scheduled run. This prevents an infinite self-triggering cycle.

### Benchmark families

The self-report should cover three layers:

| Family | Examples |
| --- | --- |
| Browser experience | home ready, run shell ready, report first content, Operations panel ready, suite expansion, long-task duration, DOM nodes |
| Server and data | GraphQL latency/count/bytes, database query count/time/rows, SSR steps, report artifact cache status |
| Write path | normalization time, transaction time, projection time, total ingest latency, payload bytes for 100/1,000/10,000-test fixtures |

Browser measurements must target the deployed application. Data/query and ingest microbenchmarks may also run in a controlled CI environment, but their series must use a different runner/profile identity so local and deployed measurements are never compared as if they were equivalent.

### Stable metric identity

Use stable, low-cardinality metric keys. For example:

```text
statGroup: benchmark.web.test-station.home
statName: ready_ms
unit: ms
seriesId: deployed.chromium.1440x1024.medium.authenticated
```

Additional groups should cover `run-shell`, `runner-report`, `operations`, `suite-expansion`, `graphql`, `database`, and `ingest`. Store volatile values such as commit SHA, workflow run, image digest, browser version, and timestamp in metadata rather than the metric key.

Each point should carry enough metadata to compare like with like:

- `lowerIsBetter`;
- benchmark profile and dataset tier;
- viewport, browser, runner image, and region;
- target commit, application version, and deployment image digest;
- baseline identifier and refactor phase;
- sample count and aggregation statistic such as median or p95;
- configured warning and final budget;
- `budgetStatus` computed from the final budget;
- whether the run is observational, phase-gating, or final-gating.

### Submission identity before and after Phase 1

The baseline must be captured before the submission-identity refactor, so it needs a compatibility path that cannot replace the correctness report. Until Phase 1 lands, publish the self-benchmark under a synthetic provider run identity such as:

```text
<github-run-id>:web-performance:<attempt>
```

Retain the real target run, commit, and image digest in provenance metadata. After Phase 1, publish it under the real `PipelineRun` as a distinct submission with:

```text
kind: performance
producerKey: test-station-web-performance
submissionKey: <target-commit>:<benchmark-profile>:<attempt>
```

Migration must preserve the synthetic baseline's metric history and map it to the new submission model without rewriting its values.

### Baseline protocol

Before Phase 1 implementation begins, capture two complementary baselines from the current deployed revision:

1. **Controlled baseline:** deterministic small, medium, and large datasets used for regression gates.
2. **Production-observational baseline:** current real-data routes used to detect behavior that fixtures fail to model.

For each critical scenario:

1. Record one warm-up execution that is excluded from aggregates.
2. Record at least five measured samples per workflow execution.
3. Repeat the workflow on three independent runners or at three separated times.
4. Store raw samples plus median and p95 aggregates.
5. Record the exact commit, image digest, database cardinalities, fixture checksum, browser/Node versions, runner image, region, viewport, and authentication profile.
6. Assign an immutable identifier such as `pre-refactor-2026-07` and checksum the baseline manifest.
7. Upload the raw artifacts, publish the aggregate performance stats, and retain a checked-in baseline manifest containing identifiers and artifact locations rather than bulky raw samples.

Do not update the frozen baseline when a phase completes. New phases compare against the same pre-refactor baseline and, separately, the last accepted phase. If environment changes make the baseline invalid, create a new named baseline cohort and retain the old one.

### Progress and color semantics

The benchmark explorer should support comparison with a named baseline rather than only the immediately previous point.

- **Neutral:** the frozen baseline itself or a metric with insufficient samples.
- **Red:** regressed beyond the allowed noise band, failed to improve where a phase explicitly targets it, or exceeded the final budget.
- **Amber:** measurably improved from baseline but has not reached the final budget.
- **Green:** meets the final budget without a critical correctness, authorization, or data-integrity regression.

Every phase should therefore produce a visible benchmark checkpoint. A phase may legitimately leave unrelated metrics red or amber, but it must not regress protected metrics beyond the documented noise band. The final gate requires every critical metric to be green for three consecutive benchmark executions; non-critical metrics may be waived only with an owner, rationale, and expiry.

### Workflow topology

Add a post-deploy performance job or dedicated reusable workflow with these properties:

- it verifies the deployed revision before measuring;
- it uses one worker and a pinned browser/runner image for comparable results;
- it can use an authenticated storage state from secrets without publishing credentials;
- it uploads raw Playwright, profile, trace, and baseline/comparison artifacts;
- it converts `artifacts/e2e-performance/latest.json` and server benchmark output into one `suite-json-v1` suite, runs that suite through a dedicated Test Station performance config to generate `report.json`, and publishes the resulting report;
- it publishes even when a budget fails, then exits with the gate result so red evidence is not lost;
- it uses concurrency controls that do not overlap two benchmark runs against the same target;
- it does not block deploys during baseline capture, becomes a regression guard during intermediate phases, and becomes a required check in Phase 6.

Publishing must happen after measurement is complete so the benchmark does not include its own ingest traffic. Scheduled production-observational runs should use a dedicated series identity and must not be mixed into deterministic CI gate calculations.

## Observability and Performance Budgets

### Required measurements

Capture for each benchmark scenario:

- server response time and TTFB;
- first contentful paint and run-shell ready time;
- time to interactive;
- GraphQL request count and bytes;
- database query count, total query time, and rows read where available;
- report artifact response bytes and cache status;
- long tasks, JavaScript heap, and DOM-node count;
- suite-expansion and paginated-fetch latency.
- normalization, persistence, projection, and end-to-end ingest latency for each deterministic size tier.

Extend the existing profiler with query-name, query-count, and aggregate database-duration fields. Do not include secrets, report contents, failure messages, or user identifiers in performance telemetry.

### Current instrumentation coverage and gaps

Treat a measurement as implemented only when it is collected from the intended environment, converted into a stable performance statistic, retained with provenance, and visible in the phase checkpoint. Raw diagnostic data that is not converted or compared remains useful evidence but is not yet a KPI.

| Layer | Available in the local worktree | Required completion work |
| --- | --- | --- |
| Browser | Route and interaction timers; FCP, LCP, CLS, long tasks, DOM nodes, heap, navigation bytes, and selected resource timings | Add direct TTFB and INP or an explicitly named interaction-ready surrogate; select deterministic fixture runs; publish resource counts/bytes and profiling fields as stable statistics |
| Next.js SSR/BFF | Named page-load steps, trace propagation, page totals, and `Server-Timing` | Normalize step names, attach GraphQL operation summaries, publish them as checkpoint metrics, and ensure profiling does not materially inflate response time |
| GraphQL | Request/trace identity and total operation duration | Record operation name, status, response bytes, request-scoped database totals, timeout/cancellation outcome, and selected resolver or repository spans without high-cardinality field labels |
| PostgreSQL | No request-scoped production measurement; ORM logging is disabled | Add query count, cumulative duration, pool-acquisition time, timeout count, affected/materialized row counts where reliable, and offline `EXPLAIN (ANALYZE, BUFFERS)` evidence for controlled fixtures |
| Ingest | Controlled normalization median/p95 for 100/1,000/10,000 tests | Measure validation/normalization, transaction acquisition, persistence, projection work, commit, cache invalidation, total request latency, payload bytes, fact counts, memory high-water mark, and failures |
| Report delivery | Stored-artifact, render-cache-hit, and render-cache-miss outcomes exist in the loader | Emit durable counters and latency/byte histograms for artifact hits, conditional `304`s, misses, and legacy fallback renders |
| Runtime reliability | Health/revision checks and benchmark failure status | Add request rate/error/latency, 5xx rate, PostgreSQL pool saturation, timeouts, ingest failures, projection/backfill lag, pod restarts, CPU, and memory indicators |
| Phase governance | Phase labels, named-baseline metadata, immutable benchmark artifacts, and prose exit criteria | Add a checked-in machine-readable checkpoint for baseline/current/target/delta/status and require its evidence before accepting a phase |

The existing browser resource summary and page-profile payloads must not remain nested only inside raw Playwright evidence. The converter must promote each approved, low-cardinality field into `performanceStats`; otherwise Test Station cannot graph, compare, or gate it. Diagnostic-only traces may remain in the raw artifact.

### Internal profiling architecture

Use one trace context from browser interaction through Next.js, GraphQL, repositories, PostgreSQL, report delivery, and ingest. The profile should preserve causality while keeping benchmark identity separate from production user identity.

1. Add a request-scoped server profile, backed by `AsyncLocalStorage` or an equivalent explicit context, containing the trace ID, route or GraphQL operation, start time, query count, database duration, pool-wait duration, rows returned or affected where reliable, response bytes, cache outcome, and error category.
2. Instrument Sequelize with benchmark timing and request-context hooks. Do not log bind values or raw report data. Normalize SQL to a low-cardinality query/repository name rather than publishing arbitrary statement text as a metric label.
3. Add explicit repository/use-case spans around the bounded read operations introduced by this refactor. Use database hooks for totals and named spans for attribution; do not enable noisy per-resolver tracing indiscriminately in production.
4. Add an ingest stage profiler around parsing, normalization, transaction acquisition, persistence, projection maintenance, commit, and post-commit invalidation. Return a trace ID in the receipt, but retain timings in telemetry and benchmark artifacts rather than expanding the public response contract by default.
5. Add report-delivery metrics for stored-artifact hit, `304`, render-cache hit, legacy render fallback, bytes, and duration. Cache outcome is an enum, not a free-form label.
6. Extend the browser collector with direct TTFB, resource request counts/bytes, and an interaction responsiveness measure. Continue recording page-ready marks because they represent product-specific readiness that Web Vitals alone cannot express.
7. Export low-cardinality counters and histograms to the selected runtime metrics backend and retain sampled traces for diagnosis. Controlled benchmark runs collect complete profiles; production may sample traces, but aggregate error, latency, cache, pool, and lag metrics must remain unsampled.
8. Include instrumentation overhead checks. Compare profiling enabled/disabled in a controlled environment and require median overhead below `2%` or `5 ms` per request, whichever is larger, before enabling full production collection.

### Phase checkpoint scorecard

Create a checked-in checkpoint document for every candidate phase under a stable path such as `benchmarks/checkpoints/<phase>/<target-commit>.json`. A small phase index should identify the most recently accepted checkpoint without rewriting prior evidence. Generated raw measurements remain immutable workflow artifacts rather than being committed as bulky repository files.

Each checkpoint must contain:

```json
{
  "schemaVersion": "1",
  "phase": "phase-2",
  "status": "candidate",
  "baselineId": "pre-refactor-2026-07",
  "previousAcceptedCheckpoint": "phase-1:<commit>",
  "target": {
    "commit": "<sha>",
    "imageDigest": "<digest>",
    "deployedRevisionVerified": true
  },
  "environment": {
    "profile": "controlled.chromium.1440x1024.medium.authenticated",
    "fixtureChecksum": "<sha256>",
    "databaseCardinality": {},
    "runner": {},
    "region": "<region>"
  },
  "metrics": [{
    "key": "benchmark.web.test-station.run-shell.ready_ms_p95",
    "baseline": 0,
    "previousAccepted": 0,
    "current": 0,
    "target": 1000,
    "noiseBandPercent": 5,
    "deltaFromBaselinePercent": 0,
    "deltaFromPreviousPercent": 0,
    "budgetHeadroomPercent": 0,
    "sampleCount": 5,
    "status": "neutral",
    "critical": true,
    "artifact": "<immutable-artifact-reference>"
  }],
  "correctnessGates": [],
  "deliverables": [],
  "waivers": []
}
```

Checkpoint generation and validation must be automated. CI should reject missing critical metrics, cohort mismatches, mutable artifact references, undocumented regressions, invalid status transitions, or waivers without an owner, rationale, and expiry. A phase is accepted only when its implementation deliverables and correctness gates pass, its targeted KPIs improve or meet budget, and protected metrics stay within the agreed noise band.

### Phase KPI and deliverable map

| Phase | Target KPIs | Required checkpoint deliverables |
| --- | --- | --- |
| Phase 0 — Baseline | Measurement coverage, sample variance, fixture repeatability, profiler overhead | Three executions with one excluded warm-up and five measured samples each; controlled small/medium/large plus production-observational cohorts; checksums; complete metric inventory; immutable raw and aggregate evidence |
| Phase 1 — Ingest identity | Normalization, transaction, persistence, projection, and end-to-end ingest median/p95; payload bytes; memory high-water; ingest failure/dedup/revision counts | 100/1,000/10,000-test ingest profiles; concurrent cross-kind correctness evidence; migration/backfill proof; visible performance submission coexisting with correctness data |
| Phase 2 — Fast shells | Home/project/run-shell p50/p95; TTFB; initial decoded and transferred bytes; GraphQL request count; database query count/time/rows; feed rows | Bounded-scaling evidence as stored history grows; deterministic navigation artifacts; projection parity; pagination and authorization proof |
| Phase 3 — Reports | Report-first-content p50/p95; response bytes; stored-artifact hit rate; `304` rate; fallback-render count and duration | Cold and repeated-view evidence; content-hash and authorization proof; no steady-state render invocation |
| Phase 4 — Query layer | Per-operation p50/p95; database query count/time/rows; pool wait; timeouts; heap; namespace bytes; request fan-out | Medium/large PostgreSQL plans; 139-metric completeness case; bounded history-scaling test; repository and authorization integration evidence |
| Phase 5 — Progressive UI | Suite expansion and page-fetch p50/p95; INP or interaction surrogate; DOM nodes; long-task count/duration; heap; panel error/retry rate | 10,000-test browser evidence; virtualization proof; keyboard/accessibility results; cancellation and independent-panel failure evidence |
| Phase 6 — Rollout | Production p95/p99 and 5xx rate; throughput; ingest failures; projection/backfill lag; cache hit rate; DB pool saturation; CPU/memory; pod restarts | Shadow parity report; mixed large-ingest plus 25-reader load result; rollback exercise; final baseline-to-phase comparison; three consecutive green post-deploy checkpoints |

For every phase, the checkpoint is a deliverable rather than an optional report. The implementation PR may merge before deployed evidence exists, but the phase remains `candidate` until the exact deployed commit or image has a complete checkpoint. `accepted` and `green` are evidence states, not synonyms for code merged.

### Deterministic data tiers

Maintain seeded or generated benchmark runs at approximately:

- small: 100 tests;
- medium: 1,000 tests;
- large: 10,000 tests.

Include multiple suites, failures, coverage files, and benchmark series so tests exercise the expensive paths rather than a single trivial public run.

### Initial budgets

These are starting targets. Phase 0 records the baseline and may adjust a target with a documented reason before enforcement begins.

| Scenario | Initial target |
| --- | ---: |
| Home shell at p95 | `<= 1,000 ms` |
| Initial run shell at p95 | `<= 1,000 ms` |
| Run view interactive at p95 | `<= 1,500 ms` |
| First report content for 1,000 tests | `<= 2,000 ms` |
| Suite expansion | `<= 300 ms` |
| Paginated test fetch | `<= 500 ms` |
| Initial compressed-equivalent response | `<= 150 KB` |
| Initial run-shell decoded JSON | `<= 50 KB` |
| One benchmark namespace decoded JSON | `<= 100 KB` |
| Benchmark namespace API at p95 | `<= 500 ms` |
| GraphQL/server requests for one benchmark namespace | constant with metric count; no per-metric HTTP calls |
| Database rows materialized per benchmark series | requested point limit plus documented lookahead |
| Initial home feed rows | `<= 30` |

Budgets must have checked-in defaults or a required CI configuration. An absent environment variable must not silently disable regression protection in the required performance job.

The converter should set per-point `budgetStatus` and threshold metadata using the existing benchmark semantic contract. Latency, bytes, query count, and DOM-node metrics are lower-is-better; throughput and cache-hit ratio are higher-is-better. The raw value, baseline delta, previous-phase delta, and budget result must all remain independently visible.

## Phased Implementation Plan

### Phase 0 — Reproducible baseline

1. Add deterministic small, medium, and large result fixtures.
2. Update the browser benchmark to select or create a known-size run instead of the first visible public run.
3. Record home, project shell, run shell, report, Operations view, paginated-fetch, and suite-expansion timings, including direct TTFB and INP or the explicitly named interaction-ready surrogate.
4. Record response bytes, GraphQL calls, database queries/time/rows, pool wait, DOM nodes, heap, long tasks, cache outcomes, and infrastructure guardrails.
5. Add controlled end-to-end ingest and query benchmarks for all three data tiers; retain the normalization microbenchmark as one stage rather than treating it as total ingest cost.
6. Extend the converter so approved browser resources, SSR steps, GraphQL summaries, database totals, ingest stages, cache outcomes, and reliability guardrails become stable `suite-json-v1` performance statistics with direction metadata.
7. Add the non-blocking post-deploy self-benchmark workflow and synthetic pre-Phase-1 submission identity.
8. Run the full baseline protocol against the current pre-refactor deployment.
9. Save and checksum the raw artifacts and named baseline manifest.
10. Publish the baseline back into Test Station and verify that it is visible without replacing the correctness report.
11. Check in explicit final budgets and an intermediate regression noise policy; keep enforcement observational during baseline capture.
12. Generate and validate the Phase 0 scorecard, including a metric coverage inventory and measured profiler-overhead result.

Exit criteria:

- repeated benchmark runs have stable, comparable inputs;
- the current regression is captured by at least one metric mapped to a future enforced budget;
- failures provide the measured value, budget, scenario, and artifact path.
- the immutable controlled and production-observational baselines identify their exact deployed revision and environment;
- Test Station displays its own baseline benchmark families;
- the correctness and performance reports coexist under the pre-Phase-1 compatibility scheme;
- raw samples, median, and p95 can be traced from each displayed point to an immutable artifact.
- every critical KPI has a stable identity, owner, collection source, target or documented baseline-only status, and complete conversion path from raw evidence to displayed point;
- the Phase 0 checkpoint is machine-validated and the baseline is no longer marked `partial-capture`.

### Phase 1 — Submission identity and safe ingest

1. Add `PipelineRun` and `ReportSubmission` schema/migrations or evolve the existing `Run` model while preserving public IDs during transition.
2. Attach normalized facts and report artifacts to submissions.
3. Add kind, producer, submission key, content hash, schema version, and provenance.
4. Replace whole-run fact deletion with submission-scoped idempotent persistence.
5. Return a structured ingest receipt containing pipeline run ID, submission ID, created/deduplicated/revised status, and fact counts.
6. Update publishers to emit stable submission identities and distinct report kinds.
7. Move self-benchmark publishing from the synthetic compatibility identity to the real pipeline run plus its distinct performance submission.
8. Add named-baseline comparison support so the API and benchmark explorer can show fixed-baseline and previous-phase deltas independently.
9. Make `ReportSubmission` the canonical raw-report owner and treat `Run.rawReport` as temporary compatibility data that read APIs never select.
10. Replace `Run.metadata.latestSubmissionIds` with relational active-submission selection or an atomic database-owned equivalent.
11. Add concurrent cross-kind publisher tests that prove active pointers and facts cannot be lost.
12. Add ingest stage profiling and resource guardrails for normalization, transaction acquisition, persistence, projection, commit, total request latency, memory high-water, and failure outcome.
13. Run and publish the Phase 1 checkpoint against the frozen baseline.

Exit criteria:

- test and coverage submissions for one provider run coexist;
- a byte-equivalent retry is a no-op;
- a conflicting retry is explicit and preserves prior data;
- concurrent test, coverage, and performance submissions preserve all active selections;
- run overview and authorization queries do not select or deserialize raw report JSON;
- rollback and backfill procedures are documented and tested.
- the baseline history survives migration and the Phase 1 performance checkpoint is visible.
- end-to-end ingest measurements exist for all three deterministic tiers and no critical read or resource guardrail regresses outside the noise band.

### Phase 2 — Fast home and run shell

1. Add `RunOverview` and project overview projections.
2. Add cursor-based home pagination and matching indexes.
3. Make “Load more” issue a network request.
4. Reduce SSR to the run shell and its summary.
5. Apply the same shell-first split to the project route; do not block project SSR on scope trends or benchmark panels.
6. Lazy-load history, selected benchmark namespaces, detailed Operations panels, and comparisons with independent error states.
7. Make cursor fields, SQL order, application order, and indexes identical: `completed_at DESC, id DESC`, with an explicit policy for incomplete runs.
8. Back project counts and latest status with projections rather than counts inferred from the currently loaded global feed window.
9. Derive run/project and run/suite relationships on the server; reject mismatched parent and child identifiers.
10. Replace caller-provided project scope in run insights with the project resolved from the authorized run.
11. Publish request-scoped SSR, GraphQL, and database profiles for the shell operations, including bytes, query count/time/rows, and pool wait.
12. Run and publish the Phase 2 checkpoint, expecting home, project-shell, and run-shell metrics to improve.

Exit criteria:

- initial home work remains bounded as total stored runs increase;
- run first paint does not wait for history or benchmark requests;
- project first paint does not wait for scope trends or benchmark series;
- pagination tests cover tied completion times, incomplete runs, inserts between pages, and duplicate/omission detection;
- run insights and nested suite reads cannot cross or ignore their route parent;
- summary/project counts remain truthful without downloading all runs.
- targeted home and run-shell metrics improve versus baseline without protected-metric regression.
- shell checkpoint evidence shows where time and bytes are spent across browser, SSR, GraphQL, repository, and PostgreSQL boundaries.

### Phase 3 — Persisted report delivery

1. Register publisher-generated HTML artifacts against the submission content hash.
2. Change the report endpoint to resolve and serve the stored asset.
3. Add authorization-preserving cache headers and `ETag` handling.
4. Implement render-once fallback for legacy reports.
5. Remove the per-view raw-report render from the steady-state request path.
6. Add durable latency, bytes, stored-artifact-hit, `304`, render-cache-hit, miss, and fallback-render counters with bounded cache-outcome labels.
7. Run and publish the Phase 3 checkpoint, expecting report-first-content, server-render time, and cache-hit metrics to improve.

Exit criteria:

- repeated views of an unchanged report do not invoke `renderHtmlReport`;
- a cached view returns `304` or an equivalent cache hit;
- private report authorization remains enforced;
- legacy reports still render through the fallback.
- repeated-view report benchmarks show the stored-artifact/cache path and improve versus baseline.
- report-delivery telemetry distinguishes steady-state artifact service from legacy fallback work in both benchmarks and production.

### Phase 4 — Query-layer cleanup

1. Push all run, suite, test, artifact, file, and metric filters into database queries.
2. Remove whole-table `loadAll()` reads from request-time fact paths.
3. Add request-scoped batching where nested fields remain necessary.
4. Replace the large Operations query with summary and panel-specific queries.
5. Replace complete-history benchmark materialization with SQL top-N-per-series over the benchmark projection.
6. Remove the silent 100-metric truncation; select one namespace at a time, paginate, or return a clear limit error.
7. Return compact series/run dictionaries and point tuples instead of repeated full point metadata.
8. Narrow coverage comparisons to the current and immediately previous qualifying submissions.
9. Add feed, suite-test, benchmark-series, and text-search indexes based on measured query plans, not speculative indexing alone.
10. Add explicit database pool, acquisition, and statement-timeout configuration.
11. Split the multi-domain query service into bounded repositories/use cases and add request-scoped authorization, run, version, and active-submission loaders.
12. Replace production ORM fallbacks used by fake models with repository-contract test doubles and PostgreSQL integration coverage.
13. Add request-scoped database and pool instrumentation, named repository spans, timeout metrics, and controlled query-plan artifact capture.
14. Run and publish the Phase 4 checkpoint, expecting query count, rows read, decoded bytes, heap usage, and panel latency to improve.

Exit criteria:

- query count does not grow linearly with suite count;
- rows read are proportional to the requested page or aggregate;
- a 139-metric project returns complete, explicit results without one HTTP call per metric or silent truncation;
- benchmark query work remains bounded when project history grows while the requested point count stays fixed;
- a multi-field GraphQL operation resolves actor/project/run scope once per request rather than once per field;
- query plans for the medium and large fixtures use intended indexes;
- authorization tests cover all new narrow query paths.
- the checkpoint demonstrates bounded query scaling and no protected-metric regression.
- each critical GraphQL/BFF operation can be attributed to bounded repository and database work without exposing SQL values or user/report content.

### Phase 5 — Progressive result UI

1. Render suite summaries first.
2. Fetch tests on expansion with cursor pagination.
3. Virtualize long visible test collections.
4. Add server-side test status, file, suite, and text filters.
5. Preserve selected suite/test and filters in the URL where appropriate.
6. Add explicit panel-level loading, empty, stale, and retry states.
7. Replace shared secondary-data merging with independently keyed resource hooks and cancellation.
8. Split the run, project, benchmark, and server GraphQL modules into feature-owned units with narrow exports.
9. Standardize BFF request validation and error envelopes without exposing internal exception messages.
10. Promote DOM, heap, long-task, resource, INP or interaction-ready, pagination, and panel-failure measurements into phase-gating performance statistics.
11. Run and publish the Phase 5 checkpoint, expecting DOM-node, long-task, and suite-expansion metrics to improve.

Exit criteria:

- the 10,000-test fixture does not create 10,000 initial DOM rows;
- first-content time remains within budget as report size grows;
- one panel failure does not erase successful sibling panels or masquerade as an empty dataset;
- mouse and keyboard navigation work across pagination and virtualization.
- the large fixture's browser metrics improve versus baseline without accessibility or interaction regressions.
- the checkpoint links browser regressions to the responsible network request and server trace where available.

### Phase 6 — Enforcement and rollout

1. Run correctness, authorization, migration, and performance suites in CI.
2. Deploy behind feature flags where old and new reads must coexist.
3. Compare projection results against the legacy query path during a shadow period.
4. Backfill historical submissions and projections in bounded batches.
5. Monitor ingest failures, projection lag, query latency, response size, cache hit rate, and report-render fallback count.
6. Remove legacy replacement and reconstruction paths only after parity and rollback checkpoints pass.
7. Promote the post-deploy self-benchmark to a required check.
8. Require three consecutive green executions for every critical metric before declaring the refactor complete.
9. Publish a final comparison report showing baseline, each accepted phase, final values, absolute/percentage improvement, and budget headroom.
10. Split ingestion workers from the read API, set resource requests/limits, add replicated reads, and validate readiness against PostgreSQL before enabling the new path for all traffic.
11. Run a mixed-load test in which large ingestion and 25 concurrent exploration sessions execute together without read-budget or availability failure.
12. Publish runtime dashboards and alerts for latency, errors, throughput, ingest failures, projection/backfill lag, report cache/fallback behavior, database pool saturation/timeouts, CPU, memory, and pod restarts.
13. Generate the final machine-readable scorecard and validate the baseline, every accepted phase, all waivers, artifact lineage, and three consecutive green executions.

Exit criteria:

- required performance budgets pass against all deterministic tiers;
- production p95 navigation and query metrics meet the agreed targets;
- projection parity checks are clean;
- steady-state report views use stored artifacts;
- the legacy path can be removed without losing audit data.
- Test Station's own benchmark explorer shows a traceable baseline-to-green progression;
- self-benchmark publication succeeds even when the benchmark gate fails, preserving the red evidence.
- operational dashboards demonstrate that benchmark gains survive production traffic and that instrumentation remains available during degraded behavior.

## Testing Matrix

| Area | Required coverage |
| --- | --- |
| Ingest identity | distinct kinds/producers, exact retry, conflict/revision, concurrent submissions |
| Persistence | no cross-submission deletion, atomic fact/projection write, rollback |
| Metric selection | latest test, coverage, and performance submissions selected independently |
| Authorization | project visibility enforced for summaries, pages, artifacts, and caches |
| Parent scope | mismatched run/project, run/suite, and run/submission identifiers are rejected without leaking resource existence |
| Identity boundary | external actor headers stripped or signed assertions verified; unverified roles cannot grant administration |
| Pagination | stable cursors, ties in completion time, inserted rows, empty/end pages |
| Query scaling | bounded query count and requested-row reads for 100/1,000/10,000 tests |
| Request scope | actor/project/run/submission resolution is reused across multi-field GraphQL operations |
| Report delivery | artifact hit, ETag hit, legacy render-once fallback, missing artifact |
| API contracts | validated input, stable errors, request IDs, timeouts, partial panel failure, no raw exception disclosure |
| UI | progressive suites, filters, virtualization, keyboard navigation, cancellation, independent retry states |
| Migration | exclusive migration job, concurrent replica startup, bounded historical backfill, parity comparison, restartability, mixed old/new records |
| Ownership | run-shell queries exclude raw reports; relational active pointers survive concurrent cross-kind publication |
| Performance | home, run shell, report content, Operations panel, suite expansion |
| Profiling contract | trace propagation, stable low-cardinality names, no secrets or report/user content, correct aggregation, bounded overhead |
| Database telemetry | request-scoped query count/time, pool wait, timeouts, known row counts, context isolation under concurrent requests |
| Ingest telemetry | stage totals reconcile with end-to-end time, transaction failures are classified, 100/1,000/10,000 tiers, memory guardrail |
| Cache telemetry | artifact hit, `304`, render-cache hit/miss, fallback-render counters and latency/byte attribution |
| Runtime reliability | request rate/error/latency, 5xx, saturation, projection lag, restarts, degraded dependency behavior |
| Self-report conversion | stable metric names, direction metadata, raw artifact links, malformed/missing metrics |
| Recursive workflow | exact deployed revision, no self-trigger loop, publish-on-failure, concurrency, secret isolation |
| Baseline comparison | immutable named baseline, previous-phase comparison, cohort mismatch, green/amber/red classification |
| Phase scorecard | required KPI coverage, artifact immutability, target/delta arithmetic, state transitions, waiver ownership and expiry |

## Migration and Rollback

1. Run migrations from one dedicated deployment job guarded by a PostgreSQL advisory lock; application pods authenticate and verify schema compatibility but do not race to mutate schema.
2. Add new tables, nullable foreign keys, projection tables, and compatibility columns without removing current `Run` ownership.
3. Keep schema expansion migrations short. Do not scan every historical run or update every fact table inside an application-startup migration.
4. Build large indexes concurrently when supported, validate them from real query plans, and enforce new constraints only after backfill parity.
5. Dual-write new ingests to submissions and projections while retaining the current readable shape; prevent normal read paths from selecting compatibility `Run.rawReport`.
6. Backfill one project/date range at a time with durable checkpoints, idempotent commands, rate limits, progress metrics, and restart tests.
7. Shadow-read new summaries and active-submission selection, recording mismatches without changing the user-visible result.
8. Switch home, project shell, run shell, report delivery, and detailed panels independently behind flags.
9. Keep the old read path available through at least one stable release after the final switch.
10. Remove `Run.rawReport` and JSON active-submission pointers only after rollback retention and parity gates pass.
11. Rollback changes the selected read path; it does not delete new submissions, projections, or immutable artifacts.

## Expected File Areas

Implementation is expected to touch these areas, although exact filenames should follow the repository conventions at execution time:

- server migrations and Sequelize models;
- ingestion normalization and persistence service;
- GraphQL schema, resolvers, and query service;
- feature-owned read repositories, request-scoped loaders, and authorization scope;
- publisher metadata and ingest receipts;
- web home/run queries and SSR loaders;
- shared BFF handler, runtime contracts, and structured error mapping;
- report API delivery;
- independent client resource hooks and run/project/benchmark/suite components;
- profiling and performance E2E fixtures;
- request-scoped profiling context, database hooks, ingest stage timers, cache metrics, and runtime telemetry export;
- deployment migration job, network policy, health/readiness, and workload manifests;
- benchmark result converter and self-benchmark workflow;
- checked-in baseline manifest and immutable external benchmark artifacts;
- phase-checkpoint schema, generator, validator, accepted-phase index, and final comparison report;
- operational dashboards and alerts for latency, errors, saturation, lag, cache outcomes, and workload health;
- Phase 10 through Phase 14 server/web tests.

Keep ingestion-domain changes, read/query changes, and UI changes in separately reviewable commits where possible.

## Definition of Done

The refactoring is complete when:

1. Multiple report types from one CI run coexist and remain independently queryable.
2. Idempotent retries cannot erase another report submission.
3. Home and initial run responses are bounded and paginated.
4. Large result details load progressively from SQL-scoped queries.
5. Unchanged HTML reports are served from immutable stored artifacts.
6. Query count, rows read, response size, DOM nodes, and user-visible timings are measured.
7. CI enforces agreed budgets against deterministic 100, 1,000, and 10,000-test scenarios.
8. Production telemetry confirms the improvement without ingest, authorization, or data-integrity regressions.
9. Test Station publishes and displays its own performance submissions without triggering an ingest/benchmark loop.
10. The pre-refactor baseline and every accepted phase remain traceable through immutable artifacts and deployment identities.
11. Every critical final benchmark is green for three consecutive post-deploy executions.
12. A 139-or-more-metric project returns complete benchmark navigation without per-metric request fan-out, silent truncation, or complete-history row materialization.
13. Large ingestion cannot exhaust or block the replicated read API, and readiness fails when PostgreSQL is unavailable or schema-incompatible.
14. Run-shell and authorization paths never select or deserialize raw report JSON, and `ReportSubmission` is its sole owner after compatibility retirement.
15. Run/project/suite/submission relationships are derived and enforced server-side, and the internal actor trust boundary is deployment-tested.
16. Schema migration, historical backfill, and application startup are independently deployable and safe under multiple replicas.
17. API failures use stable request-ID-bearing contracts; partial dependency failures remain visible and do not become empty datasets.
18. Query and UI modules have feature-owned boundaries with request-scoped data reuse and independently managed client resources.
19. Every accepted phase has a machine-readable scorecard linking its implementation deliverables, correctness gates, baseline and previous-phase deltas, budgets, deployment identity, and immutable evidence.
20. Browser, SSR, GraphQL, repository, PostgreSQL, ingest, report-cache, and runtime reliability measurements are sufficient to attribute a regression without enabling sensitive or unbounded telemetry.
