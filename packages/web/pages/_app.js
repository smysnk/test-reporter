import React from 'react';
import { GoogleAnalytics } from '@next/third-parties/google';
import { ApolloProvider } from '@apollo/client';
import { useRouter } from 'next/router';
import { Provider, useSelector } from 'react-redux';
import { ThemeProvider, createGlobalStyle } from 'styled-components';
import { WebShell } from '../components/WebShell.js';
import { getApolloClient } from '../lib/apolloClient.js';
import { initializeAnalytics, pageview } from '../lib/gtag.js';
import {
  beginClientRouteProfile,
  completeClientRouteProfile,
  failClientRouteProfile,
  recordClientRouteStage,
  setClientServerPageProfile,
} from '../lib/pageProfiling.js';
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
  headingFont: '"Aptos Narrow", "Arial Narrow", "Roboto Condensed", "Helvetica Neue", sans-serif',
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
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
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
    gap: 8px;
    flex-wrap: wrap;
    padding: 8px;
    border-radius: 22px;
    border: 1px solid ${(props) => props.theme.colors.border};
    background:
      linear-gradient(180deg, rgba(15, 25, 43, 0.92), rgba(10, 18, 32, 0.88));
    box-shadow: inset 0 1px 0 rgba(124, 160, 224, 0.08);
  }
  .web-shell__nav-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 48px;
    padding: 0 18px;
    border-radius: 16px;
    border: 1px solid transparent;
    color: ${(props) => props.theme.colors.muted};
    font-size: 0.95rem;
    font-weight: 600;
    transition: background 160ms ease, border-color 160ms ease, color 160ms ease, transform 160ms ease;
  }
  .web-shell__nav-link:hover {
    color: ${(props) => props.theme.colors.text};
    background: rgba(107, 178, 255, 0.08);
    border-color: rgba(124, 160, 224, 0.16);
    transform: translateY(-1px);
  }
  .web-shell__nav-link--active {
    color: ${(props) => props.theme.colors.text};
    background:
      radial-gradient(circle at top center, rgba(107, 178, 255, 0.16), transparent 70%),
      linear-gradient(180deg, rgba(36, 60, 98, 0.92), rgba(21, 38, 67, 0.94));
    border-color: ${(props) => props.theme.colors.borderStrong};
    box-shadow: inset 0 1px 0 rgba(124, 160, 224, 0.12);
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
    gap: 12px;
    justify-items: stretch;
    align-content: start;
    width: min(100%, 420px);
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
    white-space: nowrap;
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
    min-width: 0;
    overflow: visible;
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
    font-family: ${(props) => props.theme.headingFont};
    font-weight: 300;
    font-stretch: condensed;
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
    align-items: center;
    gap: 12px;
    min-width: 0;
  }
  .web-explorer__sidebar-status-spacer {
    width: 1px;
    min-width: 1px;
    height: 1px;
  }
  .web-explorer__sidebar-meta {
    color: ${(props) => props.theme.colors.muted};
    font-size: 0.88rem;
    line-height: 1.4;
    margin-left: auto;
    text-align: right;
    white-space: nowrap;
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
  .web-explorer__feed-footer {
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
  }
  .web-explorer__feed-count,
  .web-explorer__feed-status {
    color: ${(props) => props.theme.colors.muted};
    font-size: 0.9rem;
  }
  .web-explorer__feed-sentinel {
    height: 1px;
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
    padding-right: 10px;
  }
  .web-explorer-table th:not(:first-child),
  .web-explorer-table td:not(:first-child) {
    padding-right: 6px;
  }
  .web-explorer-table {
    table-layout: fixed;
    min-width: 0;
    width: 100%;
  }
  .web-explorer-table__col--status {
    width: 102px;
  }
  .web-explorer-table__col--build {
    width: 66px;
  }
  .web-explorer-table__col--branch {
    width: 76px;
  }
  .web-explorer-table__col--duration {
    width: 72px;
  }
  .web-explorer-table__col--coverage {
    width: 72px;
  }
  .web-explorer-table__row {
    cursor: pointer;
    outline: none;
  }
  .web-explorer-table__row td {
    transition: background-color 160ms ease;
  }
  .web-explorer-table__row:hover td,
  .web-explorer-table__row:focus td {
    background: rgba(107, 178, 255, 0.08);
  }
  .web-explorer-table__row:hover .web-explorer-table__primary,
  .web-explorer-table__row:focus .web-explorer-table__primary {
    color: ${(props) => props.theme.colors.accent};
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
    transition: color 160ms ease;
    font-weight: 700;
    overflow-wrap: anywhere;
  }
  .web-explorer-table__row-link {
    display: grid;
    gap: 6px;
    color: inherit;
    text-decoration: none;
    min-width: 0;
  }
  .web-explorer-table__row-link:hover .web-explorer-table__primary,
  .web-explorer-table__row-link:focus .web-explorer-table__primary {
    color: ${(props) => props.theme.colors.accent};
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
  .web-explorer-table__cell--tight,
  .web-explorer-table__head--tight {
    font-size: 0.82rem;
  }
  .web-explorer-table__cell--status {
    white-space: normal;
  }
  .web-explorer-table__build {
    display: flex;
    gap: 4px;
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
  .web-run-detail__controls {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
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
  .web-segmented-control__button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 10px 14px;
    border-radius: 999px;
    color: ${(props) => props.theme.colors.muted};
    font-size: 0.92rem;
    white-space: nowrap;
    border: 0;
    background: transparent;
    font: inherit;
    cursor: pointer;
  }
  .web-segmented-control__link--active {
    background: ${(props) => props.theme.colors.accent};
    color: #07111f;
  }
  .web-segmented-control__button--active {
    background: ${(props) => props.theme.colors.accent};
    color: #07111f;
  }
  .web-segmented-control__button:disabled {
    opacity: 0.55;
    cursor: not-allowed;
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
    gap: 8px;
    justify-items: start;
    padding: 16px 18px;
    border-radius: 22px;
    border: 1px solid ${(props) => props.theme.colors.border};
    background:
      radial-gradient(circle at top right, rgba(107, 178, 255, 0.12), transparent 32%),
      linear-gradient(180deg, rgba(14, 23, 40, 0.94), rgba(9, 17, 31, 0.9));
    box-shadow: inset 0 1px 0 rgba(124, 160, 224, 0.06);
  }
  .web-shell__identity-kicker {
    color: ${(props) => props.theme.colors.muted};
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }
  .web-shell__identity-label {
    font-weight: 700;
    font-size: 1.1rem;
  }
  .web-shell__identity-meta {
    color: ${(props) => props.theme.colors.muted};
    font-size: 0.9rem;
  }
  .web-shell__identity-action {
    margin-top: 2px;
    padding: 9px 14px;
    border-radius: 14px;
  }
  .web-shell__identity--guest {
    align-items: start;
  }
  .web-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid ${(props) => props.theme.colors.accent};
    background: ${(props) => props.theme.colors.accent};
    color: #07111f;
    border-radius: 999px;
    padding: 10px 16px;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
    text-decoration: none;
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
  .web-benchmark-toolbar {
    display: grid;
    gap: 14px;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    margin-top: 8px;
  }
  .web-benchmark-dashboard {
    margin-top: 8px;
  }
  .web-benchmark-section {
    display: grid;
    gap: 16px;
    padding: 18px;
    border-radius: 20px;
    border: 1px solid ${(props) => props.theme.colors.border};
    background: rgba(11, 20, 36, 0.42);
  }
  .web-benchmark-section__header {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 10px;
    align-items: baseline;
  }
  .web-benchmark-table th,
  .web-benchmark-table td {
    vertical-align: top;
  }
  .web-benchmark-namespace-grid {
    display: grid;
    gap: 14px;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  }
  .web-benchmark-namespace-card,
  .web-benchmark-metric-card {
    display: grid;
    gap: 12px;
    width: 100%;
    text-align: left;
    padding: 16px;
    border-radius: 18px;
    border: 1px solid ${(props) => props.theme.colors.border};
    background: ${(props) => props.theme.colors.panelSoft};
    color: ${(props) => props.theme.colors.text};
    font: inherit;
    cursor: pointer;
  }
  .web-benchmark-namespace-card--active,
  .web-benchmark-metric-card--active {
    border-color: color-mix(in srgb, ${(props) => props.theme.colors.accent} 40%, ${(props) => props.theme.colors.border});
    background: color-mix(in srgb, ${(props) => props.theme.colors.accent} 8%, ${(props) => props.theme.colors.panelSoft});
    box-shadow: 0 0 0 1px color-mix(in srgb, ${(props) => props.theme.colors.accent} 18%, transparent);
  }
  .web-benchmark-metric-grid {
    display: grid;
    gap: 14px;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  }
  .web-benchmark-status {
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-size: 0.72rem;
  }
  .web-benchmark-status--regressed {
    color: ${(props) => props.theme.colors.danger};
    background: color-mix(in srgb, ${(props) => props.theme.colors.danger} 12%, transparent);
    border-color: color-mix(in srgb, ${(props) => props.theme.colors.danger} 28%, transparent);
  }
  .web-benchmark-status--severe-regression {
    color: #ff4d6d;
    background: color-mix(in srgb, #ff4d6d 14%, transparent);
    border-color: color-mix(in srgb, #ff4d6d 34%, transparent);
  }
  .web-benchmark-status--warning {
    color: #ffd166;
    background: color-mix(in srgb, #ffd166 14%, transparent);
    border-color: color-mix(in srgb, #ffd166 32%, transparent);
  }
  .web-benchmark-status--improved {
    color: ${(props) => props.theme.colors.success};
    background: color-mix(in srgb, ${(props) => props.theme.colors.success} 12%, transparent);
    border-color: color-mix(in srgb, ${(props) => props.theme.colors.success} 28%, transparent);
  }
  .web-benchmark-status--stable {
    color: ${(props) => props.theme.colors.accent};
    background: color-mix(in srgb, ${(props) => props.theme.colors.accent} 12%, transparent);
    border-color: color-mix(in srgb, ${(props) => props.theme.colors.accent} 28%, transparent);
  }
  .web-benchmark-status--insufficient-baseline {
    color: ${(props) => props.theme.colors.muted};
    background: rgba(107, 178, 255, 0.06);
    border-color: ${(props) => props.theme.colors.border};
  }
  .web-benchmark-sparkline {
    width: 100%;
    height: 48px;
  }
  .web-benchmark-sparkline--empty {
    display: grid;
    place-items: center;
    height: 48px;
    border-radius: 14px;
    border: 1px dashed ${(props) => props.theme.colors.border};
    color: ${(props) => props.theme.colors.muted};
    font-size: 0.82rem;
  }
  .web-benchmark-sparkline__axis {
    fill: none;
    stroke: rgba(124, 160, 224, 0.18);
    stroke-width: 1;
  }
  .web-benchmark-sparkline__line {
    fill: none;
    stroke-width: 2.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .web-benchmark-series-toggles {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
  .web-benchmark-series-toggle {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    border-radius: 999px;
    border: 1px solid ${(props) => props.theme.colors.border};
    background: ${(props) => props.theme.colors.panelSoft};
    color: ${(props) => props.theme.colors.muted};
    font: inherit;
    cursor: pointer;
  }
  .web-benchmark-series-toggle--active {
    color: ${(props) => props.theme.colors.text};
    border-color: color-mix(in srgb, ${(props) => props.theme.colors.accent} 35%, ${(props) => props.theme.colors.border});
    background: color-mix(in srgb, ${(props) => props.theme.colors.accent} 10%, ${(props) => props.theme.colors.panelSoft});
  }
  .web-benchmark-series-toggle__swatch,
  .web-benchmark-legend__swatch {
    width: 12px;
    height: 12px;
    border-radius: 999px;
    flex: 0 0 auto;
  }
  .web-benchmark-chart__axis {
    fill: none;
    stroke: rgba(124, 160, 224, 0.24);
    stroke-width: 1;
  }
  .web-benchmark-chart__line {
    fill: none;
    stroke-width: 3;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .web-benchmark-chart__dot {
    stroke: #07111f;
    stroke-width: 2;
  }
  .web-benchmark-legend {
    display: grid;
    gap: 12px;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  }
  .web-benchmark-legend__item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 14px;
    border-radius: 16px;
    border: 1px solid ${(props) => props.theme.colors.border};
    background: ${(props) => props.theme.colors.panelSoft};
  }
  .web-benchmark-group {
    display: grid;
    gap: 14px;
    padding: 16px;
    border-radius: 18px;
    border: 1px solid ${(props) => props.theme.colors.border};
    background: ${(props) => props.theme.colors.panelSoft};
  }
  .web-benchmark-metadata {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 2px;
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
  .web-shell--operations {
    padding: 14px;
  }
  .web-shell--operations .web-shell__header {
    max-width: 1600px;
    min-height: 58px;
    margin-bottom: 12px;
    padding: 8px 12px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    background: rgba(10, 18, 32, 0.96);
    box-shadow: 0 12px 36px rgba(2, 8, 20, 0.32);
  }
  .web-shell--operations .web-shell__header > div:first-child {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .web-shell--operations .web-shell__eyebrow {
    width: 32px;
    height: 32px;
    margin: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 9px;
    color: ${(props) => props.theme.colors.accent};
    background: ${(props) => props.theme.colors.accentSoft};
    font-weight: 800;
  }
  .web-shell--operations .web-shell__title {
    margin: 0;
    font-size: 1rem;
    line-height: 1;
  }
  .web-shell--operations .web-shell__toolbar {
    width: auto;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .web-shell--operations .web-shell__nav {
    padding: 3px;
    border-radius: 10px;
  }
  .web-shell--operations .web-shell__nav-link {
    min-height: 34px;
    padding: 0 12px;
    border-radius: 8px;
    font-size: 0.82rem;
  }
  .web-shell--operations .web-shell__identity {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0;
    border: 0;
    background: transparent;
    box-shadow: none;
  }
  .web-shell--operations .web-shell__identity-kicker,
  .web-shell--operations .web-shell__identity-meta {
    display: none;
  }
  .web-shell--operations .web-shell__identity-label {
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.82rem;
  }
  .web-shell--operations .web-shell__identity-action {
    margin: 0;
    padding: 7px 10px;
    border-radius: 9px;
    font-size: 0.78rem;
  }
  .web-shell--operations .web-shell__main {
    max-width: 1600px;
    gap: 12px;
  }
  .web-pill--benchmark {
    background: color-mix(in srgb, ${(props) => props.theme.colors.accent} 16%, transparent);
    color: ${(props) => props.theme.colors.accent};
    border-color: color-mix(in srgb, ${(props) => props.theme.colors.accent} 30%, transparent);
  }
  .web-pill--coverage {
    background: color-mix(in srgb, #b49cff 16%, transparent);
    color: #c8b8ff;
    border-color: color-mix(in srgb, #b49cff 30%, transparent);
  }
  .operations-overview {
    display: grid;
    grid-template-columns: 210px minmax(0, 1fr);
    align-items: start;
    min-height: calc(100vh - 96px);
    border: 1px solid ${(props) => props.theme.colors.border};
    border-radius: 16px;
    overflow: hidden;
    background: rgba(8, 15, 28, 0.84);
    box-shadow: ${(props) => props.theme.shadow};
  }
  .operations-overview--inspecting {
    grid-template-columns: 210px minmax(0, 1fr) 300px;
  }
  .operations-overview--rail-collapsed {
    grid-template-columns: 48px minmax(0, 1fr);
  }
  .operations-overview--rail-collapsed.operations-overview--inspecting {
    grid-template-columns: 48px minmax(0, 1fr) 300px;
  }
  .operations-kicker {
    margin: 0;
    color: ${(props) => props.theme.colors.muted};
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }
  .operations-rail {
    min-width: 0;
    min-height: calc(100vh - 96px);
    padding: 14px 10px;
    border-right: 1px solid ${(props) => props.theme.colors.border};
    background: rgba(7, 13, 24, 0.72);
  }
  .operations-rail__heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 6px 10px;
  }
  .operations-rail__heading > span {
    color: ${(props) => props.theme.colors.muted};
    font-size: 0.75rem;
  }
  .operations-rail__collapse,
  .operations-rail__dismiss,
  .operations-project-chooser {
    border: 1px solid ${(props) => props.theme.colors.border};
    border-radius: 6px;
    background: transparent;
    color: ${(props) => props.theme.colors.muted};
    font: inherit;
    cursor: pointer;
  }
  .operations-rail__collapse,
  .operations-rail__dismiss {
    width: 24px;
    height: 24px;
    padding: 0;
  }
  .operations-rail__dismiss,
  .operations-project-chooser,
  .operations-rail-backdrop { display: none; }
  .operations-rail--collapsed {
    padding-inline: 6px;
  }
  .operations-rail--collapsed .operations-rail__heading {
    display: grid;
    justify-items: center;
    gap: 8px;
    padding-inline: 0;
  }
  .operations-rail--collapsed .operations-rail__search,
  .operations-rail--collapsed .operations-projects,
  .operations-rail--collapsed .operations-rail__heading > span { display: none; }
  .operations-projects {
    display: grid;
    gap: 3px;
  }
  .operations-project {
    width: 100%;
    display: grid;
    gap: 5px;
    padding: 9px 8px;
    border: 1px solid transparent;
    border-radius: 9px;
    background: transparent;
    color: ${(props) => props.theme.colors.text};
    text-align: left;
    font: inherit;
    cursor: pointer;
  }
  .operations-project:hover {
    background: rgba(107, 178, 255, 0.07);
  }
  .operations-project--active {
    border-color: rgba(107, 178, 255, 0.25);
    background: rgba(107, 178, 255, 0.12);
  }
  .operations-project__name {
    overflow: hidden;
    color: inherit;
    font-size: 0.84rem;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .operations-project__meta {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    color: ${(props) => props.theme.colors.muted};
    font-size: 0.7rem;
  }
  .operations-project__meta .web-pill {
    padding: 2px 5px;
    font-size: 0.58rem;
  }
  .operations-rail__search {
    display: block;
    margin: 0 2px 8px;
  }
  .operations-rail__search input,
  .operations-command-search input,
  .operations-status-filter select {
    width: 100%;
    min-height: 32px;
    padding: 0 9px;
    border: 1px solid ${(props) => props.theme.colors.border};
    border-radius: 7px;
    outline: none;
    background: rgba(5, 11, 21, 0.78);
    color: ${(props) => props.theme.colors.text};
    font: inherit;
    font-size: 0.74rem;
  }
  .operations-rail__search input:focus,
  .operations-command-search input:focus,
  .operations-status-filter select:focus {
    border-color: ${(props) => props.theme.colors.accent};
    box-shadow: 0 0 0 2px rgba(107, 178, 255, 0.12);
  }
  .operations-rail__empty {
    margin: 8px;
    color: ${(props) => props.theme.colors.muted};
    font-size: 0.72rem;
  }
  .operations-project__distribution {
    height: 3px;
    display: flex;
    overflow: hidden;
    border-radius: 2px;
    background: rgba(124, 160, 224, 0.1);
  }
  .operations-project__distribution-pass { background: ${(props) => props.theme.colors.success}; }
  .operations-project__distribution-fail { background: ${(props) => props.theme.colors.danger}; }
  .operations-project__distribution-other { background: ${(props) => props.theme.colors.warning}; }
  .operations-workspace {
    min-width: 0;
  }
  .operations-toolbar {
    min-height: 72px;
    display: flex;
    align-items: center;
    gap: 18px;
    padding: 10px 14px;
    border-bottom: 1px solid ${(props) => props.theme.colors.border};
    background: rgba(12, 21, 37, 0.88);
  }
  .operations-toolbar__title {
    min-width: 160px;
  }
  .operations-command-search {
    position: relative;
    flex: 1 1 240px;
    max-width: 420px;
  }
  .operations-command-search input { padding-right: 40px; }
  .operations-command-search kbd {
    position: absolute;
    top: 6px;
    right: 7px;
    padding: 2px 4px;
    border: 1px solid ${(props) => props.theme.colors.border};
    border-radius: 4px;
    color: ${(props) => props.theme.colors.muted};
    font-size: 0.6rem;
  }
  .operations-window-disclosure {
    margin: 0;
    padding: 7px 14px;
    border-bottom: 1px solid ${(props) => props.theme.colors.border};
    color: ${(props) => props.theme.colors.muted};
    font-size: 0.68rem;
  }
  .operations-status-filter {
    flex: 0 0 118px;
  }
  .operations-live {
    display: flex;
    align-items: center;
    gap: 4px;
    color: ${(props) => props.theme.colors.success};
    font-size: 0.68rem;
    white-space: nowrap;
  }
  .operations-live::before {
    width: 6px;
    height: 6px;
    content: '';
    border-radius: 50%;
    background: currentColor;
  }
  .operations-live--stale { color: ${(props) => props.theme.colors.warning}; }
  .operations-live button,
  .operations-text-button {
    padding: 3px 5px;
    border: 0;
    background: transparent;
    color: ${(props) => props.theme.colors.accent};
    font: inherit;
    font-size: 0.66rem;
    cursor: pointer;
  }
  .operations-summary-strip {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    border-bottom: 1px solid ${(props) => props.theme.colors.border};
    background: rgba(9, 17, 30, 0.58);
  }
  .operations-summary-strip__item {
    display: grid;
    gap: 3px;
    min-width: 0;
    padding: 11px 14px;
    border-right: 1px solid ${(props) => props.theme.colors.border};
  }
  .operations-summary-strip__item:last-child { border-right: 0; }
  .operations-summary-strip__label {
    color: ${(props) => props.theme.colors.muted};
    font-size: 0.63rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .operations-summary-strip__value {
    overflow: hidden;
    font-family: "SFMono-Regular", "SFMono", "Menlo", "Consolas", monospace;
    font-size: 1.25rem;
    font-variant-numeric: tabular-nums;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .operations-summary-strip__detail {
    overflow: hidden;
    color: ${(props) => props.theme.colors.muted};
    font-size: 0.65rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .operations-active-filters {
    min-height: 34px;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 14px;
    border-bottom: 1px solid ${(props) => props.theme.colors.border};
    color: ${(props) => props.theme.colors.muted};
    font-size: 0.68rem;
  }
  .operations-active-filters button {
    padding: 4px 7px;
    border: 1px solid ${(props) => props.theme.colors.border};
    border-radius: 999px;
    background: rgba(107, 178, 255, 0.08);
    color: ${(props) => props.theme.colors.text};
    font: inherit;
    font-size: 0.66rem;
    cursor: pointer;
  }
  .operations-analysis-band {
    display: grid;
    grid-template-columns: minmax(0, 1.7fr) minmax(260px, 1fr);
    border-bottom: 1px solid ${(props) => props.theme.colors.border};
  }
  .operations-analysis-panel {
    min-width: 0;
    padding: 10px 14px;
  }
  .operations-analysis-panel + .operations-analysis-panel { border-left: 1px solid ${(props) => props.theme.colors.border}; }
  .operations-analysis-panel__heading {
    min-height: 32px;
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 8px;
  }
  .operations-analysis-panel__heading h3 {
    margin: 2px 0 0;
    font-size: 0.86rem;
  }
  .operations-analysis-panel__heading > span,
  .operations-analysis-panel__legend,
  .operations-analysis-panel__empty {
    color: ${(props) => props.theme.colors.muted};
    font-size: 0.65rem;
  }
  .operations-activity__scroll { overflow: auto hidden; }
  .operations-activity__table {
    width: 100%;
    min-width: 620px;
    border-collapse: separate;
    border-spacing: 3px;
  }
  .operations-activity__table th {
    max-width: 90px;
    overflow: hidden;
    color: ${(props) => props.theme.colors.muted};
    font-size: 0.55rem;
    font-weight: 600;
    text-align: center;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .operations-activity__table th:first-child {
    width: 96px;
    text-align: left;
  }
  .operations-activity__table td { padding: 0; text-align: center; }
  .operations-activity__cell,
  .operations-activity__empty {
    width: 22px;
    height: 22px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid transparent;
    border-radius: 4px;
    color: ${(props) => props.theme.colors.text};
    font: inherit;
    font-size: 0.6rem;
    font-weight: 800;
  }
  button.operations-activity__cell { cursor: pointer; }
  .operations-activity__cell--passed { background: rgba(78, 227, 139, 0.18); color: ${(props) => props.theme.colors.success}; border-color: rgba(78, 227, 139, 0.28); }
  .operations-activity__cell--failed { background: rgba(255, 111, 143, 0.2); color: ${(props) => props.theme.colors.danger}; border-color: rgba(255, 111, 143, 0.32); }
  .operations-activity__cell--benchmark { background: rgba(107, 178, 255, 0.2); color: ${(props) => props.theme.colors.accent}; border-color: rgba(107, 178, 255, 0.32); }
  .operations-activity__cell--coverage { background: rgba(180, 156, 255, 0.2); color: #c8b8ff; border-color: rgba(180, 156, 255, 0.32); }
  .operations-activity__cell--partial,
  .operations-activity__cell--warning,
  .operations-activity__cell--unknown,
  .operations-activity__cell--skipped { background: rgba(247, 197, 90, 0.14); color: ${(props) => props.theme.colors.warning}; border-color: rgba(247, 197, 90, 0.26); }
  .operations-activity__cell--selected { box-shadow: 0 0 0 2px ${(props) => props.theme.colors.accent}; }
  .operations-activity__empty { color: rgba(153, 169, 196, 0.28); }
  .operations-coverage-chart svg {
    width: 100%;
    height: 100px;
    display: block;
    margin-top: 4px;
    overflow: visible;
  }
  .operations-coverage-chart__axis { stroke: rgba(124, 160, 224, 0.18); stroke-width: 1; }
  .operations-coverage-chart__axis-label { fill: ${(props) => props.theme.colors.muted}; font-size: 9px; }
  .operations-coverage-chart__threshold { stroke: ${(props) => props.theme.colors.warning}; stroke-width: 1; stroke-dasharray: 4 4; }
  .operations-coverage-chart__line { fill: none; stroke: ${(props) => props.theme.colors.accent}; stroke-width: 2; vector-effect: non-scaling-stroke; }
  .operations-coverage-chart__point { fill: ${(props) => props.theme.colors.accent}; stroke: #07111f; stroke-width: 1; }
  .operations-toolbar__title h2 {
    max-width: 300px;
    margin: 3px 0 0;
    overflow: hidden;
    font-size: 1.05rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .operations-view-switch {
    display: flex;
    gap: 2px;
    padding: 3px;
    border: 1px solid ${(props) => props.theme.colors.border};
    border-radius: 9px;
    background: rgba(7, 13, 24, 0.72);
  }
  .operations-view-switch__button {
    min-height: 30px;
    padding: 0 10px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: ${(props) => props.theme.colors.muted};
    font: inherit;
    font-size: 0.75rem;
    cursor: pointer;
  }
  .operations-view-switch__button--active {
    background: rgba(107, 178, 255, 0.16);
    color: ${(props) => props.theme.colors.text};
  }
  .operations-toolbar__project-link {
    font-size: 0.76rem;
    white-space: nowrap;
  }
  .operations-feed {
    min-width: 0;
    padding: 0 14px 12px;
  }
  .operations-table {
    margin-top: 0;
    font-size: 0.78rem;
  }
  .operations-table th {
    height: 34px;
    padding: 0 8px;
    font-size: 0.66rem;
    text-align: left;
    vertical-align: middle;
  }
  .operations-table td {
    height: 40px;
    padding: 3px 8px;
    border-top: 1px solid rgba(124, 160, 224, 0.1);
    vertical-align: middle;
  }
  .operations-table__col--run { width: 30%; }
  .operations-table__col--status { width: 96px; }
  .operations-table__col--build { width: 65px; }
  .operations-table__col--branch { width: 95px; }
  .operations-table__col--duration { width: 76px; }
  .operations-table__col--coverage { width: 76px; }
  .operations-table__col--completed { width: 84px; }
  .operations-table__row--selected td {
    background: rgba(107, 178, 255, 0.12);
  }
  .operations-table__entity {
    display: grid;
    gap: 2px;
    min-width: 0;
  }
  .operations-table__run-link {
    overflow: hidden;
    color: ${(props) => props.theme.colors.text};
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .operations-table__run-link:hover,
  .operations-table__link {
    color: ${(props) => props.theme.colors.accent};
  }
  .operations-table__summary,
  .operations-muted {
    overflow: hidden;
    color: ${(props) => props.theme.colors.muted};
    font-size: 0.68rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .operations-table .web-pill {
    padding: 4px 7px;
    font-size: 0.62rem;
  }
  .operations-feed__footer {
    min-height: 46px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    color: ${(props) => props.theme.colors.muted};
    font-size: 0.72rem;
  }
  .operations-feed__footer .web-button {
    padding: 7px 11px;
    font-size: 0.72rem;
  }
  .operations-feed__error {
    color: ${(props) => props.theme.colors.danger};
    font-size: 0.8rem;
  }
  .operations-pagination {
    min-height: 38px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    color: ${(props) => props.theme.colors.muted};
    font-size: 0.68rem;
  }
  .operations-pagination button {
    padding: 4px 7px;
    border: 1px solid ${(props) => props.theme.colors.border};
    border-radius: 5px;
    background: transparent;
    color: ${(props) => props.theme.colors.text};
    font: inherit;
    cursor: pointer;
  }
  .operations-pagination button:disabled { opacity: 0.4; cursor: default; }
  .operations-inspector {
    position: sticky;
    top: 0;
    min-width: 0;
    min-height: calc(100vh - 96px);
    padding: 16px;
    border-left: 1px solid ${(props) => props.theme.colors.border};
    background: rgba(9, 17, 30, 0.96);
  }
  .operations-inspector__header {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 12px;
  }
  .operations-inspector__header h2 {
    margin: 5px 0 0;
    font-size: 1.05rem;
  }
  .operations-icon-button {
    width: 30px;
    height: 30px;
    border: 1px solid ${(props) => props.theme.colors.border};
    border-radius: 8px;
    background: transparent;
    color: ${(props) => props.theme.colors.text};
    font: inherit;
    font-size: 1.2rem;
    cursor: pointer;
  }
  .operations-inspector__status {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 18px 0;
    color: ${(props) => props.theme.colors.muted};
    font-size: 0.75rem;
  }
  .operations-inspector__scope-note {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin: -8px 0 14px;
    color: ${(props) => props.theme.colors.warning};
    font-size: 0.68rem;
    line-height: 1.45;
  }
  .operations-inspector__details {
    display: grid;
    grid-template-columns: 78px minmax(0, 1fr);
    gap: 9px 10px;
    margin: 0;
    padding: 14px 0;
    border-top: 1px solid ${(props) => props.theme.colors.border};
    border-bottom: 1px solid ${(props) => props.theme.colors.border};
    font-size: 0.76rem;
  }
  .operations-inspector__details dt {
    color: ${(props) => props.theme.colors.muted};
  }
  .operations-inspector__details dd {
    margin: 0;
    overflow-wrap: anywhere;
  }
  .operations-inspector__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 16px;
  }
  .operations-inspector__actions .web-button {
    padding: 8px 11px;
    font-size: 0.74rem;
  }
  .operations-inspector__action-note {
    flex-basis: 100%;
    color: ${(props) => props.theme.colors.muted};
    font-size: 0.68rem;
  }
  .operations-inspector__evidence {
    display: grid;
    gap: 8px;
    margin-top: 14px;
  }
  .operations-inspector__evidence h3 {
    margin: 0;
    font-size: 0.82rem;
  }
  .operations-inspector__loading,
  .operations-inspector__empty,
  .operations-inspector__file {
    margin: 0;
    color: ${(props) => props.theme.colors.muted};
    font-size: 0.7rem;
  }
  .operations-inspector__error { margin: 0; color: ${(props) => props.theme.colors.danger}; font-size: 0.7rem; }
  .operations-inspector__test-name { font-size: 0.75rem; overflow-wrap: anywhere; }
  .operations-inspector__failure,
  .operations-inspector__stack {
    max-height: 170px;
    margin: 0;
    padding: 9px;
    overflow: auto;
    border: 1px solid ${(props) => props.theme.colors.border};
    border-radius: 6px;
    background: rgba(3, 8, 16, 0.72);
    color: ${(props) => props.theme.colors.text};
    font-family: "SFMono-Regular", "SFMono", "Menlo", "Consolas", monospace;
    font-size: 0.64rem;
    line-height: 1.45;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  @media (max-width: 1180px) {
    .operations-overview--inspecting {
      grid-template-columns: 190px minmax(0, 1fr);
    }
    .operations-overview--inspecting .operations-inspector {
      position: fixed;
      z-index: 20;
      top: 78px;
      right: 14px;
      bottom: 14px;
      width: min(340px, calc(100vw - 28px));
      min-height: 0;
      border: 1px solid ${(props) => props.theme.colors.borderStrong};
      border-radius: 14px;
      box-shadow: ${(props) => props.theme.shadow};
    }
    .operations-toolbar { flex-wrap: wrap; }
    .operations-command-search { order: 3; max-width: none; }
    .operations-analysis-band { grid-template-columns: minmax(0, 1fr); }
    .operations-analysis-panel + .operations-analysis-panel { border-left: 0; border-top: 1px solid ${(props) => props.theme.colors.border}; }
  }
  @media (max-width: 1080px) {
    .operations-overview,
    .operations-overview--inspecting,
    .operations-overview--rail-collapsed,
    .operations-overview--rail-collapsed.operations-overview--inspecting {
      grid-template-columns: minmax(0, 1fr);
    }
    .operations-rail {
      position: fixed;
      z-index: 32;
      inset: 78px auto 8px 8px;
      width: min(310px, calc(100vw - 40px));
      min-height: 0;
      padding: 12px 10px;
      overflow-y: auto;
      border: 1px solid ${(props) => props.theme.colors.borderStrong};
      border-radius: 10px;
      background: #08111e;
      box-shadow: ${(props) => props.theme.shadow};
      transform: translateX(calc(-100% - 20px));
      transition: transform 140ms ease;
    }
    .operations-rail--open { transform: translateX(0); }
    .operations-rail__heading,
    .operations-rail--collapsed .operations-rail__heading { display: flex; }
    .operations-rail__collapse { display: none; }
    .operations-rail__dismiss { display: inline-grid; place-items: center; margin-left: 4px; }
    .operations-rail--collapsed .operations-rail__search,
    .operations-rail--collapsed .operations-projects { display: grid; }
    .operations-projects { display: grid; gap: 3px; }
    .operations-project { min-width: 0; width: 100%; }
    .operations-project-chooser { display: inline-flex; min-height: 30px; align-items: center; padding: 0 8px; }
    .operations-rail-backdrop {
      position: fixed;
      z-index: 31;
      inset: 0;
      display: block;
      border: 0;
      background: rgba(0, 0, 0, 0.48);
    }
  }
  @media (max-width: 900px) {
    .web-shell--operations .web-shell__header {
      flex-wrap: wrap;
    }
    .web-shell--operations .web-shell__toolbar {
      margin-left: auto;
    }
    .web-shell--operations .web-shell__identity-label {
      display: none;
    }
    .operations-toolbar {
      flex-wrap: wrap;
      gap: 8px 14px;
    }
    .operations-summary-strip { grid-template-columns: repeat(5, minmax(120px, 1fr)); overflow: auto hidden; }
  }
  @media (max-width: 660px) {
    .web-shell--operations { padding: 8px; }
    .web-shell--operations .web-shell__header { margin-bottom: 8px; }
    .web-shell--operations .web-shell__nav-link { padding: 0 9px; }
    .web-shell--operations .web-shell__identity { display: none; }
    .operations-toolbar { padding: 9px 10px; }
    .operations-toolbar__title { min-width: 0; margin-right: auto; }
    .operations-toolbar__project-link { display: none; }
    .operations-command-search { flex-basis: 100%; order: 4; }
    .operations-status-filter { flex-basis: 112px; }
    .operations-live { width: 100%; order: 5; }
    .operations-summary-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); overflow: visible; }
    .operations-summary-strip__item:nth-child(5) { grid-column: 1 / -1; }
    .operations-summary-strip__item { padding: 9px 10px; }
    .operations-analysis-panel { padding: 9px 8px; }
    .operations-feed { padding: 0 8px 8px; }
    .operations-table__branch,
    .operations-table__duration,
    .operations-table__coverage,
    .operations-table__col--branch,
    .operations-table__col--duration,
    .operations-table__col--coverage,
    .operations-table th:nth-child(4),
    .operations-table th:nth-child(5),
    .operations-table th:nth-child(6) { display: none; }
    .operations-table__col--run { width: auto; }
    .operations-table__col--status { width: 88px; }
    .operations-table__col--build { width: 58px; }
    .operations-table__col--completed { width: 72px; }
    .operations-table th,
    .operations-table td { padding-left: 5px; padding-right: 5px; }
    .operations-overview--inspecting .operations-inspector {
      top: auto;
      left: 8px;
      right: 8px;
      bottom: 8px;
      width: auto;
      max-height: 72vh;
      overflow-y: auto;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .operations-rail { transition: none; }
  }
  @media (min-width: 900px) {
    .web-shell__header {
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: start;
    }
    .web-shell__toolbar {
      justify-items: end;
    }
    .web-shell__nav {
      justify-content: flex-end;
    }
    .web-shell__identity {
      justify-items: end;
      text-align: right;
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
  const session = pageProps.session || null;
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
    if (typeof window === 'undefined') {
      return;
    }

    setClientServerPageProfile(pageProps.pageProfile || null);
  }, [pageProps.pageProfile]);

  React.useEffect(() => {
    const handleRouteChangeStart = (url) => {
      beginClientRouteProfile(url, {
        sourceRoute: router.asPath,
      });
      recordClientRouteStage('routeChangeStart', { url });
    };

    const handleBeforeHistoryChange = (url) => {
      recordClientRouteStage('beforeHistoryChange', { url });
    };

    const handleRouteChangeComplete = (url) => {
      recordClientRouteStage('routeChangeComplete', { url });
      completeClientRouteProfile(url);
      if (gaMeasurementId) {
        pageview(url);
      }
    };

    const handleRouteChangeError = (error, url) => {
      failClientRouteProfile(url, error);
    };

    router.events.on('routeChangeStart', handleRouteChangeStart);
    router.events.on('beforeHistoryChange', handleBeforeHistoryChange);
    router.events.on('routeChangeComplete', handleRouteChangeComplete);
    router.events.on('routeChangeError', handleRouteChangeError);
    return () => {
      router.events.off('routeChangeStart', handleRouteChangeStart);
      router.events.off('beforeHistoryChange', handleBeforeHistoryChange);
      router.events.off('routeChangeComplete', handleRouteChangeComplete);
      router.events.off('routeChangeError', handleRouteChangeError);
    };
  }, [gaMeasurementId, router]);

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
        { viewer, session },
        React.createElement(Component, pageProps),
      ),
    ),
  );
}

export default function WebApp({ Component, ...rest }) {
  const { store, props } = wrapper.useWrappedStore(rest);
  const client = getApolloClient();
  const pageProps = props.pageProps || {};

  return React.createElement(
    ApolloProvider,
    { client },
    React.createElement(
      Provider,
      { store },
      React.createElement(
        WebAppContent,
        { Component, pageProps },
      ),
    ),
  );
}
