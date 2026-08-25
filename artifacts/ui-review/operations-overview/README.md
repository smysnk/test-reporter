# Operations overview review record

Generated: 2026-08-25

## Reproduction

- Baseline revision: `44aac3e`
- GraphQL fixture: `tests/fixtures/operations-overview-graphql-server.mjs`
- Fixture scale: 3 visible projects, 84 publications, 50-row initial payload
- Primary comparison: `1660 x 948`
- Responsive checks: `1440 x 1024`, `1024 x 768`, `390 x 844`
- Performance viewport: `1440 x 1024`

## Visual checklist

- Compact 60px application header and full-width console frame
- Persistent/collapsible project scope at desktop; off-canvas chooser at 1024px and below
- Flat bordered surfaces without overview hero copy or per-run cards
- Five stable aggregate metrics with explicit unavailable states
- 14 local-calendar days, status symbols plus color, and a truthful loaded-window disclosure
- Coverage drift with contribution counts and an adaptive vertical range
- 40px desktop run rows; 18 fully visible rows at 1440 x 1024
- Selected row and lazy evidence remain in overview context
- Medium overlay and narrow bottom-sheet inspector
- No body-level horizontal overflow at any review viewport
- Narrow grid retains project/result, status, build, and completion columns
- Narrow summary stacks into two columns; 9 useful run rows remain visible at 390 x 844
- Keyboard command search, row activation, Escape/close, and focus restoration
- 60-second pauseable refresh with live, paused, stale, error, and retry states

## Artifacts

### Phase 0 baseline

- `phase-0/baseline-1660x948.png`
- `phase-0/baseline-1440x1024.png`
- `phase-0/baseline-1024x768.png`
- `phase-0/baseline-390x844.png`
- `phase-0/baseline-same-fixture-performance.json`

### Phase 8 candidate

- `phase-8/final-1660x948.png`
- `phase-8/final-1660x948-activity.png`
- `phase-8/final-1660x948-inspector.png`
- `phase-8/final-1440x1024.png`
- `phase-8/final-1024x768-inspector.png`
- `phase-8/final-390x844.png`
- `phase-8/final-390x844-inspector.png`
- `phase-8/final-performance-warm.json`

### Phase 8 deployed

- `phase-8/deployed-1660x948.png`
- `phase-8/deployed-1660x948-activity.png`
- `phase-8/deployed-1660x948-failure-inspector.png`
- `phase-8/deployed-390x844.png`
- `phase-8/deployed-390x844-failure-inspector.png`
- `phase-8/deployed-acceptance.json`

### Vertical-slice captures

- Phase 1: `phase-1/compact-shell-1660x948.png`
- Phase 2: `phase-2/project-rail-1660x948.png`
- Phase 3: `phase-3/summary-strip-1660x948.png`
- Phase 4: `phase-4/activity-coverage-1660x948.png`
- Phase 5: `phase-5/run-grid-1660x948.png`
- Phase 6: `phase-6/failure-inspector-1660x948.png`
- Phase 7: `phase-7/mobile-sheet-390x844.png`

## Performance checkpoint

The same 84-publication fixture was used for the pre-redesign and final production builds. The old page intentionally rendered only 10 rows; the new contract renders a complete 50-row client page.

| Metric | Baseline | Final warm | Interpretation |
| --- | ---: | ---: | --- |
| Home interactive | 205.5 ms | 253.5 ms | +23.4%; 5x as many initial rows, still below the 1,000 ms budget |
| Home interactive per visible row | 20.6 ms | 5.1 ms | -75.3% normalized for rendered feed density |
| FCP | 80 ms | 84 ms | +5.0% |
| CLS | 0.8327 | 0.9317 | +11.9%; within the 15% non-regression threshold |
| Decoded HTML | 27,598 B | 86,390 B | 3.1x for 5x rows; below the 300 KB API-escalation threshold |
| DOM nodes | 271 | 813 | 3.0x for 5x rows |
| Lazy evidence | unavailable | 107.3 ms | below the 750 ms evidence budget |

The serialized `__NEXT_DATA__` payload measured 34,438 characters for 50 rows. Cursor pagination remains appropriate but no separate aggregate API is required by the plan's 300 KB threshold.

## Verification

- Repository tests: 196 passed, 0 failed
- Syntax lint: 204 web and 58 server JavaScript files checked through the repository lint command
- Next.js production build: successful; `/api/runs/[id]/failure-evidence` registered as a dynamic API route
- Focused Playwright interactions: coordinated project/day/status/search URL state and inspector focus restoration passed
- Focused Playwright performance: 1,000 ms home and 750 ms evidence budgets passed
- Browser review: zero console warnings/errors in the final activity view
- Non-overview regression: `/auth/signin` retained its existing shell and had no overflow or server error
- Deployed revision: `ff87936f068e18cd9d7b436c427aec9b43c5a8ad`
- Deployed image digest: `sha256:28c6cc335a9a0df8ae2b1c88c746574b1797f15ef8ebc856856d845669dd9015`
- Release workflow: `32887549696`, all jobs passed including the deployed benchmark and 25-reader reliability gate
- Live interactions: 6 passed, 2 benchmark-dashboard checks skipped for absent public benchmark data
- Live guest data: 7 projects, 12 publications in the 14-day window, and a direct older failed-run evidence request rendered successfully
- Authenticated/admin browser verification remains pending because available sessions are signed out and Google sign-in requires explicit user confirmation

## Gap log

- Fixed activity selection losing its day filter because Redux-to-URL synchronization raced the router update.
- Replaced the loaded-publication sequence with deterministic 14-day project/day buckets.
- Added explicit loaded-window disclosure so partial pagination never implies complete activity history.
- Replaced the flat 0-100 coverage scale with an adaptive range so real drift remains legible.
- Added a direct-URL evidence path for selected runs outside the first 50 rows.
- Added a reason when no report/log target exists and retry/error/missing-stack states.
- Removed superseded matrix and summary CSS after component extraction.

Deployment revision, image digest, and production verification are recorded after rollout.
