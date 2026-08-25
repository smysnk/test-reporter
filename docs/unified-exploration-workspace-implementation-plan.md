# Unified Test Station Exploration Workspace Implementation Plan

## Status

- Implemented through Phase 8 on 2026-08-25; Phase 9 production rollout and matched-stack checkpoints are executed by the Main Release Pipeline for the implementation commit.
- This plan unifies the deployed Operations Overview with the four static exploration concepts:
  - Project Ledger
  - Run Workbench
  - Failure Triage
  - Coverage Workbench
- The static concepts remain visual references only until each production slice has real-data, accessibility, performance, and browser acceptance.
- No illustrative value from a concept may reach a production route.

## Outcome

Test Station will have one connected exploration model:

1. `/` answers **what needs attention across all visible projects?**
2. `/projects/[slug]` answers **how is this project behaving over time?**
3. `/runs/[id]` answers **what happened in this pipeline run?**
4. Run workspace modes answer progressively narrower questions about tests, failures, coverage, performance, artifacts, and the generated runner report.

The four concepts will not become four independent applications. Project Ledger becomes the project workspace. Run Workbench, Failure Triage, and Coverage Workbench become coordinated modes inside one run workspace, sharing the same run header, summary, URL state, authorization result, and resource cache.

## Product Principles

1. **Triage before detail.** Start with health and change, then reveal exact evidence.
2. **One fact, one owner.** A count or status is computed once on the server and reused everywhere.
3. **No fictional completeness.** Missing values remain unavailable; `null` never becomes `0`.
4. **URL-addressable work.** Scope, mode, selected suite/test/failure/file, and meaningful filters survive refresh and back/forward navigation.
5. **Progressive resources.** Shells render first; large lists and evidence load independently with cancellation and retry.
6. **Conditional navigation.** A mode appears only when the active run submissions contain useful data for it.
7. **Bounded work.** Database rows, response bytes, browser DOM nodes, and query count scale with the requested page, not the report size.
8. **Authorization is server-owned.** IDs are always resolved through the authorized run/project relationship.

## Current Repository Anchors

- [packages/web/pages/index.js](../packages/web/pages/index.js) and the `Operations*` components own the deployed cross-project command center.
- [packages/web/pages/projects/[slug].js](../packages/web/pages/projects/%5Bslug%5D.js) currently combines the project shell, activity loading, coverage, release notes, and benchmark state in one route component.
- [packages/web/pages/runs/[id].js](../packages/web/pages/runs/%5Bid%5D.js) currently combines the runner/web template switch, independent resource loading, historical panels, Operations details, suite pagination, and virtualization.
- [packages/web/lib/queries.js](../packages/web/lib/queries.js) and [packages/web/lib/serverGraphql.js](../packages/web/lib/serverGraphql.js) own the web GraphQL operations and response normalization.
- [packages/server/graphql/query-service.js](../packages/server/graphql/query-service.js) already exposes project, run, suite, test, artifact, coverage, and benchmark reads but is too broad to remain the long-term owner of every workspace use case.
- `RunOverview` and `ProjectOverview` provide fast shells; `ReportSubmission` and `RunActiveSubmission` identify the active per-kind facts; `SuiteRun`, `TestExecution`, `CoverageSnapshot`, `CoverageFile`, `PerformanceStat`, `Artifact`, and `ErrorOccurrence` own detailed evidence.
- The existing [performance refactoring plan](./ingestion-and-results-performance-refactoring-plan.md) and [Operations Overview plan](./operations-overview-redesign-implementation-plan.md) remain governing constraints rather than work to repeat.
- The static implementation references live in `packages/web/components/concepts` and `docs/assets/test-execution-*-comparison.png`.

## Executive Product Decisions

### Keep and integrate

- The deployed Operations Overview remains the cross-project command center.
- Project Ledger becomes the canonical `/projects/[slug]` experience.
- Run Workbench becomes the canonical `/runs/[id]` shell and Tests mode.
- Failure Triage becomes `view=failures` within the run workspace.
- Coverage Workbench becomes `view=coverage` within the run workspace.
- The existing benchmark explorer becomes `view=performance` and adopts the same shell and master-detail behavior.
- Artifacts and the exact generated report remain reachable from every appropriate level.

### Remove or defer

| Concept element | Decision | Reason |
| --- | --- | --- |
| Project tags and add-tag control | Remove | There is no first-class tag model or useful current workflow. |
| Project-level Suites and Artifacts navigation | Remove | Suites and artifacts belong to a specific run; project-level catalog semantics do not exist. |
| Separate Releases tab | Remove from primary navigation | Release notes remain annotations on coverage/performance history and can return later if they become a real workflow. |
| Always-visible project settings controls | Admin-only overflow action | Avoid dead controls for guests and non-admin operators. |
| Setup/Test/Teardown timeline | Remove initially | Only total and test duration are reliable; the segments are not stored as typed timing facts. |
| Test owner when unresolved | Hide | `unowned` adds noise. Show ownership only when resolved from `ProjectModule.owner`. |
| Test console accordion without captured output | Hide | Empty decorative panels reduce trust. |
| Failure attempt number and flaky badge | Hide until explicitly ingested | Retry and flake semantics cannot be inferred safely from the current rows. |
| Generated reproduction command | Replace with stored suite command | Do not synthesize a command that may not reproduce the failure. |
| Failure assignee and Create issue | Remove | No assignment or issue-provider integration exists. |
| Coverage file “last changed” | Remove | Git history is not part of the current data contract. |
| Arbitrary coverage risk label | Replace with coverage delta | Delta against the previous run is real and actionable; an undocumented risk score is not. |
| Coverage settings control | Remove | Thresholds come from published configuration/metadata, not an in-product settings model. |
| Uncovered ranges | Conditional/deferred | Show only after adapters persist real uncovered ranges; never infer them from percentages. |
| “Raw report” label | Rename to “Runner report” | The current endpoint serves generated HTML or a stored HTML artifact, not raw JSON. |
| Static `/concepts/*` routes | Development-only, then remove | They are review fixtures, not a parallel product surface. |

## Target Information Architecture

| Route | Default purpose | Primary states |
| --- | --- | --- |
| `/` | Cross-project operations and triage | `view`, `project`, `status`, `day`, `search`, `inspectRun` |
| `/projects/[slug]` | Project health, trends, and run history | `view=runs|coverage|performance`, `branch`, `search`, `status`, `after`, `inspectRun` |
| `/runs/[id]` | One run and all active publications | `view=summary|tests|failures|coverage|performance|artifacts|report` |
| `/runs/[id]?view=tests` | Suite/test master-detail explorer | `suite`, `test`, `status`, `search`, `after` |
| `/runs/[id]?view=failures` | Failure triage | `failure`, `group=suite|file`, `search`, `after` |
| `/runs/[id]?view=coverage` | Coverage scope/file explorer | `scopeType`, `scopeId`, `file`, `sort`, `below`, `search`, `after` |
| `/runs/[id]?view=performance` | Benchmark changes and history | `group`, `metric`, `series`, `branch`, `runner`, `range` |
| `/runs/[id]?view=artifacts` | Run evidence registry | `kind`, `suite`, `test`, `search`, `after` |
| `/runs/[id]?view=report` | Exact generated runner report | `compact` only when explicitly requested |

### Default run mode

Choose the first useful mode from real active-submission data:

1. `failures` when the run has failed tests;
2. `tests` when an active tests/combined submission exists;
3. `coverage` for a coverage-only run;
4. `performance` for a performance-only run;
5. `summary` for mixed or metadata-only runs.

An explicit valid `view` query parameter always wins. Invalid or unavailable modes redirect shallowly to the first available mode and explain why through an accessible status message.

### Cross-surface flow

| Starting action | Result |
| --- | --- |
| Select overview row | Open existing overview inspector without losing filters. |
| Open project from overview | Enter Project Ledger with the selected project and compatible filter state. |
| Select project run row | Open the project inspector using `inspectRun`; `Open run` enters the run workspace. |
| Select a failed test in Tests mode | Open the same test in Failures mode without refetching shared run/suite facts. |
| Select a coverage file | Open the coverage file inspector; a related test opens Tests mode with `test` and `file` state. |
| Select a benchmark change | Open Performance mode at the exact namespace/metric/series. |
| Open an artifact | Use the authorized artifact URL; preserve the originating workspace URL for Back navigation. |
| Open Runner report | Load the stored report artifact or render-cache endpoint inside the shared run shell. |

## Shared Status and Publication Semantics

The current generic `Run.status` is not enough to describe mixed publications. Introduce one shared presentation contract derived from active submissions:

```text
RunPresentation
  overallStatus
  testStatus
  coverageStatus
  performanceStatus
  publicationKinds[]
  availableViews[]
  defaultView
  freshness
```

- `overallStatus` describes the pipeline run without pretending a performance-only publication is a failed test run.
- `testStatus` is derived only from active tests/combined facts.
- `coverageStatus` is `available`, `missing`, or threshold-derived only when a real threshold is published.
- `performanceStatus` uses the existing benchmark semantics and budget classification.
- The same pure resolver must serve overview rows, project rows, run header, badges, and navigation availability.
- Active submission pointers are authoritative. Never mix facts from inactive revisions or from different runs merely because timestamps are close.

Promote stable values to shared constants and validate them at ingest/BFF boundaries:

- run/test/suite status;
- submission kind;
- artifact kind;
- benchmark direction/budget status;
- coverage scope type;
- resource error code.

## Real-Data Field Contract

### Global application shell

| UI field | Source | Treatment |
| --- | --- | --- |
| Viewer name/access | `viewer` | Retain. |
| Breadcrumb project/run | authorized `Project` and `Run` | Retain; never trust browser-supplied labels. |
| Live/stale state | BFF `generatedAt`, `staleAt`, last refresh outcome | Retain with precise semantics. |
| Search | route-specific indexed/filterable fields | Retain; placeholder changes by workspace. |
| Source run | `Run.sourceUrl` | Show only for valid allowed URLs. |
| Runner report | stored HTML artifact or `/api/runs/[id]/report` | Retain and rename. |

### Project Ledger

| UI group | Source | Treatment |
| --- | --- | --- |
| Project identity/repository/default branch | `Project` | Direct. |
| Current state | latest active tests publication plus `RunPresentation` | Direct server-derived state. |
| Latest build/commit/branch/duration/completion | latest scoped `RunOverview` | Direct. |
| Pass rate | terminal test runs in selected 14-day window | Server aggregate; denominator disclosed. |
| Last run duration | latest completed scoped run | Direct. |
| Test total | latest active tests submission | Direct; unavailable for non-test publications. |
| Coverage | latest active coverage/combined submission | Direct; never carry forward silently. |
| Run count | selected window and branch | Server aggregate; label window explicitly. |
| Activity matrix | day buckets from bounded project runs | Server aggregate with status counts. |
| Duration trend | completed scoped run durations | Bounded points; no performance-stat substitution. |
| Recent runs | cursor-backed `RunOverview` page | Direct. |
| Run inspector | selected `RunOverview`, publication kinds, suite summaries, artifact availability | Lazy resource keyed by run ID. |
| Branch filter | bounded distinct branches from project runs | Add a server facet query; default to all branches. |

### Run Workbench and Tests mode

| UI group | Source | Treatment |
| --- | --- | --- |
| Header metadata | `Run`, `Project`, `ProjectVersion`, `RunOverview` | Direct. |
| Passed/failed/skipped/total | `RunOverview` projected from active test facts | Direct. |
| Suite count | active `SuiteRun` count | Add to run workspace overview. |
| Artifact count | active authorized `Artifact` count | Add to run workspace overview. |
| Coverage summary | active `CoverageSnapshot` | Direct. |
| Suite rail | `SuiteRun.id/label/runtime/status/durationMs/summary` | Cursor not required for normal counts; cap and search if very large. |
| Test list | `testsForSuite` | Retain SQL filters, cursor pagination, prefetch, and virtualization. |
| Test detail | `TestExecution` plus parent suite and test artifacts/errors | Add a narrow authorized detail resource. |
| Assertions | `TestExecution.assertions` | Show only when non-empty. |
| Source location/snippet | `filePath`, `line`, `column`, `sourceSnippet` | Direct; source link only when resolvable. |
| Runtime | parent `SuiteRun.runtime` | Direct. |
| Owner | associated `ProjectModule.owner` | Conditional. |
| Console/logs | typed captured output or log artifact | Conditional; do not expose arbitrary environment secrets. |
| Environment | allowlisted runtime/platform metadata | Conditional; never dump process environment. |

### Failure Triage mode

| UI group | Source | Treatment |
| --- | --- | --- |
| Failure list/count | failed `TestExecution` rows under active suites | Add stable cursor pagination and suite/file facets. |
| Failure title/file/duration | `TestExecution` | Direct. |
| Primary message | first `failureMessages` entry, then linked `ErrorOccurrence.message` | Direct with deterministic precedence. |
| Source panel | `sourceSnippet` plus location | Direct when present. |
| Stack frames | linked `ErrorOccurrence.stack` or structured raw detail | Parse on the server into safe frames; keep raw fallback downloadable. |
| Console output | captured log artifact or validated structured console entries | Conditional. |
| Local command | parent `SuiteRun.command` and `cwd` | Display stored command only; do not append invented flags. |
| Artifacts | test, suite, then run artifact scopes | Direct and labeled by scope. |
| Ownership | associated module owner | Conditional. |
| Failure history | canonical test identity across prior active submissions | Add only after a stable `testIdentityKey` exists. |
| Previous/next failure | current ordered failure page/list | Direct client navigation with prefetch. |

### Coverage Workbench mode

| UI group | Source | Treatment |
| --- | --- | --- |
| Lines/branches/functions/statements | `CoverageSnapshot` covered/total/pct | Direct; retain full precision and round only for display. |
| Test outcome band | `RunOverview` test counts | Direct and visually separate from coverage. |
| Coverage trend | `coverageTrend` for selected scope | Direct bounded series. |
| Scope tree/facets | coverage file package/module associations | Add server aggregate counts and lowest coverage per scope. |
| Coverage file table | direct `CoverageFile` connection | Add filter/sort/cursor support; do not rebuild through `runFiles`. |
| File owner | associated `ProjectModule.owner` | Conditional. |
| Related tests | file-associated `TestExecution` rows | Bounded and linked to Tests mode. |
| Coverage delta | `runCoverageComparison.fileChanges` | Replace arbitrary risk and last-changed fields. |
| Source link | repository provider + commit + project file path | Server-resolved and conditional. |
| Uncovered ranges | adapter-provided typed ranges | Deferred/conditional until persisted. |

The illustrative `14/14` Tests values become explicit `testCount`, `passedTestCount`, and `failedTestCount`. Do not imply that a test-to-file relationship proves every line is exercised.

### Performance, artifacts, and report modes

| UI group | Source | Treatment |
| --- | --- | --- |
| Benchmark summary/top changes | existing `benchmarkSummary` | Retain as the first performance surface. |
| Namespace catalog | existing `benchmarkCatalog`/summary namespaces | Retain. |
| Metric history | bounded `performanceTrends` | Load only the selected namespace/metrics. |
| Run deltas | benchmark change summary matched to run | Retain; raw rows remain secondary. |
| Artifact registry | `Artifact` with submission/suite/test scope | Add bounded filters and stable delivery status. |
| Generated report | stored HTML artifact, then render-once cache fallback | Retain existing ETag/cache behavior. |
| Raw JSON | active `ReportSubmission.rawReport` | Admin/debug download only, not a primary operator tab. |

## Target Read and API Architecture

Continue using GraphQL behind the web tier. The performance work already demonstrates that replacing GraphQL is not the high-value change. The browser should consume narrow same-origin BFF resources with stable error and cache behavior.

### Read-side boundaries

Split the large query service by use case while preserving a request-scoped authorization/data context:

- `projectWorkspaceRepository`
  - project header and health aggregate;
  - branch/status facets;
  - activity and duration buckets;
  - cursor run feed.
- `runWorkspaceRepository`
  - run header, publication availability, summary counts;
  - suite summaries and artifact availability.
- `testExplorerRepository`
  - suite test pages;
  - test detail;
  - failure pages, facets, evidence, and optional history.
- `coverageExplorerRepository`
  - run snapshot and facets;
  - direct coverage-file pages;
  - file detail, delta, related tests, and scoped trend.
- `benchmarkRepository`
  - retain the existing bounded catalog, summary, and series operations.
- `artifactRepository`
  - bounded metadata and authorized delivery resolution.

Each repository accepts an authorized project/run reference from the request data context. It must not independently reload the full run or `rawReport` merely to prove access.

### BFF resource contracts

| Resource | Purpose | Cache policy |
| --- | --- | --- |
| `GET /api/projects/[slug]/workspace` | Header, window aggregate, facets, first run page | private short TTL + SWR |
| `GET /api/projects/[slug]/runs` | Cursor run page with branch/status/search | private short TTL + SWR |
| `GET /api/projects/[slug]/activity` | Activity/duration/coverage aggregates | keep existing endpoint; extend typed response |
| `GET /api/projects/[slug]/benchmark` | Summary or selected namespace | keep existing endpoint |
| `GET /api/runs/[id]/workspace` | Run header, presentation, counts, suites, first useful mode | private short TTL + SWR |
| `GET /api/runs/[id]/suite-tests` | Existing filtered cursor page | keep and extend only when needed |
| `GET /api/runs/[id]/tests/[testId]` | Test detail, owner, scoped artifacts/errors | private immutable for terminal runs |
| `GET /api/runs/[id]/failures` | Cursor failure page and facets | private immutable for terminal runs |
| `GET /api/runs/[id]/coverage` | Snapshot, scope facets, selected coverage-file page | private immutable for terminal runs |
| `GET /api/runs/[id]/coverage/files/[fileId]` | File detail, delta, related tests, trend | private immutable for terminal runs |
| `GET /api/runs/[id]/artifacts` | Bounded scoped artifact metadata | private immutable for terminal runs |
| `GET /api/runs/[id]/report` | Existing HTML/stored artifact response | retain ETag and SWR behavior |

All JSON resources use a stable shape:

```json
{
  "data": {},
  "pageInfo": null,
  "facets": null,
  "meta": {
    "requestId": "...",
    "generatedAt": "...",
    "projectionVersion": "..."
  }
}
```

Errors use the existing stable envelope with `code`, safe `message`, `requestId`, and `retryable`. A failed secondary panel must not be translated to an empty successful collection.

### Minimal persistence changes

Prefer existing projections and relations. Add persistence only for data the product cannot compute honestly and cheaply:

1. Add `testIdentityKey` to normalized test facts before enabling cross-run failure history.
2. Add optional typed uncovered coverage ranges only when adapters can supply them; otherwise keep the UI hidden.
3. Extend `RunOverview` or a dedicated run-workspace projection with suite count, artifact count, active publication kinds, and per-kind status if query evidence shows repeated joins.
4. Extend project aggregate projection with selected-window health only if request-time indexed aggregation misses budgets; do not materialize arbitrary user filters.

Every migration requires restartable backfill, parity checks, and active-submission awareness.

## Frontend Architecture

### Shared frame

Create one compact `ApplicationFrame` used by overview, project, run, auth, and admin routes. It owns:

- brand, breadcrumbs, viewer, live/stale state, and global actions;
- route-scoped command/search slot;
- consistent dark tokens, spacing, type, borders, status colors, and responsive breakpoints;
- focus restoration and skip navigation.

The static concepts' geometry becomes production tokens; their hard-coded component tree does not.

### Project components

- `ProjectWorkspace`
- `ProjectContextBar`
- `ProjectNavigation`
- `ProjectSummaryStrip`
- `ProjectActivityPanel`
- `ProjectDurationTrend`
- `ProjectRunGrid`
- `ProjectRunInspector`

### Run components

- `RunWorkspace`
- `RunContextBar`
- `RunModeTabs`
- `RunSummaryStrip`
- `SuiteRail`
- `TestGrid`
- `TestInspector`
- `FailureExplorer`
- `FailureEvidenceInspector`
- `CoverageExplorer`
- `CoverageFileGrid`
- `CoverageFileInspector`
- existing benchmark components behind `PerformanceExplorer`
- `ArtifactExplorer`
- `RunnerReportFrame`

Large components should be split by resource ownership, not merely by visual card. New workspace components may use JSX consistently; no repository-wide syntax rewrite is required.

### State ownership

| State | Owner |
| --- | --- |
| Viewer and visible project scope | server request/session |
| Project/run identity | route path |
| Mode, filters, and selected entity | router query state |
| SSR shell data | page props |
| Resource data/loading/error/stale state | dedicated resource hook keyed by URL and authorized entity ID |
| Temporary disclosure state | local component state |
| Cross-route selected project/run hints | existing Redux navigation context only |

Do not merge independent endpoint payloads into one mutable `resolvedData` object. Introduce a small `useBffResource` layer with:

- key-based in-page cache;
- `AbortController` cancellation;
- last-good-data retention;
- loading, stale, error, and retry state;
- request de-duplication;
- optional first/next-page prefetch;
- no global server-data mirroring in Redux.

## Interaction and Responsive Contract

### Desktop

- Use the three-pane concept layout when at least `1280px` is available.
- Left pane owns scope/list navigation.
- Center pane owns the dominant table/evidence surface.
- Right pane owns selected-entity detail.
- Tables use aligned tabular numerals, fixed high-value columns, and cursor pagination.

### Medium widths

- Left rail collapses to a drawer.
- Right inspector becomes a bounded overlay that preserves center scroll and selection.
- Lower-priority columns disappear before horizontal body overflow appears.

### Narrow widths

- Header, summary, and tabs remain available without sideways page scrolling.
- Left navigation becomes a modal drawer.
- Inspector becomes a bottom sheet with independent scrolling.
- Closing returns focus to the originating row.

### Accessibility

- Every selectable row supports Enter/Space and exposes selection state.
- Tabs use the tab/list semantics appropriate to client-side mode switching.
- Status is always text/symbol plus color.
- Charts have textual summaries and keyboard-accessible points when interactive.
- Loading/error/empty states preserve panel geometry and announce changes politely.
- Back/forward restores mode, filters, selection, and usable focus.

## Performance, Reliability, and Observability

### Inherited budgets

Retain the enforced performance program and existing deterministic 100/1,000/10,000-test fixtures. The unified UI must not regress the accepted Operations Overview or Phase 6 checkpoints.

| Critical measurement | Initial gate |
| --- | --- |
| Home shell p95 | `<= 1,000 ms` |
| Project shell p95 | `<= 1,000 ms` |
| Run shell p95 | `<= 1,000 ms` |
| Run workspace interactive p95 | `<= 1,500 ms` |
| Selected secondary BFF panel p95 | `<= 500 ms` |
| Suite expansion p95 | `<= 300 ms` |
| Paginated test fetch p95 | `<= 250 ms` |
| Initial overview serialized payload | `<= 300 KB` compressed-equivalent |

Phase 0 must add explicit budgets for failure-list, failure-evidence, coverage-file-page, coverage-file-inspector, artifact-page, DOM node count, transferred bytes, and interaction readiness. Budgets are changed only with documented evidence before enforcement.

### Required marks and profiles

- `project-workspace-shell-ready`
- `project-run-feed-ready`
- `run-workspace-shell-ready`
- `run-tests-ready`
- `run-failures-ready`
- `failure-evidence-ready`
- `run-coverage-ready`
- `coverage-file-page-ready`
- `coverage-file-inspector-ready`
- `run-performance-ready`
- `run-artifacts-ready`
- `runner-report-ready`

For each BFF/GraphQL operation record request ID, cache result, query count, database time, pool wait, known rows, response bytes, total duration, and error category. Browser benchmarks record TTFB, readiness marks, INP surrogate, long tasks, DOM nodes, heap, resources, and response sizes.

### Failure behavior

- Shell failure is route-level; panel failure is panel-level.
- Retain last good data during refresh failures and mark it stale.
- Terminal-run resources may use immutable caching; live runs use bounded revalidation.
- Cancel stale requests on scope/mode/selection changes.
- Auto-refresh must never clear selection or replace an inspector with a different entity.
- A selected entity that falls outside a filter remains explained and offers a clear-filter action.

## Implementation Phases

### Phase 0 — Contract freeze and measurable baseline

Objective: prevent the visual migration from changing data meaning or losing performance evidence.

Deliverables:

1. Freeze the four implementation captures and the deployed Operations Overview capture as references.
2. Build a field-contract fixture matrix covering:
   - passed test run;
   - failed run with source/error/artifacts;
   - coverage-only run;
   - performance-only run;
   - combined run;
   - missing optional metadata;
   - 10,000-test run;
   - unauthorized project/run.
3. Add contract tests for `RunPresentation`, null handling, active submissions, and default mode selection.
4. Capture current project/run route timing, bytes, DOM nodes, query count, and screenshots.
5. Add new KPI names and budgets to the existing checkpoint tooling.
6. Produce an explicit field coverage report: direct, derived, conditional, deferred, or removed.

Exit criteria:

- every visible planned field has a named source and null behavior;
- baseline artifacts are reproducible;
- no phase begins with an unresolved status/count definition.

### Phase 1 — Shared contracts and bounded read resources

Objective: establish one data interpretation before replacing production UI.

Deliverables:

1. Implement shared status/publication constants and `RunPresentation`.
2. Add project/run workspace GraphQL projections and same-origin BFF handlers.
3. Split the relevant query-service methods into the bounded repositories defined above.
4. Add direct coverage-file paging instead of rebuilding coverage through `runFiles`.
5. Add narrow test detail and failure page/evidence resources.
6. Add runtime response validation and consistent envelopes/errors.
7. Preserve request-scoped authorization memoization and parent-child scope checks.

Exit criteria:

- BFF contract tests pass for every fixture cohort;
- PostgreSQL plans show bounded rows and matching indexes;
- no shell query selects `Run.rawReport`;
- old UI can consume adapters without semantic changes.

### Phase 2 — Cohesive application frame and routing

Objective: make every route feel like one application before changing its main content.

Deliverables:

1. Extract compact shared frame/tokens from the accepted Operations Overview and static concepts.
2. Implement breadcrumbs and route-scoped search/actions.
3. Implement URL parsers/serializers for project and run workspace state.
4. Add responsive left rail and inspector primitives with focus restoration.
5. Keep legacy page content mounted inside the frame behind a feature flag.
6. Preserve current `data-perf-id` hooks or provide an explicit migration map.

Exit criteria:

- overview, project, run, auth, and admin routes share the frame without layout regressions;
- direct URLs and back/forward work at desktop and narrow widths;
- no global style leakage from concept CSS.

### Phase 3 — Project Ledger integration

Objective: replace the current project cards with the real-data project workspace.

Deliverables:

1. Wire project context, health, branch facet, summary strip, activity, and duration trend.
2. Replace the current project run table with the dense cursor-backed grid.
3. Reuse the overview `inspectRun` interaction and a narrow run inspector.
4. Add Runs, Coverage, and Performance modes; integrate current benchmark summary/explorer.
5. Keep release notes as chart annotations, not a primary empty view.
6. Add loading, empty, stale, partial-error, long-label, and unavailable-value states.

Exit criteria:

- every number reconciles with the project workspace API;
- branch/status/search filters coordinate every project panel;
- a run can be selected and opened without losing project state;
- project shell and interaction budgets pass.

### Phase 4 — Run shell and Tests workbench

Objective: make the run concept the canonical run route with progressive test exploration.

Deliverables:

1. Replace the current large card stack with run context, mode tabs, and shared summary strip.
2. Drive tab visibility/default mode from `RunPresentation`.
3. Wire suite rail to active suite summaries.
4. Reuse the accepted SQL filters, 100-row cursor pages, cancellation, prefetch, and virtualization for tests.
5. Add narrow test detail loading with assertions, source, owner, runtime, and scoped artifacts.
6. Hide unavailable accordions and remove the fictional segmented timeline.
7. Preserve legacy `?template=runner|web` URLs through redirects for one stable release.

Exit criteria:

- passed, mixed, missing-data, and 10,000-test fixtures render correctly;
- selecting a suite/test is URL-addressable and keyboard-safe;
- initial shell does not wait for test pages or historical panels;
- run shell, interaction, suite, DOM, and payload budgets pass.

### Phase 5 — Failure Triage integration

Objective: provide dense failure diagnosis using only captured evidence.

Deliverables:

1. Add paginated failure list with suite/file grouping and search.
2. Add selected failure detail with message, source snippet, structured stack, and duration.
3. Resolve artifacts by test → suite → run scope without duplication.
4. Show stored suite command, captured console/log evidence, and owner only when available.
5. Prefetch adjacent failures and preserve previous/next navigation.
6. Add `testIdentityKey` and bounded history only if migration/backfill parity is proven; otherwise omit History for this release.
7. Link a failed test bidirectionally between Tests and Failures modes.

Exit criteria:

- no attempt, flake, assignee, command, console, or history value is invented;
- partial evidence failures do not break the failure list;
- authorization and cross-run ID mismatch tests pass;
- failure list/evidence budgets pass.

### Phase 6 — Coverage Workbench integration

Objective: replace coverage cards with a scalable run-scoped coverage explorer.

Deliverables:

1. Wire snapshot metric cards and test outcome band.
2. Add package/module/file facets and scoped trend selection.
3. Add direct coverage-file sorting, threshold filtering, search, cursor pagination, and exact totals.
4. Add file inspector with metrics, owner, previous-run delta, related tests, and conditional source link.
5. Add bidirectional file/test navigation.
6. Show uncovered ranges only after typed adapter → ingest → storage → API proof exists.
7. Remove risk, last-changed, and settings placeholders.

Exit criteria:

- displayed percentages reconcile with covered/total counts;
- `null` metrics remain unavailable rather than zero;
- a large file cohort reads only the requested page and aggregates;
- coverage page/inspector/browser budgets pass.

### Phase 7 — Performance, artifacts, and Runner report convergence

Objective: finish the run workspace without duplicating existing specialized features.

Deliverables:

1. Place benchmark summary/top changes before exact metric history.
2. Reuse bounded namespace/series queries and existing benchmark semantics.
3. Add artifact registry grouped by submission and evidence scope.
4. Embed the generated report as the Runner report mode using stored artifacts and ETag behavior.
5. Restrict raw JSON to an authorized debug/download action.
6. Link performance and artifact evidence back to their source run/suite/test.

Exit criteria:

- performance-only runs default to a useful screen;
- artifact/report errors are isolated and retryable;
- no benchmark request fan-out or 100-metric truncation returns;
- benchmark/report budgets and cache assertions pass.

### Phase 8 — Cohesion, responsive behavior, and cleanup

Objective: remove seams left by phased delivery.

Deliverables:

1. Normalize typography, density, status language, icons, empty states, and inspector behavior.
2. Validate desktop, medium, and narrow layouts with long real values.
3. Complete keyboard, screen-reader, reduced-motion, contrast, and focus testing.
4. Remove duplicate formatters, status interpreters, request hooks, and old card-only components.
5. Break up `pages/projects/[slug].js`, `pages/runs/[id].js`, `serverGraphql.js`, and the query service so route files orchestrate rather than render domains.
6. Keep concept screenshots as test evidence but stop compiling concept routes in production.
7. Run the full repository, GraphQL, PostgreSQL, browser, and visual suites.

Exit criteria:

- one shared implementation owns each visual/data primitive;
- no body-level horizontal overflow at supported widths;
- every control performs a real action or is absent;
- full correctness and performance suites are green.

### Phase 9 — Progressive rollout and legacy removal

Objective: switch production safely and remove duplicate behavior after evidence is green.

Deliverables:

1. Ship project and run workspaces behind `WEB_UNIFIED_EXPLORER` while keeping old routes as rollback targets.
2. Exercise public/guest, authenticated, admin, unauthorized, large-run, coverage-only, and performance-only cases.
3. Compare server profiles, browser checkpoints, errors, and screenshots with the frozen baseline.
4. Roll out project workspace, then run shell/Tests, then Failures/Coverage, then remaining modes.
5. Require three consecutive green production checkpoints under mixed ingest/read load.
6. Remove legacy route components, compatibility redirects after one stable release, and production concept routes.
7. Update operator documentation and deployment runbooks.

Exit criteria:

- production routes use the unified workspaces for every viewer class;
- real fields reconcile with database/API evidence;
- error rate, latency, bytes, DOM, and query budgets are green;
- rollback is tested before legacy code is removed.

## Test Strategy

| Layer | Required coverage |
| --- | --- |
| Pure domain | status/publication presentation, default views, null handling, aggregate definitions, URL state |
| Ingest | active submission isolation, test identity, optional coverage ranges, ownership, artifact scope |
| Repository/PostgreSQL | authorization, parent-child scope, cursor order, filters, facets, bounded rows, indexes |
| GraphQL | typed projection parity, partial failures, no raw-report shell reads |
| BFF | method/input validation, envelopes, cache headers, request IDs, safe errors, cancellation |
| Components | retained/conditional/removed fields, loading/stale/error/empty states, selection |
| Browser | complete cross-route journeys, back/forward, direct links, keyboard/focus, responsive layouts |
| Performance | 100/1,000/10,000 tests, large coverage file set, failure evidence, benchmark namespace, mixed load |
| Visual | concept comparison plus real long/missing/failure/coverage-only/performance-only states |

## Definition of Done

The program is complete only when:

1. Overview, project, and run routes form one predictable drill-down journey.
2. Tests, failures, coverage, performance, artifacts, and report modes share one run context and URL model.
3. Every visible field is direct, documented derived data, or clearly unavailable.
4. Every illustrative unsupported field listed in this plan is removed or genuinely implemented end to end.
5. All list resources are filtered/paginated in SQL and all large browser lists are progressive/windowed.
6. Authorization derives project/run/suite/test/file ownership on the server.
7. Panel failures are isolated, retryable, traced, and never disguised as empty success.
8. Existing and new performance budgets pass for deterministic fixtures and three production checkpoints.
9. Desktop/narrow accessibility and visual acceptance are complete for guest, authenticated, and admin viewers.
10. Legacy duplicate components and production concept routes are removed after the rollback window.

## Non-Goals

- Replacing GraphQL, Next.js, PostgreSQL, or the existing artifact storage strategy.
- A repository-wide TypeScript or JSX conversion.
- WebSockets as a prerequisite; interval refresh remains sufficient.
- Inventing issue tracking, assignment, Git blame, retry, flakiness, or coverage-range data.
- Loading complete raw reports, all tests, all coverage files, or all benchmark series into an initial page.
- Reworking admin access management beyond fitting it into the shared application frame.
