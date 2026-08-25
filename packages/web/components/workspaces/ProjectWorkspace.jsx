import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ProjectBenchmarkExplorer } from '../BenchmarkBits.js';
import { useBffResource } from '../../hooks/useBffResource.js';
import { buildOperationsSummary, resolveRunPresentation } from '../../lib/operationsOverview.js';
import { parseProjectWorkspaceState } from '../../lib/workspaceRouting.js';
import {
  formatDate, formatDuration, formatNumber, formatPct, parseWorkspaceDate, ResourceState, RunLink,
  StatusPill, styles, SummaryStrip, WorkspaceTabs,
} from './WorkspacePrimitives.jsx';

function useProjectRouteState() {
  const router = useRouter();
  const state = parseProjectWorkspaceState(router.query);
  const update = React.useCallback((changes) => {
    const query = { ...router.query, ...changes };
    for (const [key, value] of Object.entries(query)) if (value === null || value === '') delete query[key];
    void router.push({ pathname: router.pathname, query }, undefined, { shallow: true });
  }, [router]);
  return [state, update];
}

export function ProjectWorkspace({ initialData }) {
  const slug = initialData?.project?.slug;
  const [state, update] = useProjectRouteState();
  const workspace = useBffResource(slug ? `/api/projects/${encodeURIComponent(slug)}/workspace` : null, {
    initialData: initialData?.runs?.length ? initialData : null,
  });
  const data = workspace.data || initialData;
  const project = data?.project;
  const runParams = new URLSearchParams();
  if (state.branch) runParams.set('branch', state.branch);
  if (state.status) runParams.set('status', state.status);
  if (state.search) runParams.set('search', state.search);
  if (state.after) runParams.set('after', state.after);
  const runPage = useBffResource(slug ? `/api/projects/${encodeURIComponent(slug)}/runs?${runParams}` : null);
  const visibleRuns = runPage.data?.runs || [];
  const selectedRun = visibleRuns.find((run) => run.id === state.inspectRun) || null;
  const summary = buildOperationsSummary(runsWithinDays(visibleRuns, 14));

  React.useEffect(() => {
    if (typeof performance !== 'undefined' && project) performance.mark('project-workspace-shell-ready');
  }, [project]);

  if (!project) return <div className={styles.state}>Project unavailable.</div>;
  return <section className={styles.workspace} data-perf-id="project-workspace">
    <header className={styles.context}>
      <div><div className={styles.crumb}><Link href="/">Projects</Link> / {project.slug}</div><h1>{project.name}</h1></div>
      <StatusPill status={project.latestStatus || visibleRuns[0]?.status || 'unknown'} />
      <div className={styles.contextMeta}>
        <span>default branch<b>{project.defaultBranch || 'n/a'}</b></span>
        <span>repository<b>{repositoryLabel(project.repositoryUrl)}</b></span>
        <span>visible runs<b>{formatNumber(project.runCount ?? visibleRuns.length)}</b></span>
      </div>
      <div className={styles.actions}>{project.repositoryUrl ? <a className={styles.button} href={project.repositoryUrl} target="_blank" rel="noreferrer">Open source ↗</a> : null}</div>
    </header>
    <WorkspaceTabs active={state.view} onChange={(view) => update({ view, inspectRun: null })} items={[
      { value: 'runs', label: 'Runs', count: project.runCount },
      { value: 'coverage', label: 'Coverage' },
      { value: 'performance', label: 'Performance' },
    ]} />
    <SummaryStrip items={[
      { label: 'Pass rate (14d)', value: summary.passRate === null ? 'n/a' : formatPct(summary.passRate) },
      { label: 'Last run', value: formatDuration(visibleRuns[0]?.durationMs) },
      { label: 'Tests', value: visibleRuns[0]?.summary ? `${formatNumber(visibleRuns[0].summary.passedTests)} / ${formatNumber(visibleRuns[0].summary.totalTests)}` : 'n/a' },
      { label: 'Coverage', value: formatPct(visibleRuns[0]?.coverageSnapshot?.linesPct) },
      { label: 'Runs in feed', value: formatNumber(visibleRuns.length) },
      { label: 'Failures', value: formatNumber(summary.failed) },
    ]} />
    <ResourceState resource={workspace} label="project workspace">
      <div className={styles.projectGrid}>
        <aside className={styles.rail}>
          <h2 className={styles.railTitle}>Project scope</h2>
          <div className={styles.railNav}>{['runs','coverage','performance'].map((view) => <button key={view} className={`${styles.railButton} ${state.view === view ? styles.selected : ''}`} onClick={() => update({ view })}>{view[0].toUpperCase() + view.slice(1)}</button>)}</div>
          <div className={styles.filters}>
            <label className={styles.muted}>Branch<select className={styles.select} value={state.branch || ''} onChange={(event) => update({ branch:event.target.value || null, after:null })}><option value="">All branches</option>{(data?.branches || []).map((branch) => <option key={branch}>{branch}</option>)}</select></label>
            <label className={styles.muted}>Status<select className={styles.select} value={state.status || ''} onChange={(event) => update({ status:event.target.value || null, after:null })}><option value="">All states</option><option>failed</option><option>passed</option><option>benchmark</option><option>coverage</option></select></label>
            <label className={styles.muted}>Search<input className={styles.input} value={state.search || ''} onChange={(event) => update({ search:event.target.value || null, after:null })} placeholder="Run, branch, commit" /></label>
          </div>
        </aside>
        <main className={styles.main}>
          {state.view === 'runs' ? <ResourceState resource={runPage} label="project runs"><RunsView runs={visibleRuns} selectedRunId={state.inspectRun} select={(id) => update({ inspectRun:id })} page={runPage.data} next={(after) => update({ after, inspectRun:null })} /></ResourceState> : null}
          {state.view === 'coverage' ? <CoverageHistory data={data} /> : null}
          {state.view === 'performance' ? <ProjectPerformance slug={slug} projectKey={project.key} /> : null}
        </main>
        {selectedRun ? <RunInspector run={selectedRun} close={() => update({ inspectRun:null })} /> : <aside className={styles.inspector}><div className={styles.state}>Select a run to inspect its exact published facts.</div></aside>}
      </div>
    </ResourceState>
  </section>;
}

function repositoryLabel(value) {
  if (!value) return 'n/a';
  try { return new URL(value).pathname.replace(/^\//, '') || new URL(value).host; }
  catch { return String(value); }
}

function RunsView({ runs, selectedRunId, select, page, next }) {
  React.useEffect(() => { if (typeof performance !== 'undefined') performance.mark('project-run-feed-ready'); }, [runs]);
  return <div className={styles.panel}><div className={styles.panelHeader}><h2>Recent runs</h2><span className={styles.muted}>{runs.length} loaded</span></div><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Status</th><th>Build</th><th>Commit</th><th>Branch</th><th>Tests</th><th>Duration</th><th>Coverage</th><th>Completed</th></tr></thead><tbody>{runs.map((run) => {
    const presentation = resolveRunPresentation(run);
    return <tr key={run.id} role="button" tabIndex="0" aria-selected={selectedRunId === run.id} onClick={() => select(run.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(run.id); } }}>
      <td><StatusPill status={presentation.status} label={presentation.label} /></td><td><RunLink runId={run.id}>#{run.projectVersion?.buildNumber ?? run.sourceRunId ?? '—'}</RunLink></td><td className={styles.mono}>{run.commitSha?.slice(0,7) || 'n/a'}</td><td>{run.branch || 'n/a'}</td><td>{run.summary ? `${formatNumber(run.summary.passedTests)} / ${formatNumber(run.summary.totalTests)}` : 'n/a'}</td><td>{formatDuration(run.durationMs)}</td><td>{formatPct(run.coverageSnapshot?.linesPct)}</td><td>{formatDate(run.completedAt)}</td>
    </tr>;
  })}</tbody></table></div>{runs.length === 0 ? <div className={styles.state}>No runs match these filters.</div> : null}<div className={styles.footer}><span>{runs.length} runs loaded</span>{page?.hasMoreRuns ? <button className={styles.button} onClick={() => next(page.nextCursor)}>Next page</button> : null}</div></div>;
}

function CoverageHistory({ data }) {
  const points = data?.coverageTrend || [];
  return <><div className={styles.panel}><div className={styles.panelHeader}><h2>Coverage history</h2><span className={styles.muted}>Active coverage publications</span></div><div className={styles.bars}>{points.slice().reverse().map((point) => <div key={point.runId} title={`${point.externalKey}: ${formatPct(point.linesPct)}`} className={styles.bar} style={{ height:`${Math.max(2, Math.min(100, Number(point.linesPct) || 0))}%` }} />)}</div></div><div className={styles.panel}><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Run</th><th>Lines</th><th>Branches</th><th>Functions</th><th>Statements</th><th>Completed</th></tr></thead><tbody>{points.map((point) => <tr key={point.runId}><td><RunLink runId={point.runId}>{point.externalKey}</RunLink></td><td>{formatPct(point.linesPct)}</td><td>{formatPct(point.branchesPct)}</td><td>{formatPct(point.functionsPct)}</td><td>{formatPct(point.statementsPct)}</td><td>{formatDate(point.completedAt)}</td></tr>)}</tbody></table></div></div></>;
}

function ProjectPerformance({ slug, projectKey }) {
  const resource = useBffResource(slug ? `/api/projects/${encodeURIComponent(slug)}/benchmark?mode=overview` : null);
  return <ResourceState resource={resource} label="performance summary">{resource.data ? <ProjectBenchmarkExplorer projectKey={projectKey} benchmarkCatalog={resource.data.benchmarkCatalog || []} benchmarkSummary={resource.data.benchmarkSummary || null} benchmarkPanels={resource.data.benchmarkPanels || []} /> : null}</ResourceState>;
}

function RunInspector({ run, close }) {
  const presentation = resolveRunPresentation(run);
  return <aside className={styles.inspector} aria-label="Run inspector"><div className={styles.panelHeader}><h2>{run.externalKey}</h2><button className={styles.button} onClick={close} aria-label="Close run inspector">×</button></div><dl className={styles.detailList}>
    <dt>Status</dt><dd><StatusPill status={presentation.status} label={presentation.label} /></dd><dt>Commit</dt><dd className={styles.mono}>{run.commitSha || 'n/a'}</dd><dt>Branch</dt><dd>{run.branch || 'n/a'}</dd><dt>Completed</dt><dd>{formatDate(run.completedAt)}</dd><dt>Duration</dt><dd>{formatDuration(run.durationMs)}</dd><dt>Tests</dt><dd>{run.summary ? `${formatNumber(run.summary.passedTests)} passed / ${formatNumber(run.summary.totalTests)} total` : 'n/a'}</dd><dt>Coverage</dt><dd>{formatPct(run.coverageSnapshot?.linesPct)}</dd>
  </dl><div className={styles.actions}><RunLink runId={run.id} className={`${styles.button} ${styles.primary}`}>Open run →</RunLink>{run.sourceUrl ? <a className={styles.button} href={run.sourceUrl} target="_blank" rel="noreferrer">Source run ↗</a> : null}</div></aside>;
}

function runsWithinDays(runs, days) {
  const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
  return runs.filter((run) => {
    const completed = parseWorkspaceDate(run.completedAt || run.startedAt).getTime();
    return Number.isFinite(completed) && completed >= cutoff;
  });
}
