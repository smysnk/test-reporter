import React from 'react';
import Link from 'next/link';
import styles from './Workspace.module.css';

export function statusClass(status) {
  if (status === 'failed') return `${styles.pill} ${styles.pillFailed}`;
  if (status === 'passed') return styles.pill;
  return `${styles.pill} ${styles.pillNeutral}`;
}

export function StatusPill({ status = 'unknown', label = null }) {
  return <span className={statusClass(status)}>{label || status}</span>;
}

export function WorkspaceTabs({ items, active, onChange }) {
  return <nav className={styles.tabs} aria-label="Workspace views">{items.map((item) => (
    <button key={item.value} type="button" role="tab" aria-selected={active === item.value}
      className={`${styles.tab} ${active === item.value ? styles.tabActive : ''}`}
      onClick={() => onChange(item.value)}>
      {item.label}{item.count !== null && item.count !== undefined ? <span className={styles.tabCount}>{item.count}</span> : null}
    </button>
  ))}</nav>;
}

export function SummaryStrip({ items }) {
  return <div className={styles.summary}>{items.map((item) => <div className={styles.metric} key={item.label}>
    <small>{item.label}</small><strong>{item.value ?? 'n/a'}</strong>
  </div>)}</div>;
}

export function ResourceState({ resource, label, children }) {
  if (resource.loading && !resource.data) return <div className={styles.state} role="status">Loading {label}…</div>;
  if (resource.error && !resource.data) return <div className={`${styles.state} ${styles.error}`} role="alert">{resource.error} <button className={styles.button} onClick={resource.retry}>Retry</button></div>;
  return <>{resource.error ? <div className={styles.notice} role="status">Showing last good data. Refresh failed: {resource.error}</div> : null}{children}</>;
}

export function formatNumber(value) { return Number.isFinite(Number(value)) ? Number(value).toLocaleString() : 'n/a'; }
export function formatPct(value) { return Number.isFinite(Number(value)) ? `${Number(value).toFixed(1)}%` : 'n/a'; }
export function formatDuration(value) {
  if (!Number.isFinite(Number(value))) return 'n/a';
  const ms = Number(value);
  return ms >= 1000 ? `${(ms / 1000).toFixed(ms >= 10000 ? 1 : 2)}s` : `${Math.round(ms)}ms`;
}
export function formatDate(value) {
  if (!value) return 'n/a';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'n/a' : date.toLocaleString();
}

export function RunLink({ runId, children, query = null, className = styles.link }) {
  return <Link className={className} href={{ pathname: `/runs/${runId}`, query: query || {} }}>{children}</Link>;
}

export { styles };
