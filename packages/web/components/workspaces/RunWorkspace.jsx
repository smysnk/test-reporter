import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useBffResource, prefetchBffResource } from '../../hooks/useBffResource.js';
import { parseRunWorkspaceState } from '../../lib/workspaceRouting.js';
import {
  formatDate, formatDuration, formatNumber, formatPct, ResourceState,
  StatusPill, styles, SummaryStrip, WorkspaceTabs,
} from './WorkspacePrimitives.jsx';

const VIEW_LABELS = { summary:'Summary', tests:'Tests', failures:'Failures', coverage:'Coverage', performance:'Performance', artifacts:'Artifacts', report:'Runner report' };

function useRunRouteState(presentation) {
  const router = useRouter();
  const state = parseRunWorkspaceState(router.query, presentation);
  const update = React.useCallback((changes) => {
    const query = { ...router.query, ...changes };
    delete query.template;
    for (const [key, value] of Object.entries(query)) if (value === null || value === '') delete query[key];
    void router.push({ pathname: router.pathname, query }, undefined, { shallow:true });
  }, [router]);
  React.useEffect(() => {
    if (router.isReady && state.redirected) update({ view:state.view });
  }, [router.isReady, state.redirected, state.view, update]);
  return [state, update];
}

export function RunWorkspace({ initialData }) {
  const runId = initialData?.run?.id;
  const shell = useBffResource(runId ? `/api/runs/${encodeURIComponent(runId)}/workspace` : null, { initialData });
  const data = shell.data || initialData;
  const run = data?.run;
  const presentation = data?.presentation || initialData?.presentation;
  const [state, update] = useRunRouteState(presentation);

  React.useEffect(() => {
    if (typeof performance !== 'undefined' && run) performance.mark('run-workspace-shell-ready');
  }, [run]);
  React.useEffect(() => {
    if (!data?.transient || !shell.error) return undefined;
    const retry = setTimeout(shell.retry, 1000);
    return () => clearTimeout(retry);
  }, [data?.transient, shell.error, shell.retry]);
  React.useEffect(() => {
    const projectSlug = run?.project?.slug;
    if (!projectSlug) return;
    const encodedSlug = encodeURIComponent(projectSlug);
    prefetchBffResource(`/api/projects/${encodedSlug}/workspace`);
    prefetchBffResource(`/api/projects/${encodedSlug}/runs?`);
  }, [run?.project?.slug]);
  if (!run || !presentation) return <div className={styles.state}>Run unavailable.</div>;
  const summary = run.summary || {};
  const tabItems = presentation.availableViews.map((view) => ({
    value:view, label:VIEW_LABELS[view],
    count:view === 'tests' ? summary.totalTests : view === 'failures' ? summary.failedTests : view === 'artifacts' ? run.artifacts?.length : null,
  }));
  return <section className={styles.workspace} data-perf-id="run-workspace">
    <header className={styles.context}>
      <div><div className={styles.crumb}><Link href="/">Projects</Link> / <Link href={`/projects/${run.project?.slug}`}>{run.project?.name || 'Project'}</Link> / Run</div><h1>{run.externalKey}</h1></div>
      <StatusPill status={presentation.overallStatus} />
      <div className={styles.contextMeta}><span>branch<b>{run.branch || 'n/a'}</b></span><span>commit<b className={styles.mono}>{run.commitSha?.slice(0,10) || 'n/a'}</b></span><span>duration<b>{formatDuration(run.durationMs)}</b></span><span>completed<b>{formatDate(run.completedAt)}</b></span></div>
      <div className={styles.actions}>{run.sourceUrl ? <a className={styles.button} href={run.sourceUrl} target="_blank" rel="noreferrer">Source run ↗</a> : null}<button className={styles.button} onClick={() => update({ view:'report' })}>Runner report</button></div>
    </header>
    {state.redirected ? <div className={styles.notice} role="status">That view has no published data for this run. Showing {VIEW_LABELS[state.view]}.</div> : null}
    <WorkspaceTabs items={tabItems} active={state.view} onChange={(view) => update({ view, test:null, failure:null, file:null, after:null })} />
    <SummaryStrip items={[
      { label:'Passed', value:formatNumber(summary.passedTests) }, { label:'Failed', value:formatNumber(summary.failedTests) },
      { label:'Skipped', value:formatNumber(summary.skippedTests) }, { label:'Suites', value:formatNumber(run.suites?.length) },
      { label:'Coverage', value:formatPct(run.coverageSnapshot?.linesPct) }, { label:'Duration', value:formatDuration(run.durationMs) },
    ]} />
    {data?.degraded ? <div className={styles.notice} role="status">{data?.transient ? 'This run is being refreshed. Retrying detailed data automatically.' : 'Showing the run shell while detailed data refreshes.'}</div> : null}
    <ResourceState resource={shell} label="run workspace">
      {state.view === 'summary' ? <SummaryMode run={run} presentation={presentation} update={update} /> : null}
      {state.view === 'tests' ? <TestsMode run={run} state={state} update={update} /> : null}
      {state.view === 'failures' ? <FailuresMode run={run} state={state} update={update} /> : null}
      {state.view === 'coverage' ? <CoverageMode run={run} state={state} update={update} /> : null}
      {state.view === 'performance' ? <PerformanceMode run={run} /> : null}
      {state.view === 'artifacts' ? <ArtifactsMode run={run} state={state} update={update} /> : null}
      {state.view === 'report' ? <RunnerReportMode run={run} /> : null}
    </ResourceState>
  </section>;
}

function SummaryMode({ run, presentation, update }) {
  return <main className={styles.main}><div className={styles.charts}>
    <section className={styles.panel}><div className={styles.panelHeader}><h2>Published data</h2></div><div className={styles.list}>{presentation.availableViews.filter((view) => view !== 'summary').map((view) => <button className={styles.listRow} key={view} onClick={() => update({ view })}><span>◉</span><span>{VIEW_LABELS[view]}<small>{view === 'coverage' ? formatPct(run.coverageSnapshot?.linesPct) : `${formatNumber(view === 'tests' ? run.summary?.totalTests : view === 'failures' ? run.summary?.failedTests : view === 'artifacts' ? run.artifacts?.length : null)} available`}</small></span><b>›</b></button>)}</div></section>
    <section className={styles.panel}><div className={styles.panelHeader}><h2>Run facts</h2></div><dl className={styles.detailList}><dt>Provider</dt><dd>{run.sourceProvider || 'n/a'}</dd><dt>Trigger</dt><dd>{run.triggeredBy || 'n/a'}</dd><dt>Version</dt><dd>{run.projectVersion?.versionKey || 'n/a'}</dd><dt>Build</dt><dd>{run.projectVersion?.buildNumber ?? run.sourceRunId ?? 'n/a'}</dd><dt>Started</dt><dd>{formatDate(run.startedAt)}</dd><dt>Completed</dt><dd>{formatDate(run.completedAt)}</dd></dl></section>
  </div><SuitesTable suites={run.suites || []} open={(suite) => update({ view:'tests', suite:suite.id })} /></main>;
}

function SuitesTable({ suites, open }) {
  return <section className={styles.panel}><div className={styles.panelHeader}><h2>Suites</h2><span className={styles.muted}>{suites.length}</span></div><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Status</th><th>Suite</th><th>Package</th><th>Runtime</th><th>Tests</th><th>Duration</th></tr></thead><tbody>{suites.map((suite) => <tr key={suite.id} role="button" tabIndex="0" onClick={() => open(suite)} onKeyDown={(event) => { if (event.key === 'Enter') open(suite); }}><td><StatusPill status={suite.status} /></td><td>{suite.label}</td><td>{suite.packageName || 'n/a'}</td><td>{suite.runtime || 'n/a'}</td><td>{formatNumber(suiteTotal(suite))}</td><td>{formatDuration(suite.durationMs)}</td></tr>)}</tbody></table></div></section>;
}

function TestsMode({ run, state, update }) {
  const suite = run.suites?.find((entry) => entry.id === state.suite) || run.suites?.[0] || null;
  const params = new URLSearchParams({ suiteRunId:suite?.id || '' });
  if (state.status) params.set('status', state.status);
  if (state.search) params.set('search', state.search);
  if (state.after) params.set('after', state.after);
  const page = useBffResource(suite ? `/api/runs/${encodeURIComponent(run.id)}/suite-tests?${params}` : null);
  const selected = state.test ? { id:state.test } : page.data?.tests?.[0] || null;
  const detail = useBffResource(selected ? `/api/runs/${encodeURIComponent(run.id)}/tests/${encodeURIComponent(selected.id)}` : null, { enabled:Boolean(selected) });
  React.useEffect(() => { if (page.data && typeof performance !== 'undefined') performance.mark('run-tests-ready'); }, [page.data]);
  React.useEffect(() => { if (!state.test && page.data?.tests?.[0]?.id) update({ test:page.data.tests[0].id }); }, [page.data, state.test, update]);
  return <div className={styles.runGrid}>
    <aside className={styles.rail}><h2 className={styles.railTitle}>Suites</h2><div className={styles.filters}><input className={styles.input} placeholder="Search tests" value={state.search || ''} onChange={(event) => update({ search:event.target.value || null, after:null })} /><select className={styles.select} value={state.status || ''} onChange={(event) => update({ status:event.target.value || null, after:null })}><option value="">All tests</option><option>failed</option><option>passed</option><option>skipped</option></select></div><div className={styles.list}>{(run.suites || []).map((entry) => <button key={entry.id} className={`${styles.listRow} ${suite?.id === entry.id ? styles.selected : ''}`} onClick={() => update({ suite:entry.id, test:null, after:null })}><StatusPill status={entry.status} /><span>{entry.label}<small>{entry.runtime} · {formatDuration(entry.durationMs)}</small></span><b>{formatNumber(suiteTotal(entry))}</b></button>)}</div></aside>
    <main className={styles.main}><ResourceState resource={page} label="tests"><section className={styles.panel}><div className={styles.panelHeader}><h2>{suite?.label || 'Tests'}</h2><span className={styles.muted}>100-row pages</span></div><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Status</th><th>Test</th><th>File</th><th>Duration</th></tr></thead><tbody>{(page.data?.tests || []).map((test) => <tr key={test.id} role="button" tabIndex="0" aria-selected={state.test === test.id} onMouseEnter={() => prefetchBffResource(`/api/runs/${encodeURIComponent(run.id)}/tests/${encodeURIComponent(test.id)}`)} onClick={() => update({ test:test.id })} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); update({ test:test.id }); } }}><td><StatusPill status={test.status} /></td><td>{test.fullName}</td><td className={styles.mono}>{test.filePath || 'n/a'}</td><td>{formatDuration(test.durationMs)}</td></tr>)}</tbody></table></div><div className={styles.footer}><span>{page.data?.tests?.length || 0} tests loaded</span>{page.data?.hasMore ? <button className={styles.button} onClick={() => update({ after:page.data.nextCursor })}>Next page</button> : null}</div></section></ResourceState></main>
    <TestInspector resource={detail} empty="Select a test to inspect assertions and captured evidence." update={update} />
  </div>;
}

function TestInspector({ resource, empty, update }) {
  return <aside className={styles.inspector}><ResourceState resource={resource} label="test detail">{resource.data ? <><div className={styles.panelHeader}><h2>Test details</h2><StatusPill status={resource.data.test?.status} /></div><h3>{resource.data.test?.fullName}</h3><dl className={styles.detailList}><dt>File</dt><dd className={styles.mono}>{resource.data.test?.filePath || 'n/a'}{resource.data.test?.line ? `:${resource.data.test.line}` : ''}</dd><dt>Duration</dt><dd>{formatDuration(resource.data.test?.durationMs)}</dd><dt>Runtime</dt><dd>{resource.data.suite?.runtime || 'n/a'}</dd>{resource.data.owner ? <><dt>Owner</dt><dd>{resource.data.owner}</dd></> : null}</dl>{resource.data.test?.status === 'failed' ? <button className={`${styles.button} ${styles.primary}`} onClick={() => update({ view:'failures', failure:resource.data.test.id, test:null })}>Open in Failure Triage →</button> : null}{resource.data.test?.assertions?.length ? <section><h3>Assertions ({resource.data.test.assertions.length})</h3><div className={styles.evidence}>{resource.data.test.assertions.join('\n')}</div></section> : null}{resource.data.test?.failureMessages?.length ? <section><h3>Failure</h3><div className={styles.evidence}>{resource.data.test.failureMessages.join('\n\n')}</div></section> : null}{resource.data.test?.sourceSnippet ? <section><h3>Source</h3><pre className={styles.evidence}>{resource.data.test.sourceSnippet}</pre></section> : null}{resource.data.artifacts?.length ? <ArtifactList artifacts={resource.data.artifacts} /> : null}</> : <div className={styles.state}>{empty}</div>}</ResourceState></aside>;
}

function FailuresMode({ run, state, update }) {
  const params = new URLSearchParams(); if (state.search) params.set('search',state.search); if (state.after) params.set('after',state.after);
  const page = useBffResource(`/api/runs/${encodeURIComponent(run.id)}/failures?${params}`);
  const selected = state.failure ? { id:state.failure } : page.data?.failures?.[0] || null;
  const detail = useBffResource(selected ? `/api/runs/${encodeURIComponent(run.id)}/tests/${encodeURIComponent(selected.id)}` : null);
  React.useEffect(() => { if (page.data && typeof performance !== 'undefined') performance.mark('run-failures-ready'); }, [page.data]);
  React.useEffect(() => { if (detail.data && typeof performance !== 'undefined') performance.mark('failure-evidence-ready'); }, [detail.data]);
  React.useEffect(() => { if (!state.failure && page.data?.failures?.[0]?.id) update({ failure:page.data.failures[0].id }); }, [page.data, state.failure, update]);
  return <div className={styles.runGrid}><aside className={styles.rail}><h2 className={styles.railTitle}>Failed tests</h2><div className={styles.filters}><input className={styles.input} value={state.search || ''} onChange={(event) => update({ search:event.target.value || null, after:null })} placeholder="Search failures" /><select className={styles.select} value={state.group} onChange={(event) => update({ group:event.target.value })}><option value="suite">Group by suite</option><option value="file">Group by file</option></select></div><ResourceState resource={page} label="failures"><div className={styles.list}>{(page.data?.failures || []).map((failure) => <button key={failure.id} className={`${styles.listRow} ${selected?.id === failure.id ? styles.selected : ''}`} onClick={() => update({ failure:failure.id })}><StatusPill status="failed" /><span>{failure.fullName}<small>{state.group === 'file' ? failure.filePath : failure.suiteLabel} · {formatDuration(failure.durationMs)}</small></span><b>›</b></button>)}</div></ResourceState></aside><main className={styles.main}><ResourceState resource={detail} label="failure evidence">{detail.data ? <FailureEvidence detail={detail.data} /> : <div className={styles.state}>No captured failure evidence.</div>}</ResourceState></main><aside className={styles.inspector}>{detail.data ? <FailureMetadata detail={detail.data} update={update} /> : null}</aside></div>;
}

function FailureEvidence({ detail }) {
  const message = detail.test?.failureMessages?.[0] || detail.errors?.[0]?.message || 'No failure message was captured.';
  return <><section className={styles.panel}><div className={styles.panelHeader}><h2>{detail.test?.fullName}</h2><StatusPill status="failed" /></div><pre className={styles.evidence}>{message}</pre></section>{detail.test?.sourceSnippet ? <section className={styles.panel}><div className={styles.panelHeader}><h2>Source</h2><span className={styles.mono}>{detail.test.filePath}:{detail.test.line || ''}</span></div><pre className={styles.evidence}>{detail.test.sourceSnippet}</pre></section> : null}{detail.errors?.[0]?.stack ? <section className={styles.panel}><div className={styles.panelHeader}><h2>Stack</h2></div><pre className={styles.evidence}>{detail.errors[0].stack}</pre></section> : null}</>;
}

function FailureMetadata({ detail, update }) { return <><div className={styles.panelHeader}><h2>Failure details</h2></div><dl className={styles.detailList}><dt>Suite</dt><dd>{detail.suite?.label || 'n/a'}</dd><dt>File</dt><dd className={styles.mono}>{detail.test?.filePath || 'n/a'}</dd><dt>Duration</dt><dd>{formatDuration(detail.test?.durationMs)}</dd>{detail.owner ? <><dt>Owner</dt><dd>{detail.owner}</dd></> : null}<dt>Runtime</dt><dd>{detail.suite?.runtime || 'n/a'}</dd>{detail.suite?.command ? <><dt>Command</dt><dd className={styles.mono}>{detail.suite.command}</dd></> : null}</dl><button className={styles.button} onClick={() => update({ view:'tests', suite:detail.test?.suiteRunId, test:detail.test?.id, failure:null })}>Open in Tests →</button>{detail.artifacts?.length ? <ArtifactList artifacts={detail.artifacts} /> : null}</>; }

function CoverageMode({ run, state, update }) {
  const params = new URLSearchParams({ sort:state.sort || 'lines-asc' }); if (state.search) params.set('search',state.search); if (state.below) params.set('below',state.below); if (state.after) params.set('after',state.after);
  const page = useBffResource(`/api/runs/${encodeURIComponent(run.id)}/coverage?${params}`);
  const selected = state.file ? { id:state.file } : page.data?.files?.[0] || null;
  const detail = useBffResource(selected ? `/api/runs/${encodeURIComponent(run.id)}/coverage/files/${encodeURIComponent(selected.id)}` : null);
  React.useEffect(() => { if (page.data && typeof performance !== 'undefined') { performance.mark('run-coverage-ready'); performance.mark('coverage-file-page-ready'); } }, [page.data]);
  React.useEffect(() => { if (detail.data && typeof performance !== 'undefined') performance.mark('coverage-file-inspector-ready'); }, [detail.data]);
  React.useEffect(() => { if (!state.file && page.data?.files?.[0]?.id) update({ file:page.data.files[0].id }); }, [page.data, state.file, update]);
  return <div className={styles.runGrid}><aside className={styles.rail}><h2 className={styles.railTitle}>Coverage scope</h2><div className={styles.filters}><input className={styles.input} value={state.search || ''} onChange={(event) => update({ search:event.target.value || null, after:null })} placeholder="Search files" /><select className={styles.select} value={state.below || ''} onChange={(event) => update({ below:event.target.value || null, after:null })}><option value="">Any coverage</option><option value="80">Below 80%</option><option value="50">Below 50%</option></select><select className={styles.select} value={state.sort || 'lines-asc'} onChange={(event) => update({ sort:event.target.value, after:null })}><option value="lines-asc">Lowest first</option><option value="lines-desc">Highest first</option><option value="path-asc">Path</option></select></div><div className={styles.list}><button className={`${styles.railButton} ${styles.selected}`}>All files</button>{page.data?.facets?.packages?.map((name) => <button className={styles.railButton} key={name}>{name}</button>)}</div></aside><main className={styles.main}><CoverageCards snapshot={page.data?.snapshot || run.coverageSnapshot} /><ResourceState resource={page} label="coverage files"><section className={styles.panel}><div className={styles.panelHeader}><h2>Coverage by file</h2><span className={styles.muted}>Direct 100-row page</span></div><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>File</th><th>Package</th><th>Lines</th><th>Branches</th><th>Functions</th><th>Delta</th></tr></thead><tbody>{(page.data?.files || []).map((file) => <tr key={file.id} role="button" tabIndex="0" aria-selected={state.file === file.id} onClick={() => update({ file:file.id })} onKeyDown={(event) => { if (event.key === 'Enter') update({ file:file.id }); }}><td className={styles.mono}>{file.path}</td><td>{file.packageName || 'n/a'}</td><td>{formatPct(file.linesPct)}</td><td>{formatPct(file.branchesPct)}</td><td>{formatPct(file.functionsPct)}</td><td>—</td></tr>)}</tbody></table></div><div className={styles.footer}><span>{page.data?.files?.length || 0} files loaded</span>{page.data?.hasMore ? <button className={styles.button} onClick={() => update({ after:page.data.nextCursor })}>Next page</button> : null}</div></section></ResourceState></main><CoverageInspector resource={detail} runId={run.id} update={update} /></div>;
}

function CoverageCards({ snapshot }) { return <div className={styles.coverageMetrics}>{[['Lines','lines'],['Branches','branches'],['Functions','functions'],['Statements','statements']].map(([label,key]) => <div className={styles.coverageCard} key={key}><small>{label}</small><strong>{formatPct(snapshot?.[`${key}Pct`])}</strong><span className={styles.muted}>{formatNumber(snapshot?.[`${key}Covered`])}/{formatNumber(snapshot?.[`${key}Total`])}</span><div className={styles.progress}><i style={{ width:`${Math.max(0,Math.min(100,Number(snapshot?.[`${key}Pct`]) || 0))}%` }} /></div></div>)}</div>; }

function CoverageInspector({ resource, update }) { return <aside className={styles.inspector}><ResourceState resource={resource} label="coverage file detail">{resource.data ? <><div className={styles.panelHeader}><h2>File detail</h2></div><h3 className={styles.mono}>{resource.data.file?.path}</h3><dl className={styles.detailList}><dt>Lines</dt><dd>{formatPct(resource.data.file?.linesPct)}</dd><dt>Branches</dt><dd>{formatPct(resource.data.file?.branchesPct)}</dd><dt>Functions</dt><dd>{formatPct(resource.data.file?.functionsPct)}</dd><dt>Statements</dt><dd>{formatPct(resource.data.file?.statementsPct)}</dd><dt>Delta</dt><dd>{resource.data.change?.deltaLinesPct == null ? 'n/a' : `${resource.data.change.deltaLinesPct > 0 ? '+' : ''}${resource.data.change.deltaLinesPct.toFixed(1)} pts`}</dd>{resource.data.file?.owner ? <><dt>Owner</dt><dd>{resource.data.file.owner}</dd></> : null}</dl>{resource.data.relatedTests?.length ? <section><h3>Related tests</h3><div className={styles.list}>{resource.data.relatedTests.map((test) => <button className={styles.listRow} key={test.id} onClick={() => update({ view:'tests', suite:test.suiteRunId, test:test.id, file:resource.data.file.id })}><StatusPill status={test.status} /><span>{test.fullName}</span><b>›</b></button>)}</div></section> : null}</> : <div className={styles.state}>Select a coverage file to inspect exact counts and related tests.</div>}</ResourceState></aside>; }

function PerformanceMode({ run }) {
  const resource = useBffResource(`/api/runs/${encodeURIComponent(run.id)}/performance`);
  React.useEffect(() => { if (resource.data && typeof performance !== 'undefined') performance.mark('run-performance-ready'); }, [resource.data]);
  const stats = resource.data?.runPerformanceStats || [];
  return <main className={styles.main}><ResourceState resource={resource} label="performance data"><section className={styles.panel}><div className={styles.panelHeader}><h2>Benchmark measurements</h2><span className={styles.muted}>{stats.length} active rows</span></div><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Namespace</th><th>Metric</th><th>Value</th><th>Series</th><th>Runner</th></tr></thead><tbody>{stats.map((stat) => <tr key={stat.id}><td className={styles.mono}>{stat.statGroup}</td><td>{stat.statName}</td><td>{stat.numericValue ?? stat.textValue ?? 'n/a'} {stat.unit || ''}</td><td>{stat.seriesId || 'n/a'}</td><td>{stat.runnerKey || 'n/a'}</td></tr>)}</tbody></table></div>{stats.length === 0 ? <div className={styles.state}>No active benchmark measurements were published.</div> : null}</section></ResourceState></main>;
}

function ArtifactsMode({ run, state, update }) {
  const params = new URLSearchParams(); if (state.kind) params.set('kind',state.kind); if (state.search) params.set('search',state.search); if (state.after) params.set('after',state.after);
  const resource = useBffResource(`/api/runs/${encodeURIComponent(run.id)}/artifacts?${params}`);
  React.useEffect(() => { if (resource.data && typeof performance !== 'undefined') performance.mark('run-artifacts-ready'); }, [resource.data]);
  return <main className={styles.main}><div className={styles.filters} style={{gridTemplateColumns:'1fr 180px',marginBottom:14}}><input className={styles.input} value={state.search || ''} onChange={(event) => update({ search:event.target.value || null, after:null })} placeholder="Search artifact names and paths" /><select className={styles.select} value={state.kind || ''} onChange={(event) => update({ kind:event.target.value || null, after:null })}><option value="">All kinds</option><option>file</option><option>log</option><option>report</option></select></div><ResourceState resource={resource} label="artifacts"><section className={styles.panel}><div className={styles.panelHeader}><h2>Artifact registry</h2><span className={styles.muted}>Authorized active submissions</span></div><ArtifactTable artifacts={resource.data?.artifacts || []} /><div className={styles.footer}><span>{resource.data?.artifacts?.length || 0} artifacts loaded</span>{resource.data?.hasMore ? <button className={styles.button} onClick={() => update({ after:resource.data.nextCursor })}>Next page</button> : null}</div></section></ResourceState></main>;
}

function ArtifactList({ artifacts }) { return <section><h3>Artifacts</h3><div className={styles.list}>{artifacts.map((artifact) => <a className={styles.listRow} key={artifact.id} href={artifact.href || artifact.sourceUrl || '#'} target="_blank" rel="noreferrer"><span>▱</span><span>{artifact.label || artifact.relativePath || artifact.id}<small>{artifact.kind} · {artifact.relativePath || 'stored evidence'}</small></span><b>↗</b></a>)}</div></section>; }
function ArtifactTable({ artifacts }) { return <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Name</th><th>Kind</th><th>Scope</th><th>Media type</th><th /></tr></thead><tbody>{artifacts.map((artifact) => <tr key={artifact.id}><td>{artifact.label || artifact.relativePath || artifact.id}</td><td>{artifact.kind}</td><td>{artifact.testExecutionId ? 'test' : artifact.suiteRunId ? 'suite' : 'run'}</td><td>{artifact.mediaType || 'n/a'}</td><td>{artifact.href || artifact.sourceUrl ? <a className={styles.link} href={artifact.href || artifact.sourceUrl} target="_blank" rel="noreferrer">Open ↗</a> : 'stored'}</td></tr>)}</tbody></table></div>; }

function RunnerReportMode({ run }) { React.useEffect(() => { if (typeof performance !== 'undefined') performance.mark('runner-report-ready'); }, []); return <iframe className={styles.report} title={`Runner report for ${run.externalKey}`} src={`/api/runs/${encodeURIComponent(run.id)}/report?view=compact`} scrolling="no" sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox" />; }

function suiteTotal(suite) {
  return suite?.summary?.totalTests ?? suite?.summary?.total ?? null;
}
