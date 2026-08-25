import React from 'react';
import styles from './TestExecutionConcepts.module.css';

const projectRuns = [
  ['#53', '5a932fa', 'master', '2 / 2', '6.4s', 'n/a', 'Aug 24, 2:59 PM'],
  ['#52', 'de661f0', 'master', '2 / 2', '6.7s', 'n/a', 'Aug 24, 2:57 PM'],
  ['#51', '67b820c', 'master', '2 / 2', '6.3s', 'n/a', 'Apr 30, 12:36 PM'],
  ['#50', '9dd81a1', 'master', '2 / 2', '5.9s', 'n/a', 'Mar 16, 2:53 PM'],
  ['#49', '3f0c9b2', 'master', '2 / 2', '6.1s', 'n/a', 'Mar 9, 4:12 PM'],
  ['#48', '1d4e8aa', 'master', '2 / 2', '6.6s', 'n/a', 'Feb 28, 11:08 AM'],
  ['#47', 'a7d0e64', 'master', '2 / 2', '6.8s', 'n/a', 'Feb 22, 9:41 AM'],
  ['#46', 'c62b9f1', 'master', '2 / 2', '5.8s', 'n/a', 'Feb 15, 3:27 PM'],
];

function Dot({ tone = 'green' }) {
  return <span className={`${styles.dot} ${styles[`dot_${tone}`]}`} aria-hidden="true" />;
}

function Brand() {
  return <strong className={styles.brand}>TEST <i>/</i> STATION</strong>;
}

function Search({ copy = 'Search runs, repos, builds…' }) {
  return (
    <div className={styles.globalSearch}>
      <span className={styles.searchIcon}>⌕</span>
      <span>{copy}</span>
      <kbd>⌘ K</kbd>
    </div>
  );
}

function TopBar({ breadcrumb, searchCopy }) {
  return (
    <header className={styles.topBar}>
      <Brand />
      <div className={styles.crumbs}>{breadcrumb}</div>
      <Search copy={searchCopy} />
      <div className={styles.live}><Dot /> Live⌄</div>
      <span className={styles.topDivider} />
      <div className={styles.user}><span className={styles.avatar}>●</span><span>Guest<small>guest access</small></span><b>⌄</b></div>
    </header>
  );
}

function Button({ children, primary = false, wide = false }) {
  return <button type="button" className={`${styles.button} ${primary ? styles.buttonPrimary : ''} ${wide ? styles.buttonWide : ''}`}>{children}</button>;
}

function Status({ failed = false, children }) {
  return <span className={`${styles.status} ${failed ? styles.statusFailed : styles.statusPassed}`}><Dot tone={failed ? 'red' : 'green'} />{children}</span>;
}

function Sparkline({ red = false }) {
  return (
    <svg className={styles.sparkline} viewBox="0 0 310 72" preserveAspectRatio="none" aria-hidden="true">
      <path className={styles.gridLine} d="M0 14H310M0 36H310M0 58H310" />
      <path className={red ? styles.sparkRed : styles.sparkBlue} d={red ? 'M3 18 L48 37 L90 22 L132 25 L174 27 L220 44 L264 49 L307 27' : 'M3 43 L36 34 L68 45 L101 37 L135 38 L168 45 L202 36 L237 41 L272 35 L307 42'} />
      {[3, 36, 68, 101, 135, 168, 202, 237, 272, 307].map((x, index) => <circle key={x} cx={x} cy={red ? [18, 37, 22, 25, 27, 44, 49, 27][Math.min(index, 7)] : [43, 34, 45, 37, 38, 45, 36, 41, 35, 42][index]} r="2.8" />)}
    </svg>
  );
}

function Kpi({ label, value, tone }) {
  return <div className={styles.kpi}><small>{label}</small><strong className={tone ? styles[tone] : ''}>{value}</strong></div>;
}

function ProjectLedgerRail() {
  const entries = [['⌂', 'Overview', null], ['☷', 'Runs', '4'], ['▣', 'Suites', '2'], ['◔', 'Coverage', null], ['⌁', 'Performance', null], ['▱', 'Artifacts', null]];
  return (
    <aside className={styles.projectRail}>
      <nav className={styles.railNav}>{entries.map(([icon, label, count], index) => (
        <div className={`${styles.railItem} ${index === 0 ? styles.railItemActive : ''}`} key={label}><span>{icon}</span>{label}{count ? <b>{count}</b> : null}</div>
      ))}</nav>
      <div className={styles.railSection}><small>Branch</small><div className={styles.selectBox}>⑂&nbsp; master <span>⌄</span></div></div>
      <div className={styles.railSection}><small>Tags</small><button type="button" className={styles.plus}>＋</button><p>No tags applied</p></div>
      <div className={styles.railFooter}>⚙ <span>Manage project</span><b>↗</b></div>
    </aside>
  );
}

function ProjectContext() {
  return (
    <div className={styles.projectContext}>
      <strong>gulp-rev-all</strong>
      <Status>PASSING</Status>
      <span className={styles.contextDivider} />
      <span>⑂&nbsp; master</span><span className={styles.contextDivider} />
      <a>⑂&nbsp; #53</a><span className={styles.contextDivider} />
      <code>5a932fa</code><span className={styles.contextDivider} />
      <span>◷&nbsp; 2m ago</span>
      <div className={styles.contextActions}><Button>Open source&nbsp; ↗</Button><Button>⚙&nbsp; Settings</Button></div>
    </div>
  );
}

function ActivityGrid() {
  return (
    <div className={styles.miniPanel}>
      <small className={styles.panelLabel}>RUN ACTIVITY (LAST 14 DAYS)</small>
      <div className={styles.dates}>{['Aug 11','12','13','14','15','16','17','18','19','20','21','22','23','24'].map(value => <span key={value}>{value}</span>)}</div>
      <div className={styles.heatRows}>{[0,1,2].map(row => <div key={row}>{Array.from({ length: 14 }, (_, index) => <i className={index >= 10 ? styles.heatGreen : ''} key={index} />)}</div>)}</div>
      <div className={styles.legend}><span><i /> No runs</span><span><i className={styles.heatGreen} /> Passed</span><span><i className={styles.heatRed} /> Failed</span><span><i className={styles.heatAmber} /> Partial</span></div>
    </div>
  );
}

function DurationTrend() {
  return (
    <div className={styles.miniPanel}>
      <small className={styles.panelLabel}>DURATION TREND (LAST 14 DAYS)</small>
      <div className={styles.chartPlot}><span>10s</span><span>5s</span><span>0s</span><Sparkline /></div>
      <div className={styles.chartDates}><span>Aug 11</span><span>13</span><span>15</span><span>17</span><span>19</span><span>21</span><span>23</span><span>24</span></div>
    </div>
  );
}

function ProjectRunTable() {
  return (
    <section className={styles.runTableSection}>
      <h2>Recent runs</h2>
      <div className={styles.runTable}>
        <div className={`${styles.runRow} ${styles.runHead}`}><span>STATUS</span><span>BUILD</span><span>COMMIT</span><span>BRANCH</span><span>TESTS</span><span>DURATION</span><span>COVERAGE</span><span>COMPLETED⌄</span><span /></div>
        {projectRuns.map((run, index) => <div className={`${styles.runRow} ${index === 0 ? styles.runSelected : ''}`} key={run[0]}>
          <span><Status>PASSED</Status></span><a>{run[0]}</a><code>{run[1]}&nbsp; ▣</code><span>{run[2]}</span><span>{run[3]}</span><span>{run[4]}</span><span>{run[5]}</span><span>{run[6]}</span><b>›</b>
        </div>)}
      </div>
      <footer className={styles.tableFooter}><span>Showing 1–4 of 4 runs</span><span><Dot /> Auto-refresh&nbsp;&nbsp; <button>10s⌄</button></span><span>‹&nbsp;&nbsp; <b>1</b>&nbsp;&nbsp; ›</span></footer>
    </section>
  );
}

function RunInspector() {
  return (
    <aside className={styles.runInspector}>
      <header><h2>Run #53</h2><span>×</span></header>
      <div className={styles.inspectorChart}><small>DURATION HISTORY</small><div className={styles.inspectorPlot}><span>10s<br /><br />5s<br /><br />0s</span><Sparkline /></div><div className={styles.inspectorDates}>Aug 11&nbsp;&nbsp;&nbsp;13&nbsp;&nbsp;&nbsp;15&nbsp;&nbsp;&nbsp;17&nbsp;&nbsp;&nbsp;19&nbsp;&nbsp;&nbsp;21&nbsp;&nbsp;&nbsp;23&nbsp;&nbsp;24</div></div>
      <dl className={styles.detailList}>{[['Status', <Status key="status">PASSED</Status>], ['Build', <a key="build">#53</a>], ['Commit', <code key="commit">5a932fa&nbsp; ▣</code>], ['Branch', '⑂  master'], ['Trigger', 'push'], ['Started', 'Aug 24, 2026, 2:59:00 PM'], ['Duration', '6.4s'], ['Tests', '2 / 2 passed'], ['Coverage', 'n/a']].flatMap(([key, value]) => [<dt key={`${key}-dt`}>{key}</dt>, <dd key={`${key}-dd`}>{value}</dd>])}</dl>
      <InspectorGroup title="PUBLISHED DATA"><div className={styles.inspectorLink}><span>◉&nbsp; tests</span><b>›</b></div><div className={styles.inspectorLink}><span>◉&nbsp; performance</span><b>›</b></div></InspectorGroup>
      <InspectorGroup title="SUITES"><div className={styles.inspectorLink}><span>Lint</span><span>187ms&nbsp; ✓ ›</span></div><div className={styles.inspectorLink}><span>Unit Tests</span><span>6.2s&nbsp; ✓ ›</span></div></InspectorGroup>
      <InspectorGroup title="ARTIFACTS"><div className={styles.inspectorLink}><a>▱&nbsp; test-results.zip</a><span>↗</span></div><div className={styles.inspectorLink}><a>▱&nbsp; performance.json</a><span>↗</span></div></InspectorGroup>
      <div className={styles.inspectorActions}><Button primary>Open run&nbsp; ↗</Button><Button>Source run&nbsp; ↗</Button></div>
    </aside>
  );
}

function InspectorGroup({ title, children }) {
  return <section className={styles.inspectorGroup}><small>{title}</small>{children}</section>;
}

export function ProjectLedgerConcept() {
  return (
    <div className={`${styles.canvas} ${styles.projectCanvas}`}>
      <TopBar breadcrumb={<><span>Projects</span><b>/</b><strong>gulp-rev-all</strong></>} />
      <ProjectContext />
      <div className={styles.projectWorkspace}>
        <ProjectLedgerRail />
        <main className={styles.projectMain}>
          <nav className={styles.inlineTabs}><b>Runs</b><span>Coverage</span><span>Performance</span><span>Releases</span></nav>
          <div className={styles.kpiStrip}><Kpi label="PASS RATE" value="100%" tone="green" /><Kpi label="LAST RUN" value="6.4s" /><Kpi label="TESTS" value="2 / 2" /><Kpi label="COVERAGE" value="n/a" /><Kpi label="RUNS" value="4" /></div>
          <div className={styles.projectCharts}><ActivityGrid /><DurationTrend /></div>
          <ProjectRunTable />
        </main>
        <RunInspector />
      </div>
    </div>
  );
}

function RunContext({ failed = false, failure = false, coverage = false }) {
  const runNumber = coverage ? '116' : failed ? '87' : '53';
  const branch = coverage || failed ? 'main' : 'master';
  const commit = coverage ? '7ac04f2' : failed ? '8e7c3f1' : '5a932fa';
  const duration = coverage ? '15.36s' : failed ? '35.0s' : '6.4s';
  const completed = coverage ? 'Aug 25, 4:16 PM' : failed ? 'Jun 7, 12:21 PM' : 'Aug 24, 2:59 PM';
  return (
    <div className={`${styles.runContext} ${failure ? styles.failureContext : ''} ${coverage ? styles.coverageContext : ''}`}>
      <Status failed={failed}>{failed ? 'FAILED' : 'PASSED'}</Status><strong>Run <a>#{runNumber}</a></strong>
      {!failure ? <strong>{coverage ? 'workspace' : 'gulp-rev-all'}</strong> : null}
      <span className={styles.contextDivider} /><label>branch<b>{branch}</b></label><span className={styles.contextDivider} /><label>commit<a>{commit}</a></label><span className={styles.contextDivider} /><label>duration<b>{duration}</b></label><span className={styles.contextDivider} /><label>completed<b>{completed}</b></label>
      <div className={styles.contextActions}><Button>Source run&nbsp; ↗</Button><Button>Raw report&nbsp; ⇩</Button>{failure ? <span>⋮</span> : null}</div>
    </div>
  );
}

function RunTabs({ failure = false, coverage = false }) {
  const tabs = failure
    ? [['Summary'], ['Tests', '164'], ['Failures', '3'], ['Coverage', '87.9%'], ['Performance'], ['Artifacts']]
    : coverage
      ? [['Summary'], ['Tests', '196'], ['Coverage'], ['Performance'], ['Artifacts', '2'], ['Raw report']]
      : [['Summary'], ['Tests', '2'], ['Coverage'], ['Performance'], ['Artifacts', '10'], ['Raw report']];
  const activeTab = failure ? 'Failures' : coverage ? 'Coverage' : 'Tests';
  return <nav className={styles.runTabs}>{tabs.map(([name, count]) => <span className={name === activeTab ? styles.runTabActive : ''} key={name}>{name}{count ? <b>{count}</b> : null}</span>)}</nav>;
}

function SummaryBar({ failure = false, coverage = false }) {
  return (
    <div className={`${styles.summaryBar} ${failure ? styles.failureSummary : ''} ${coverage ? styles.coverageSummary : ''}`}>
      {failure
        ? <><span><b className={styles.failBox}>⊗&nbsp; 3 failed</b></span><span>☑&nbsp; 161 passed</span><span>△&nbsp; 2 flaky</span><span>◴&nbsp; 87.9% coverage</span><span>◷&nbsp; 35.0s</span><div className={styles.summaryPager}>←&nbsp;&nbsp; Previous failure <i /> Next failure&nbsp;&nbsp; →</div></>
        : coverage
          ? <><span>✓&nbsp; 196&nbsp; passed</span><span>⊗&nbsp; 0&nbsp; failed</span><span>⊖&nbsp; 0&nbsp; skipped</span><span>◇&nbsp; 1&nbsp; suite</span><span>▱&nbsp; 105&nbsp; files</span><span>◷&nbsp; 15.36s</span><div className={styles.summaryPager}><button>#115&nbsp; ‹</button><button>›&nbsp; #117</button></div></>
          : <><span>✓&nbsp; 2&nbsp; passed</span><span>⊗&nbsp; 0&nbsp; failed</span><span>⊖&nbsp; 0&nbsp; skipped</span><span>◇&nbsp; 2&nbsp; suites</span><span>◷&nbsp; 6.4s</span><span>♢&nbsp; coverage&nbsp; n/a</span><div className={styles.summaryPager}><button>#52&nbsp; ‹</button><button>›&nbsp; #54</button></div></>}
    </div>
  );
}

function SuitePane() {
  return (
    <aside className={styles.suitePane}>
      <header><h2>Suites</h2><span>⌃</span></header>
      <div className={styles.paneSearch}>⌕&nbsp; Search tests… <kbd>/</kbd></div>
      <div className={styles.filterButtons}><button className={styles.filterActive}>All&nbsp;&nbsp; 2</button><button>Failed&nbsp;&nbsp; 0</button><button>Passed&nbsp;&nbsp; 2</button></div>
      <div className={styles.treeGroup}>⌄&nbsp;&nbsp; ◇&nbsp; <strong>uncategorized</strong><span>2</span></div>
      <div className={styles.treeRow}><span><Dot /> Lint</span><span>1&nbsp;&nbsp;&nbsp;&nbsp; 187ms</span></div>
      <div className={`${styles.treeRow} ${styles.treeSelected}`}><span><Dot /> Unit Tests</span><span>1&nbsp;&nbsp;&nbsp;&nbsp; 6.2s</span></div>
      <div className={styles.paneFooter}>⚙&nbsp;&nbsp; Manage suites</div>
    </aside>
  );
}

function ExecutionTimeline() {
  return <div className={styles.executionTimeline}><header><strong>Execution timeline</strong><span>Setup&nbsp; 31ms&nbsp;&nbsp; · &nbsp;&nbsp;Test&nbsp; 6.12s&nbsp;&nbsp; · &nbsp;&nbsp;Teardown&nbsp; 49ms</span></header><div className={styles.timelineTrack}><i /><b /><em /></div><footer><span>0ms</span><span>6.40s</span></footer></div>;
}

function TestDetailPane() {
  return (
    <aside className={styles.testDetailPane}>
      <header><h2>Test details</h2><span>⌃</span></header>
      <div className={styles.testTitle}><strong>gulp-rev-all unit tests</strong><Status>PASSED</Status></div>
      <dl className={styles.testDetails}><dt>File</dt><dd><a>test/index.js:42</a></dd><dt>Duration</dt><dd>6.2s</dd><dt>Owner</dt><dd>unowned</dd><dt>Runtime</dt><dd>shell</dd></dl>
      <Accordion title="Assertions" count="12" /><Accordion title="Console" /><Accordion title="Artifacts" count="3" open>
        <Artifact name="gulp-rev-all-unit-tests-shell.log" size="34.1 KB" /><Artifact name="gulp-rev-all-unit-tests.json" size="9.3 KB" /><Artifact name="report.json" size="4.7 KB" />
      </Accordion><Accordion title="Environment" />
      <div className={styles.detailActions}><Button primary>Open artifact&nbsp; ↗</Button><Button>Copy link&nbsp; ⛓</Button></div>
    </aside>
  );
}

function Accordion({ title, count, open = false, children }) {
  return <section className={`${styles.accordion} ${open ? styles.accordionOpen : ''}`}><header><strong>{title}</strong>{count ? <b>{count}</b> : null}<span>{open ? '⌄' : '›'}</span></header>{children}</section>;
}

function Artifact({ name, size }) {
  return <div className={styles.artifact}><a>▱&nbsp; {name}</a><span>{size}</span></div>;
}

export function RunWorkbenchConcept() {
  return (
    <div className={`${styles.canvas} ${styles.runCanvas}`}>
      <TopBar breadcrumb={<><span>Projects</span><b>/</b><span>gulp-rev-all</span><b>/</b><strong>Run #53</strong></>} searchCopy="Search runs, tests, files…" />
      <RunContext /><RunTabs /><SummaryBar />
      <div className={styles.runWorkspace}>
        <SuitePane />
        <main className={styles.testPane}>
          <header className={styles.testPaneHeader}><div><h2>Unit Tests</h2><span>shell&nbsp;&nbsp;·&nbsp;&nbsp;1 test&nbsp;&nbsp;·&nbsp;&nbsp;6.2s</span></div><div><button>▽</button><button>⋮</button></div></header>
          <div className={styles.testTable}><div className={styles.testHead}><span>STATUS</span><span>TEST</span><span>FILE</span><span>DURATION</span></div><div className={styles.testSelected}><Status>PASSED</Status><span>gulp-rev-all unit tests</span><a>test/index.js:42</a><span>6.2s</span></div></div>
          <ExecutionTimeline />
        </main>
        <TestDetailPane />
      </div>
    </div>
  );
}

const coverageFiles = [
  ['packages/web/pages/_app.js', '14/14', '71.4%', '48.6%', '82.1%', '43–57, 212–219', 'web-platform', 'lime'],
  ['packages/server/graphql/query-service.js', '18/18', '62.1%', '41.7%', '76.5%', '88–103, 256–278', 'backend-team', 'red'],
  ['packages/core/src/report.js', '12/12', '63.2%', '52.3%', '85.7%', '31–44, 97–119', 'core-team', 'red'],
  ['packages/web/components/BenchmarkBits.js', '10/10', '66.7%', '53.1%', '78.9%', '120–135, 198–210', 'web-platform', 'lime'],
  ['packages/server/ingest/service.js', '16/16', '68.3%', '57.1%', '80.0%', '72–93, 201–226', 'backend-team', 'lime'],
  ['packages/web/lib/serverGraphql.js', '8/8', '69.2%', '55.6%', '81.3%', '44–60, 149–168', 'web-platform', 'lime'],
  ['packages/core/src/adapters.js', '9/9', '70.0%', '58.3%', '83.3%', '26–37, 101–118', 'core-team', 'lime'],
  ['packages/web/components/CoverageTrendPanel.js', '7/7', '72.4%', '60.0%', '86.7%', '64–75, 142–160', 'web-platform', 'lime'],
  ['packages/server/requestTrace.js', '11/11', '73.1%', '60.9%', '84.2%', '55–72, 131–152', 'backend-team', 'lime'],
  ['packages/cli/src/run.js', '6/6', '74.5%', '61.5%', '88.9%', '33–48, 110–129', 'tools-team', 'lime'],
];

function CoverageBar({ value, tone = 'green', compact = false }) {
  const numeric = Number.parseFloat(value) || 0;
  return <i className={`${styles.coverageBar} ${styles[`coverageBar_${tone}`]} ${compact ? styles.coverageBarCompact : ''}`}><b style={{ width: `${Math.min(100, numeric)}%` }} /></i>;
}

function CoverageMetric({ label, value, count, tone = 'green' }) {
  return <div className={styles.coverageMetric}><small>{label}</small><div><strong>{value}</strong><span>{count}</span></div><CoverageBar value={value} tone={tone} /></div>;
}

function CoverageScopePane() {
  const scopes = [['⌄', 'workspace', '105'], ['›', 'packages', '105'], ['›', 'web', '34'], ['›', 'server', '41'], ['›', 'core', '18'], ['›', 'adapters', '12']];
  return (
    <aside className={styles.coverageScopes}>
      <h2>Coverage scopes</h2>
      <div className={styles.paneSearch}>⌕&nbsp; Search files…</div>
      <div className={styles.coverageFilters}><button className={styles.filterActive}>All&nbsp;&nbsp; 105</button><button>Below 80%&nbsp;&nbsp; 18</button><button>Uncovered&nbsp;&nbsp; 4</button></div>
      <div className={styles.coverageTree}>{scopes.map(([arrow, label, count], index) => <div className={index === 0 ? styles.coverageTreeSelected : ''} key={label}><span>{arrow}&nbsp;&nbsp; ◇&nbsp;&nbsp; <strong>{label}</strong></span><b>{count}</b></div>)}</div>
      <div className={styles.coverageLegend}><span><Dot /> ≥ 80%</span><span><Dot tone="amber" /> 60–79%</span><span><Dot tone="red" /> &lt; 60%</span></div>
      <div className={styles.coverageSettings}>⚙&nbsp;&nbsp; Coverage settings</div>
    </aside>
  );
}

function CoverageTrend() {
  return (
    <section className={styles.coverageTrend}>
      <header><strong>Coverage trend</strong><b>87.6%</b></header>
      <div className={styles.coverageTrendPlot}><span>100%<br /><br />80%<br /><br />60%<br /><br />40%</span><svg viewBox="0 0 320 82" preserveAspectRatio="none" aria-hidden="true"><path d="M0 67H320M0 45H320M0 23H320" /><polyline points="2,58 24,52 45,39 66,27 88,22 110,26 132,27 154,23 176,22 198,18 220,23 242,19 264,24 286,8 306,17 319,14" />{[[2,58],[66,27],[132,27],[198,18],[264,24],[319,14]].map(([x,y]) => <circle key={x} cx={x} cy={y} r="2.5" />)}</svg></div>
      <footer><span>14</span><span>11</span><span>8</span><span>5</span><span>2</span><span>Now</span></footer>
    </section>
  );
}

function TestOutcomeBand() {
  return <section className={styles.testOutcomeBand}><header><strong>Test outcomes</strong></header><div className={styles.outcomeTrack}><i /></div><footer><span><Dot /> 196 passed</span><span><Dot tone="red" /> 0 failed</span><span><Dot tone="amber" /> 0 skipped</span><b>15.36s</b></footer></section>;
}

function CoverageFileTable() {
  return (
    <section className={styles.coverageFileSection}>
      <header><div><h2>Coverage by file</h2><span>105 files&nbsp; · &nbsp;lowest line coverage first</span></div><div><button>▽</button><button>Lines⌄</button><button>⋮</button></div></header>
      <div className={styles.coverageFileTable}>
        <div className={`${styles.coverageFileRow} ${styles.coverageFileHead}`}><span>FILE</span><span>TESTS</span><span>LINES</span><span>BRANCHES</span><span>FUNCTIONS</span><span>UNCOVERED</span><span>OWNER</span></div>
        {coverageFiles.map((file, index) => <div className={`${styles.coverageFileRow} ${index === 0 ? styles.coverageFileSelected : ''}`} key={file[0]}>
          <span>{index === 0 ? '› ' : ''}{file[0]}</span><b>{file[1]}</b><span>{file[2]}<CoverageBar value={file[2]} tone={file[7]} compact /></span><span>{file[3]}<CoverageBar value={file[3]} tone="red" compact /></span><span>{file[4]}<CoverageBar value={file[4]} compact /></span><span>{file[5]}</span><span>{file[6]}</span>
        </div>)}
      </div>
      <footer className={styles.coverageTableFooter}><span>Showing 1–50 of 105 files</span><span><Dot /> Auto-refresh every 10s&nbsp;&nbsp; ⟳</span><span><button>‹&nbsp; Prev</button><b>1</b><button>2</button><button>3</button><button>Next&nbsp; ›</button></span></footer>
    </section>
  );
}

function FileCoveragePane() {
  return (
    <aside className={styles.fileCoveragePane}>
      <header><h2>File coverage</h2><span>⌃</span></header>
      <div className={styles.fileCoverageTitle}><strong>packages/web/pages/_app.js</strong><b>71.4% lines</b></div>
      <dl className={styles.fileCoverageMeta}><dt>Owner</dt><dd>web-platform</dd><dt>Tests</dt><dd className={styles.green}>14 passed</dd><dt>Last changed</dt><dd>2 runs ago</dd><dt>Risk</dt><dd>●&nbsp; medium</dd></dl>
      <section className={styles.fileCoverageGroup}><header><strong>Coverage</strong><span>⌃</span></header>{[['Lines','71.4%','145/203','lime'],['Branches','48.6%','34/70','red'],['Functions','82.1%','23/28','green'],['Statements','n/a','n/a','muted']].map(([label,value,count,tone]) => <div className={styles.fileCoverageMeasure} key={label}><span>{label}</span><b>{value}</b><CoverageBar value={value} tone={tone} /><small>{count}</small></div>)}</section>
      <section className={styles.fileCoverageGroup}><header><strong>Uncovered ranges</strong><b>2</b><span>⌃</span></header>{[['43–57','54'],['212–219','63']].map(([range,width]) => <div className={styles.uncoveredRange} key={range}><strong>{range}</strong><i><b style={{ width: `${width}%` }} /></i><button>Open source&nbsp; ↗</button></div>)}</section>
      <section className={styles.fileCoverageGroup}><header><strong>Related tests</strong><b>3</b><span>⌃</span></header>{['renders shell without hydration drift','preserves route profiling marks','loads runtime config'].map(test => <div className={styles.relatedTest} key={test}>✓&nbsp;&nbsp; {test}</div>)}</section>
      <div className={styles.fileCoverageActions}><Button primary>Open source&nbsp; ↗</Button><Button>Copy path&nbsp; ▱</Button></div>
    </aside>
  );
}

export function CoverageWorkbenchConcept() {
  return (
    <div className={`${styles.canvas} ${styles.runCanvas} ${styles.coverageCanvas}`}>
      <TopBar breadcrumb={<><span>Projects</span><b>/</b><span>workspace</span><b>/</b><strong>Run #116</strong></>} searchCopy="Search runs, tests, files…" />
      <RunContext coverage /><RunTabs coverage /><SummaryBar coverage />
      <div className={styles.coverageWorkspace}>
        <CoverageScopePane />
        <main className={styles.coverageMain}>
          <div className={styles.coverageMetrics}><CoverageMetric label="LINES" value="87.6%" count="22612/25814" /><CoverageMetric label="BRANCHES" value="59.3%" count="3481/5874" tone="lime" /><CoverageMetric label="FUNCTIONS" value="88.9%" count="1608/1808" /><CoverageMetric label="STATEMENTS" value="n/a" count="n/a" tone="muted" /></div>
          <div className={styles.coverageAnalysis}><CoverageTrend /><TestOutcomeBand /></div>
          <CoverageFileTable />
        </main>
        <FileCoveragePane />
      </div>
    </div>
  );
}

function FailureList() {
  const failures = [['should calculate flakiness score', 'self-test  ·  test/flakiness.spec.ts:42', '129ms'], ['retries timed-out worker', 'self-test  ·  test/worker.spec.ts:118', '213ms'], ['preserves coverage threshold', 'self-test  ·  test/coverage.spec.ts:77', '97ms']];
  return (
    <aside className={styles.failureList}>
      <header><h2>Failures <span>3</span></h2></header>
      <div className={styles.paneSearch}>⌕&nbsp; Search failures… <kbd>/</kbd></div>
      <div className={styles.groupToggle}><b>By suite</b><span>By file</span></div>
      {failures.map((failure, index) => <div className={`${styles.failureRow} ${index === 0 ? styles.failureRowSelected : ''}`} key={failure[0]}><Dot tone="red" /><div><strong>{failure[0]}</strong><span>{failure[1]}</span></div><time>{failure[2]}</time></div>)}
      <div className={styles.passingDisclosure}><Dot /> <span>161 passing tests</span><b>⌄</b></div>
    </aside>
  );
}

const sourceLines = [
  [38, "it('should calculate flakiness score', async () => {"],
  [39, "  const runs = await getRecentRuns('self-test')"],
  [40, '  const score = calculateFlakiness(runs)'],
  [41, ''],
  [42, '  expect(score).toBeLessThan(0.1)'],
  [43, '})'],
  [44, ''],
  [45, 'function calculateFlakiness(runs: Run[]): number {'],
  [46, '  // ...'],
  [47, '}'],
];

function SourcePanel() {
  return (
    <div className={styles.sourcePanel}>
      <header><span>test/flakiness.spec.ts</span><b>TS</b></header>
      <div className={styles.codeLines}>{sourceLines.map(([number, line]) => <div className={number === 42 ? styles.codeFailed : ''} key={number}><span>{number}</span><code>{line || ' '}</code></div>)}</div>
    </div>
  );
}

function StackConsole() {
  return <div className={styles.stackConsole}><section><header>Stack trace <b>3</b></header><div className={styles.stackActive}><b>1</b><span>Context.&lt;anonymous&gt;<small>test/flakiness.spec.ts:42:28</small></span></div><div><b>2</b><span>processTicksAndRejections<small>node:internal/process/task_queues:96:5</small></span></div><div><b>3</b><span>runSuite<small>src/runner/suite.ts:128:7</small></span></div></section><section className={styles.console}><header>Console output <a>View full log</a></header>{[
    ['12:21:18.231', 'info', 'Starting test: should calculate flakiness score'], ['12:21:18.235', 'debug', 'Loaded 247 recent runs'], ['12:21:18.237', 'debug', 'Calculated flakiness score: 0.12'], ['12:21:18.238', 'error', 'AssertionError: expected 0.12 to be below 0.1'], ['12:21:18.239', 'info', 'Retrying attempt 2 of 3'], ['12:21:18.365', 'debug', 'Calculated flakiness score: 0.11'], ['12:21:18.366', 'error', 'AssertionError: expected 0.11 to be below 0.1'], ['12:21:18.367', 'info', 'Retrying attempt 3 of 3'], ['12:21:18.492', 'debug', 'Calculated flakiness score: 0.12'], ['12:21:18.493', 'error', 'AssertionError: expected 0.12 to be below 0.1']
  ].map((entry, index) => <code className={entry[1] === 'error' ? styles.consoleError : ''} key={index}><span>{entry[0]}</span><i>{entry[1]}</i>{entry[2]}</code>)}</section></div>;
}

function FailureEvidence() {
  return (
    <aside className={styles.failureEvidence}>
      <h2>Failure evidence</h2>
      <Accordion title="Reproduction" open><p>Run this command to reproduce locally:</p><pre>yarn test flakiness.spec.ts -t 'should<br />calculate flakiness score'<b>▣</b></pre></Accordion>
      <Accordion title="Artifacts" count="4" open><Artifact name="trace.zip" size="3.2 MB ↓" /><Artifact name="failure.png" size="412 KB ↓" /><Artifact name="junit.xml" size="18 KB ↓" /><Artifact name="raw.log" size="128 KB ↓" /></Accordion>
      <Accordion title="History" open><p>Failed 2 of last 10 runs</p><Sparkline red /><a className={styles.olderHistory}>Older history&nbsp; ↗</a></Accordion>
      <Accordion title="Ownership" open><p>Team</p><a>♧&nbsp; quality-platform</a><p>Assignee</p><span>◯&nbsp; Unassigned&nbsp;&nbsp; ✎</span></Accordion>
      <div className={styles.evidenceActions}><Button primary wide>▣&nbsp; Copy reproduction&nbsp; ⧉</Button><div><Button>Open logs&nbsp; ↗</Button><Button>Create issue&nbsp; ↗</Button></div></div>
    </aside>
  );
}

export function FailureTriageConcept() {
  return (
    <div className={`${styles.canvas} ${styles.failureCanvas}`}>
      <TopBar breadcrumb={<><strong>test-station self-test</strong><b>/</b><span>Run <a>#87</a></span><b>/</b><strong>Failures</strong></>} />
      <RunContext failed failure /><RunTabs failure /><SummaryBar failure />
      <div className={styles.failureWorkspace}>
        <FailureList />
        <main className={styles.failureMain}>
          <header><div><h2>should calculate flakiness score</h2><span>self-test&nbsp; · &nbsp;test/flakiness.spec.ts:42:28&nbsp; · &nbsp;129ms&nbsp; · &nbsp;attempt 3 of 3</span></div><div>▣&nbsp;&nbsp; ♧&nbsp;&nbsp; ⋮</div></header>
          <div className={styles.errorBanner}>AssertionError: <b>expected 0.12 to be below 0.1</b></div>
          <SourcePanel /><StackConsole />
        </main>
        <FailureEvidence />
      </div>
    </div>
  );
}
