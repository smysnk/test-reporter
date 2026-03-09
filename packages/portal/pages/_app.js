import React from 'react';
import { ApolloProvider } from '@apollo/client';
import { SessionProvider } from 'next-auth/react';
import { Provider } from 'react-redux';
import { ThemeProvider, createGlobalStyle } from 'styled-components';
import { PortalShell } from '../components/PortalShell.js';
import { getApolloClient } from '../lib/apolloClient.js';
import { wrapper } from '../store/index.js';

const theme = {
  colors: {
    background: '#f3efe6',
    panel: '#fffaf3',
    border: '#d6c9b2',
    text: '#1e1a16',
    muted: '#6f6558',
    accent: '#ad4f2d',
    accentSoft: '#f5d2c2',
  },
  shadow: '0 20px 60px rgba(75, 48, 26, 0.12)',
  radius: '24px',
  font: '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif',
};

const GlobalStyle = createGlobalStyle`
  * { box-sizing: border-box; }
  html, body, #__next { min-height: 100%; }
  body {
    margin: 0;
    background:
      radial-gradient(circle at top left, rgba(173, 79, 45, 0.18), transparent 28%),
      linear-gradient(180deg, #f9f4ec 0%, #f3efe6 52%, #efe8dc 100%);
    color: ${(props) => props.theme.colors.text};
    font-family: ${(props) => props.theme.font};
  }
  a {
    color: ${(props) => props.theme.colors.accent};
    text-decoration: none;
  }
  .portal-shell {
    min-height: 100vh;
    padding: 32px;
  }
  .portal-shell__header,
  .portal-card {
    border: 1px solid ${(props) => props.theme.colors.border};
    background: ${(props) => props.theme.colors.panel};
    border-radius: ${(props) => props.theme.radius};
    box-shadow: ${(props) => props.theme.shadow};
  }
  .portal-shell__header {
    display: grid;
    gap: 20px;
    padding: 28px;
    margin: 0 auto 24px;
    max-width: 1120px;
  }
  .portal-shell__eyebrow {
    margin: 0 0 8px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: ${(props) => props.theme.colors.muted};
    font-size: 0.75rem;
  }
  .portal-shell__title {
    margin: 0 0 10px;
    font-size: clamp(2rem, 5vw, 3.6rem);
    line-height: 0.95;
  }
  .portal-shell__copy {
    margin: 0;
    max-width: 64ch;
    color: ${(props) => props.theme.colors.muted};
    line-height: 1.6;
  }
  .portal-shell__nav {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
  }
  .portal-shell__nav a {
    padding: 10px 14px;
    border-radius: 999px;
    background: ${(props) => props.theme.colors.accentSoft};
    font-size: 0.95rem;
  }
  .portal-shell__main {
    max-width: 1120px;
    margin: 0 auto;
    display: grid;
    gap: 24px;
  }
  .portal-card {
    padding: 28px;
  }
  .portal-card--compact {
    padding: 22px;
  }
  .portal-card__eyebrow {
    margin: 0 0 10px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: ${(props) => props.theme.colors.muted};
    font-size: 0.72rem;
  }
  .portal-card__title {
    margin: 0 0 10px;
    font-size: 1.8rem;
  }
  .portal-card__copy {
    margin: 0;
    color: ${(props) => props.theme.colors.muted};
    line-height: 1.6;
  }
  .portal-shell__toolbar {
    display: grid;
    gap: 16px;
    justify-items: start;
  }
  .portal-meta {
    display: grid;
    gap: 12px;
    margin-top: 24px;
  }
  .portal-meta__item {
    display: grid;
    gap: 4px;
    padding-top: 12px;
    border-top: 1px solid ${(props) => props.theme.colors.border};
  }
  .portal-meta__label {
    color: ${(props) => props.theme.colors.muted};
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .portal-grid {
    display: grid;
    gap: 24px;
  }
  .portal-grid--two {
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  }
  .portal-metrics {
    display: grid;
    gap: 16px;
    margin-top: 24px;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  }
  .portal-metric {
    display: grid;
    gap: 6px;
    padding: 18px;
    border-radius: 18px;
    background: rgba(173, 79, 45, 0.08);
    border: 1px solid rgba(173, 79, 45, 0.16);
  }
  .portal-metric__label {
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: ${(props) => props.theme.colors.muted};
  }
  .portal-metric__value {
    font-size: 1.6rem;
  }
  .portal-metric__copy {
    color: ${(props) => props.theme.colors.muted};
    font-size: 0.9rem;
  }
  .portal-list {
    display: grid;
    gap: 14px;
    margin-top: 22px;
  }
  .portal-list__item {
    display: grid;
    gap: 8px;
    padding: 18px;
    border-radius: 18px;
    border: 1px solid ${(props) => props.theme.colors.border};
    background: rgba(255, 255, 255, 0.35);
  }
  .portal-list__row {
    display: flex;
    gap: 12px;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
  }
  .portal-list__title {
    font-size: 1.1rem;
  }
  .portal-list__meta {
    color: ${(props) => props.theme.colors.muted};
    font-size: 0.92rem;
  }
  .portal-pill {
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
  .portal-pill--passed,
  .portal-pill--covered {
    background: rgba(64, 136, 91, 0.12);
    color: #2f6f45;
    border-color: rgba(64, 136, 91, 0.2);
  }
  .portal-pill--failed {
    background: rgba(173, 79, 45, 0.12);
    color: #9a3b1a;
    border-color: rgba(173, 79, 45, 0.24);
  }
  .portal-pill--unknown,
  .portal-pill--skipped {
    background: rgba(111, 101, 88, 0.12);
    color: ${(props) => props.theme.colors.muted};
    border-color: rgba(111, 101, 88, 0.18);
  }
  .portal-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 20px;
    font-size: 0.96rem;
  }
  .portal-table th,
  .portal-table td {
    padding: 12px 0;
    border-bottom: 1px solid ${(props) => props.theme.colors.border};
    text-align: left;
    vertical-align: top;
  }
  .portal-table th {
    color: ${(props) => props.theme.colors.muted};
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .portal-inline-list {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .portal-inline-list__item,
  .portal-chip {
    display: inline-flex;
    align-items: center;
    padding: 6px 10px;
    border-radius: 999px;
    background: rgba(30, 26, 22, 0.06);
    color: ${(props) => props.theme.colors.text};
    font-size: 0.84rem;
  }
  .portal-kv {
    display: grid;
    gap: 12px;
    margin-top: 20px;
  }
  .portal-kv__item {
    display: grid;
    gap: 4px;
  }
  .portal-kv__label {
    font-size: 0.75rem;
    color: ${(props) => props.theme.colors.muted};
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .portal-empty {
    margin-top: 18px;
    padding: 18px;
    border-radius: 18px;
    background: rgba(111, 101, 88, 0.08);
    border: 1px dashed ${(props) => props.theme.colors.border};
  }
  .portal-empty__title {
    display: block;
    margin-bottom: 8px;
  }
  .portal-empty__copy {
    margin: 0;
    color: ${(props) => props.theme.colors.muted};
  }
  .portal-shell__identity {
    display: grid;
    gap: 4px;
    justify-items: start;
  }
  .portal-shell__identity-label {
    font-weight: 700;
  }
  .portal-shell__identity-meta {
    color: ${(props) => props.theme.colors.muted};
    font-size: 0.9rem;
  }
  .portal-button {
    border: 1px solid ${(props) => props.theme.colors.accent};
    background: ${(props) => props.theme.colors.accent};
    color: #fff8f3;
    border-radius: 999px;
    padding: 10px 16px;
    font: inherit;
  }
  .portal-button--primary {
    width: 100%;
    justify-content: center;
  }
  .portal-button--ghost {
    background: transparent;
    color: ${(props) => props.theme.colors.accent};
  }
  .portal-auth {
    max-width: 760px;
    margin: 0 auto;
  }
  .portal-auth__providers,
  .portal-auth__form {
    display: grid;
    gap: 14px;
    margin-top: 24px;
  }
  .portal-field {
    display: grid;
    gap: 6px;
  }
  .portal-field__label {
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: ${(props) => props.theme.colors.muted};
  }
  .portal-field__input {
    border: 1px solid ${(props) => props.theme.colors.border};
    border-radius: 14px;
    padding: 12px 14px;
    font: inherit;
    background: #fffdf9;
  }
  .portal-trend-list {
    display: grid;
    gap: 12px;
    margin-top: 20px;
  }
  .portal-trend-list__item {
    display: grid;
    gap: 8px;
  }
  .portal-trend-list__bar {
    height: 10px;
    border-radius: 999px;
    background: rgba(173, 79, 45, 0.12);
    overflow: hidden;
  }
  .portal-trend-list__fill {
    height: 100%;
    background: linear-gradient(90deg, #ad4f2d 0%, #d67f56 100%);
  }
  .portal-stack {
    display: grid;
    gap: 18px;
  }
  .portal-trend-card {
    display: grid;
    gap: 16px;
    padding: 20px;
    border-radius: 20px;
    border: 1px solid ${(props) => props.theme.colors.border};
    background: rgba(255, 255, 255, 0.42);
  }
  .portal-trend-card--compact {
    padding: 18px;
  }
  .portal-trend-card__value {
    font-size: 1.2rem;
  }
  .portal-trend-card__chart {
    width: 100%;
    height: 140px;
  }
  .portal-trend-card__baseline {
    fill: none;
    stroke: rgba(111, 101, 88, 0.24);
    stroke-width: 1;
  }
  .portal-trend-card__line {
    fill: none;
    stroke: ${(props) => props.theme.colors.accent};
    stroke-width: 3;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .portal-trend-card__dot {
    fill: ${(props) => props.theme.colors.accent};
    stroke: #fff8f3;
    stroke-width: 2;
  }
  .portal-trend-card__overlay line {
    stroke: rgba(30, 26, 22, 0.18);
    stroke-dasharray: 3 4;
  }
  .portal-trend-card__overlay circle {
    fill: #fff8f3;
    stroke: ${(props) => props.theme.colors.accent};
    stroke-width: 2;
  }
  .portal-chip--release {
    background: rgba(173, 79, 45, 0.14);
  }
  @media (min-width: 900px) {
    .portal-shell__header {
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: start;
    }
    .portal-shell__toolbar {
      justify-items: end;
    }
  }
`;

export default function PortalApp({ Component, ...rest }) {
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
        React.createElement(
          ThemeProvider,
          { theme },
          React.createElement(
            React.Fragment,
            null,
            React.createElement(GlobalStyle, null),
            React.createElement(
              PortalShell,
              null,
              React.createElement(Component, pageProps),
            ),
          ),
        ),
      ),
    ),
  );
}
