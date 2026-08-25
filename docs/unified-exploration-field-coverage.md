# Unified Exploration Field Coverage

This report freezes the production field decisions for the unified exploration workspace. `null` and absent values render as unavailable; they are never coerced to zero.

| Surface | Field group | Source | Treatment | Null behavior |
| --- | --- | --- | --- | --- |
| Shared | overall/test/publication state | active submissions plus `RunOverview` | derived once by `buildRunPresentation` | `unknown`/`missing`; unavailable tabs hidden |
| Shared | branch, commit, build, source URL, timestamps | authorized `Run` and `ProjectVersion` | direct | `n/a`; source action hidden |
| Project | pass rate | terminal test runs in visible 14-day feed | derived | `n/a` when denominator is zero |
| Project | run grid | `RunOverview` cursor feed | direct | individual unavailable cells show `n/a` |
| Project | coverage history | active `CoverageTrendPoint` rows | direct | empty state |
| Project | performance | bounded benchmark summary/catalog | direct/derived server-side | empty state |
| Run | test counts, duration, suites | `RunOverview` summary and active `SuiteRun` | direct | `n/a` |
| Tests | test page | `testsForSuite` 100-row cursor page | direct | empty page |
| Tests | owner | associated `ProjectModule.owner` | conditional | row omitted |
| Tests | assertions/source | `TestExecution` | conditional | section omitted |
| Failures | list/message/source/stack | failed `TestExecution` plus active `ErrorOccurrence` | direct with deterministic message precedence | evidence section omitted or explicit unavailable message |
| Failures | command | stored `SuiteRun.command` and `cwd` | conditional | row omitted; never synthesized |
| Coverage | snapshot metrics | active `CoverageSnapshot` covered/total/pct | direct | `n/a`; no zero bar implication |
| Coverage | file page | direct active `CoverageFile` query | direct | empty page |
| Coverage | delta | `runCoverageComparison.fileChanges` | derived server-side | `n/a` |
| Coverage | related tests | file-path matched active tests | conditional and bounded | section omitted |
| Performance | benchmark rows | active `PerformanceStat` and bounded benchmark resources | direct | empty state |
| Artifacts | registry/scope/link | active authorized `Artifact` | direct | unavailable link shown as stored metadata only |
| Report | generated HTML | stored HTML artifact, then render cache | direct/fallback | isolated report error |

Removed fields: project tags, project-level suites/artifacts, primary Releases tab, inferred setup/test/teardown timing, unresolved owner labels, empty console panels, inferred retry/flaky state, generated reproduction commands, assignee/issue actions, coverage last-changed/risk/settings, and uncovered ranges without typed persisted data.

## Performance gates

| Resource | Gate |
| --- | ---: |
| Workspace interactive | 1,500 ms p95 |
| Failure list | 500 ms p95 |
| Failure evidence | 500 ms p95 |
| Coverage file page | 500 ms p95 |
| Coverage file inspector | 500 ms p95 |
| Artifact page | 500 ms p95 |
| Initial DOM | 3,500 nodes |
| Initial transferred bytes | 500,000 bytes |

The deterministic 100/1,000/10,000-test fixtures and existing phase checkpoints remain the reproducible baseline. Browser readiness marks are defined in `RunWorkspace.jsx` and `ProjectWorkspace.jsx` and captured by the existing performance harness.
