import React from 'react';
import { GoogleAnalytics } from '@next/third-parties/google';
import { ApolloProvider } from '@apollo/client';
import { SessionProvider } from 'next-auth/react';
import { useRouter } from 'next/router';
import { Provider, useSelector } from 'react-redux';
import { ThemeProvider, createGlobalStyle } from 'styled-components';
import { WebShell } from '../components/WebShell.js';
import { getApolloClient } from '../lib/apolloClient.js';
import { initializeAnalytics, pageview } from '../lib/gtag.js';
import { wrapper } from '../store/index.js';

const theme = {
  colors: {
    background: '#07111f',
    panel: 'rgba(16, 28, 49, 0.84)',
    panelStrong: 'rgba(22, 36, 61, 0.94)',
    panelSoft: 'rgba(11, 20, 36, 0.82)',
    border: 'rgba(124, 160, 224, 0.18)',
    borderStrong: 'rgba(124, 160, 224, 0.32)',
    text: '#eef4ff',
    muted: '#99a9c4',
    accent: '#6bb2ff',
    accentSoft: 'rgba(107, 178, 255, 0.14)',
    success: '#4ee38b',
    danger: '#ff6f8f',
    warning: '#f7c55a',
  },
  shadow: '0 22px 80px rgba(2, 8, 20, 0.45)',
  radius: '28px',
  font: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

const GlobalStyle = createGlobalStyle`
  * { box-sizing: border-box; }
  html, body, #__next { min-height: 100%; }
  body {
    margin: 0;
    background:
      radial-gradient(circle at top left, rgba(107, 178, 255, 0.22), transparent 30%),
      radial-gradient(circle at top right, rgba(78, 227, 139, 0.1), transparent 24%),
      linear-gradient(180deg, #08101b 0%, #07111f 55%, #050c16 100%);
    color: ${(props) => props.theme.colors.text};
    font-family: ${(props) => props.theme.font};
  }
  a {
    color: ${(props) => props.theme.colors.accent};
    text-decoration: none;
  }
  .web-shell {
    min-height: 100vh;
    padding: 32px;
  }
  .web-shell__header,
  .web-card {
    border: 1px solid ${(props) => props.theme.colors.border};
    background: ${(props) => props.theme.colors.panel};
    border-radius: ${(props) => props.theme.radius};
    box-shadow: ${(props) => props.theme.shadow};
    backdrop-filter: blur(18px);
  }
  .web-shell__header {
    display: grid;
    gap: 20px;
    padding: 28px;
    margin: 0 auto 24px;
    max-width: 1280px;
    background:
      radial-gradient(circle at top left, rgba(107, 178, 255, 0.18), transparent 34%),
      linear-gradient(145deg, rgba(24, 39, 65, 0.96), rgba(10, 18, 34, 0.92));
  }
  .web-shell__eyebrow {
    margin: 0 0 8px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: ${(props) => props.theme.colors.muted};
    font-size: 0.75rem;
  }
  .web-shell__title {
    margin: 0 0 10px;
    font-size: clamp(2rem, 5vw, 3.6rem);
    line-height: 0.95;
  }
  .web-shell__copy {
    margin: 0;
    max-width: 64ch;
    color: ${(props) => props.theme.colors.muted};
    line-height: 1.6;
  }
  .web-shell__nav {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
  }
  .web-shell__nav a {
    padding: 10px 14px;
    border-radius: 999px;
    background: ${(props) => props.theme.colors.accentSoft};
    border: 1px solid ${(props) => props.theme.colors.border};
    font-size: 0.95rem;
  }
  .web-shell__main {
    max-width: 1280px;
    margin: 0 auto;
    display: grid;
    gap: 24px;
  }
  .web-shell__main > * {
    min-width: 0;
  }
  .web-card {
    padding: 28px;
    min-width: 0;
  }
  .web-card--compact {
    padding: 22px;
  }
  .web-card__eyebrow {
    margin: 0 0 10px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: ${(props) => props.theme.colors.muted};
    font-size: 0.72rem;
  }
  .web-card__title {
    margin: 0 0 10px;
    font-size: 1.8rem;
    overflow-wrap: anywhere;
  }
  .web-card__copy {
    margin: 0;
    color: ${(props) => props.theme.colors.muted};
    line-height: 1.6;
    overflow-wrap: anywhere;
  }
  .web-shell__toolbar {
    display: grid;
    gap: 16px;
    justify-items: start;
  }
  .web-meta {
    display: grid;
    gap: 12px;
    margin-top: 24px;
  }
  .web-meta__item {
    display: grid;
    gap: 4px;
    padding-top: 12px;
    border-top: 1px solid ${(props) => props.theme.colors.border};
  }
  .web-meta__label {
    color: ${(props) => props.theme.colors.muted};
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .web-grid {
    display: grid;
    gap: 24px;
  }
  .web-grid > * {
    min-width: 0;
  }
  .web-grid--two {
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  }
  .web-metrics {
    display: grid;
    gap: 16px;
    margin-top: 24px;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  }
  .web-metric {
    display: grid;
    gap: 6px;
    padding: 18px;
    border-radius: 18px;
    background: ${(props) => props.theme.colors.panelSoft};
    border: 1px solid ${(props) => props.theme.colors.border};
    min-width: 0;
  }
  .web-metric__label {
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: ${(props) => props.theme.colors.muted};
  }
  .web-metric__value {
    font-size: 1.6rem;
    overflow-wrap: anywhere;
  }
  .web-metric__copy {
    color: ${(props) => props.theme.colors.muted};
    font-size: 0.9rem;
    overflow-wrap: anywhere;
  }
  .web-list {
    display: grid;
    gap: 14px;
    margin-top: 22px;
  }
  .web-list__item {
    display: grid;
    gap: 8px;
    padding: 18px;
    border-radius: 18px;
    border: 1px solid ${(props) => props.theme.colors.border};
    background: rgba(11, 20, 36, 0.58);
    min-width: 0;
  }
  .web-list__row {
    display: flex;
    gap: 12px;
    justify-content: space-between;
    align-items: flex-start;
    flex-wrap: wrap;
  }
  .web-list__row > * {
    min-width: 0;
  }
  .web-list__title {
    font-size: 1.1rem;
    flex: 1 1 220px;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .web-list__meta {
    color: ${(props) => props.theme.colors.muted};
    font-size: 0.92rem;
    overflow-wrap: anywhere;
  }
  .web-pill {
    display: inline-flex;
    align-items: center;
    padding: 6px 10px;
    border-radius: 999px;
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 600;
    border: 1px solid transparent;
  }
  .web-pill--passed,
  .web-pill--covered {
    background: color-mix(in srgb, ${(props) => props.theme.colors.success} 16%, transparent);
    color: ${(props) => props.theme.colors.success};
    border-color: color-mix(in srgb, ${(props) => props.theme.colors.success} 28%, transparent);
  }
  .web-pill--failed {
    background: color-mix(in srgb, ${(props) => props.theme.colors.danger} 16%, transparent);
    color: ${(props) => props.theme.colors.danger};
    border-color: color-mix(in srgb, ${(props) => props.theme.colors.danger} 28%, transparent);
  }
  .web-pill--unknown,
  .web-pill--skipped {
    background: color-mix(in srgb, ${(props) => props.theme.colors.warning} 14%, transparent);
    color: ${(props) => props.theme.colors.muted};
    border-color: color-mix(in srgb, ${(props) => props.theme.colors.warning} 24%, transparent);
  }
  .web-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 20px;
    font-size: 0.96rem;
    table-layout: fixed;
  }
  .web-table-wrap {
    width: 100%;
    overflow-x: auto;
  }
  .web-table th,
  .web-table td {
    padding: 12px 0;
    border-bottom: 1px solid ${(props) => props.theme.colors.border};
    text-align: left;
    vertical-align: top;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  .web-table th {
    color: ${(props) => props.theme.colors.muted};
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .web-table__path {
    font-family: "SFMono-Regular", "SFMono", "Menlo", "Consolas", monospace;
    font-size: 0.9rem;
  }
  .web-explorer {
    display: grid;
    gap: 24px;
    align-items: start;
  }
  .web-explorer__sidebar {
    display: grid;
    gap: 18px;
    min-width: 0;
  }
  .web-explorer__sidebar-list {
    display: grid;
    gap: 10px;
  }
  .web-explorer__sidebar-item {
    width: 100%;
    display: grid;
    gap: 10px;
    padding: 16px;
    border-radius: 18px;
    border: 1px solid ${(props) => props.theme.colors.border};
    background:
      linear-gradient(155deg, rgba(20, 34, 58, 0.88), rgba(10, 17, 31, 0.92));
    color: ${(props) => props.theme.colors.text};
    text-align: left;
    font: inherit;
    cursor: pointer;
    transition: border-color 160ms ease, transform 160ms ease, background 160ms ease;
  }
  .web-explorer__sidebar-item:hover {
    border-color: ${(props) => props.theme.colors.borderStrong};
    transform: translateY(-1px);
  }
  .web-explorer__sidebar-item--active {
    border-color: ${(props) => props.theme.colors.borderStrong};
    background:
      radial-gradient(circle at top left, rgba(107, 178, 255, 0.2), transparent 55%),
      linear-gradient(155deg, rgba(25, 41, 68, 0.96), rgba(12, 20, 36, 0.94));
    box-shadow: inset 0 0 0 1px rgba(107, 178, 255, 0.14);
  }
  .web-explorer__sidebar-row {
    display: block;
  }
  .web-explorer__sidebar-title {
    display: block;
    font-size: 1rem;
    overflow-wrap: anywhere;
  }
  .web-explorer__sidebar-status {
    display: flex;
    justify-content: flex-start;
  }
  .web-explorer__sidebar-meta {
    color: ${(props) => props.theme.colors.muted};
    font-size: 0.9rem;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }
  .web-explorer__main {
    min-width: 0;
    display: grid;
    gap: 24px;
  }
  .web-explorer__summary {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-top: 22px;
  }
  .web-explorer__actions {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    margin-top: 18px;
  }
  .web-explorer__section {
    display: grid;
    gap: 18px;
    margin-top: 24px;
    min-width: 0;
  }
  .web-explorer__section-heading {
    display: grid;
    gap: 8px;
  }
  .web-explorer__section-title {
    margin: 0;
    font-size: 1.25rem;
    overflow-wrap: anywhere;
  }
  .web-explorer__section-copy {
    margin: 0;
    color: ${(props) => props.theme.colors.muted};
    line-height: 1.6;
    overflow-wrap: anywhere;
  }
  .web-explorer-table th,
  .web-explorer-table td {
    padding-right: 16px;
  }
  .web-explorer-table {
    table-layout: auto;
    min-width: 960px;
  }
  .web-explorer-table th:last-child,
  .web-explorer-table td:last-child {
    padding-right: 0;
  }
  .web-explorer-table__entity {
    display: grid;
    gap: 6px;
    min-width: 0;
  }
  .web-explorer-table__primary {
    color: ${(props) => props.theme.colors.text};
    font-weight: 700;
    overflow-wrap: anywhere;
  }
  .web-explorer-table__meta {
    color: ${(props) => props.theme.colors.muted};
    font-size: 0.86rem;
    overflow-wrap: anywhere;
  }
  .web-explorer-table__meta-row {
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
  }
  .web-explorer-table__cell {
    white-space: nowrap;
  }
  .web-explorer-table__cell--status {
    white-space: normal;
  }
  .web-explorer-table__build {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .web-explorer-table__text-link {
    color: ${(props) => props.theme.colors.accent};
    font-weight: 600;
  }
  .web-explorer-table__text-value {
    color: ${(props) => props.theme.colors.text};
  }
  .web-explorer-table__text-value--muted {
    color: ${(props) => props.theme.colors.muted};
  }
  .web-inline-list {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    min-width: 0;
  }
  .web-inline-list__item,
  .web-chip {
    display: inline-flex;
    align-items: center;
    padding: 6px 10px;
    border-radius: 999px;
    background: rgba(107, 178, 255, 0.08);
    border: 1px solid ${(props) => props.theme.colors.border};
    color: ${(props) => props.theme.colors.text};
    font-size: 0.84rem;
    max-width: 100%;
    min-width: 0;
    white-space: normal;
    overflow-wrap: anywhere;
    text-align: left;
  }
  .web-link--break {
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  .web-run-detail__header {
    display: grid;
    gap: 16px;
    margin-top: 18px;
  }
  .web-segmented-control {
    display: inline-flex;
    gap: 6px;
    padding: 6px;
    border-radius: 999px;
    border: 1px solid ${(props) => props.theme.colors.border};
    background: ${(props) => props.theme.colors.panelSoft};
    width: fit-content;
    max-width: 100%;
    flex-wrap: wrap;
  }
  .web-segmented-control__link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 10px 14px;
    border-radius: 999px;
    color: ${(props) => props.theme.colors.muted};
    font-size: 0.92rem;
    white-space: nowrap;
  }
  .web-segmented-control__link--active {
    background: ${(props) => props.theme.colors.accent};
    color: #07111f;
  }
  .web-runner-frame {
    width: 100%;
    margin-top: 22px;
    border: 1px solid ${(props) => props.theme.colors.border};
    border-radius: 22px;
    background: #0b1424;
    display: block;
  }
  .web-kv {
    display: grid;
    gap: 12px;
    margin-top: 20px;
  }
  .web-kv__item {
    display: grid;
    gap: 4px;
  }
  .web-kv__label {
    font-size: 0.75rem;
    color: ${(props) => props.theme.colors.muted};
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .web-empty {
    margin-top: 18px;
    padding: 18px;
    border-radius: 18px;
    background: rgba(11, 20, 36, 0.48);
    border: 1px dashed ${(props) => props.theme.colors.border};
  }
  .web-empty__title {
    display: block;
    margin-bottom: 8px;
  }
  .web-empty__copy {
    margin: 0;
    color: ${(props) => props.theme.colors.muted};
  }
  .web-shell__identity {
    display: grid;
    gap: 4px;
    justify-items: start;
  }
  .web-shell__identity-label {
    font-weight: 700;
  }
  .web-shell__identity-meta {
    color: ${(props) => props.theme.colors.muted};
    font-size: 0.9rem;
  }
  .web-button {
    border: 1px solid ${(props) => props.theme.colors.accent};
    background: ${(props) => props.theme.colors.accent};
    color: #07111f;
    border-radius: 999px;
    padding: 10px 16px;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }
  .web-button--primary {
    display: inline-flex;
    width: 100%;
    justify-content: center;
  }
  .web-button--ghost {
    background: rgba(107, 178, 255, 0.06);
    color: ${(props) => props.theme.colors.accent};
  }
  .web-auth {
    max-width: 760px;
    margin: 0 auto;
  }
  .web-auth__providers,
  .web-auth__form {
    display: grid;
    gap: 14px;
    margin-top: 24px;
  }
  .web-field {
    display: grid;
    gap: 6px;
  }
  .web-field__label {
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: ${(props) => props.theme.colors.muted};
  }
  .web-field__input {
    border: 1px solid ${(props) => props.theme.colors.border};
    border-radius: 14px;
    padding: 12px 14px;
    font: inherit;
    background: rgba(7, 17, 31, 0.88);
    color: ${(props) => props.theme.colors.text};
  }
  .web-trend-list {
    display: grid;
    gap: 12px;
    margin-top: 20px;
  }
  .web-trend-list__item {
    display: grid;
    gap: 8px;
  }
  .web-trend-list__bar {
    height: 10px;
    border-radius: 999px;
    background: rgba(107, 178, 255, 0.12);
    overflow: hidden;
  }
  .web-trend-list__fill {
    height: 100%;
    background: linear-gradient(90deg, #6bb2ff 0%, #4ee38b 100%);
  }
  .web-stack {
    display: grid;
    gap: 18px;
    min-width: 0;
  }
  .web-stack--tight {
    gap: 8px;
  }
  .web-trend-card {
    display: grid;
    gap: 16px;
    padding: 20px;
    border-radius: 20px;
    border: 1px solid ${(props) => props.theme.colors.border};
    background: rgba(11, 20, 36, 0.58);
  }
  .web-trend-card--compact {
    padding: 18px;
  }
  .web-trend-card__value {
    font-size: 1.2rem;
  }
  .web-trend-card__chart {
    width: 100%;
    height: 140px;
  }
  .web-trend-card__baseline {
    fill: none;
    stroke: rgba(124, 160, 224, 0.24);
    stroke-width: 1;
  }
  .web-trend-card__line {
    fill: none;
    stroke: ${(props) => props.theme.colors.accent};
    stroke-width: 3;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .web-trend-card__dot {
    fill: ${(props) => props.theme.colors.accent};
    stroke: #07111f;
    stroke-width: 2;
  }
  .web-trend-card__overlay line {
    stroke: rgba(124, 160, 224, 0.18);
    stroke-dasharray: 3 4;
  }
  .web-trend-card__overlay circle {
    fill: #07111f;
    stroke: ${(props) => props.theme.colors.accent};
    stroke-width: 2;
  }
  .web-chip--release {
    background: rgba(107, 178, 255, 0.12);
  }
  .web-chip--muted {
    color: ${(props) => props.theme.colors.muted};
    background: rgba(107, 178, 255, 0.04);
  }
  .web-chip--admin-public {
    color: ${(props) => props.theme.colors.success};
    background: color-mix(in srgb, ${(props) => props.theme.colors.success} 16%, transparent);
    border-color: color-mix(in srgb, ${(props) => props.theme.colors.success} 28%, transparent);
  }
  .web-chip--admin-private {
    color: ${(props) => props.theme.colors.warning};
    background: color-mix(in srgb, ${(props) => props.theme.colors.warning} 16%, transparent);
    border-color: color-mix(in srgb, ${(props) => props.theme.colors.warning} 28%, transparent);
  }
  .web-admin-shortcuts {
    display: grid;
    gap: 16px;
    margin-top: 24px;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  }
  .web-admin-shortcut {
    display: grid;
    gap: 10px;
    padding: 18px;
    border-radius: 18px;
    background: ${(props) => props.theme.colors.panelSoft};
    border: 1px solid ${(props) => props.theme.colors.border};
  }
  .web-admin-shortcut__title {
    font-size: 1rem;
  }
  .web-admin-shortcut__copy {
    color: ${(props) => props.theme.colors.muted};
    line-height: 1.5;
  }
  .web-admin-notice {
    margin-top: 18px;
    padding: 14px 16px;
    border-radius: 16px;
    border: 1px solid ${(props) => props.theme.colors.border};
  }
  .web-admin-notice--error {
    color: ${(props) => props.theme.colors.danger};
    background: color-mix(in srgb, ${(props) => props.theme.colors.danger} 10%, transparent);
    border-color: color-mix(in srgb, ${(props) => props.theme.colors.danger} 28%, transparent);
  }
  .web-admin-form {
    display: grid;
    gap: 16px;
    margin-top: 22px;
  }
  .web-admin-form__grid {
    display: grid;
    gap: 16px;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  }
  .web-admin-field {
    display: grid;
    gap: 8px;
    min-width: 0;
  }
  .web-admin-field__label {
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: ${(props) => props.theme.colors.muted};
  }
  .web-admin-field__hint {
    color: ${(props) => props.theme.colors.muted};
    font-size: 0.88rem;
    line-height: 1.5;
  }
  .web-admin-input,
  .web-admin-textarea,
  .web-admin-select {
    width: 100%;
    border: 1px solid ${(props) => props.theme.colors.border};
    border-radius: 14px;
    padding: 12px 14px;
    font: inherit;
    background: rgba(7, 17, 31, 0.88);
    color: ${(props) => props.theme.colors.text};
    min-width: 0;
  }
  .web-admin-textarea {
    resize: vertical;
  }
  .web-admin-actions {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    margin-top: 20px;
  }
  .web-admin-inline-form {
    display: flex;
    gap: 12px;
    align-items: end;
    flex-wrap: wrap;
    margin-top: 18px;
  }
  .web-admin-inline-form > * {
    min-width: 0;
  }
  .web-admin-help {
    margin-top: 18px;
  }
  @media (min-width: 900px) {
    .web-shell__header {
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: start;
    }
    .web-shell__toolbar {
      justify-items: end;
    }
  }
  @media (min-width: 980px) {
    .web-explorer {
      grid-template-columns: minmax(260px, 300px) minmax(0, 1fr);
    }
    .web-explorer__sidebar {
      position: static;
      top: auto;
    }
  }
`;

function WebAppContent({ Component, pageProps }) {
  const viewer = pageProps.data?.viewer || null;
  const runtimeConfig = useSelector((state) => state.runtime.config);
  const runtimeConfigLoaded = useSelector((state) => state.runtime.loaded);
  const gaMeasurementId = runtimeConfig?.GA_MEASUREMENT_ID || null;
  const router = useRouter();

  React.useEffect(() => {
    if (typeof window === 'undefined' || !runtimeConfig) {
      return;
    }

    window.__RUNTIME_CONFIG__ = runtimeConfig;
  }, [runtimeConfig]);

  React.useEffect(() => {
    if (!runtimeConfigLoaded || !gaMeasurementId) {
      return;
    }

    initializeAnalytics();
  }, [gaMeasurementId, runtimeConfigLoaded]);

  React.useEffect(() => {
    if (!gaMeasurementId) {
      return;
    }

    const handleRouteChange = (url) => {
      pageview(url);
    };

    router.events.on('routeChangeComplete', handleRouteChange);
    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [gaMeasurementId, router.events]);

  return React.createElement(
    ThemeProvider,
    { theme },
    React.createElement(
      React.Fragment,
      null,
      runtimeConfigLoaded && gaMeasurementId
        ? React.createElement(GoogleAnalytics, { gaId: gaMeasurementId })
        : null,
      React.createElement(GlobalStyle, null),
      React.createElement(
        WebShell,
        { viewer },
        React.createElement(Component, pageProps),
      ),
    ),
  );
}

export default function WebApp({ Component, ...rest }) {
  const { store, props } = wrapper.useWrappedStore(rest);
  const client = getApolloClient();
  const pageProps = props.pageProps || {};
  const session = pageProps.session || null;

  return React.createElement(
    SessionProvider,
    { session },
    React.createElement(
      ApolloProvider,
      { client },
      React.createElement(
        Provider,
        { store },
        React.createElement(WebAppContent, { Component, pageProps }),
      ),
    ),
  );
}
