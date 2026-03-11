import React from 'react';
import { ApolloProvider } from '@apollo/client';
import { SessionProvider } from 'next-auth/react';
import { Provider } from 'react-redux';
import { ThemeProvider, createGlobalStyle } from 'styled-components';
import { WebShell } from '../components/WebShell.js';
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
  }
  .web-shell__header {
    display: grid;
    gap: 20px;
    padding: 28px;
    margin: 0 auto 24px;
    max-width: 1120px;
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
    font-size: 0.95rem;
  }
  .web-shell__main {
    max-width: 1120px;
    margin: 0 auto;
    display: grid;
    gap: 24px;
  }
  .web-card {
    padding: 28px;
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
  }
  .web-card__copy {
    margin: 0;
    color: ${(props) => props.theme.colors.muted};
    line-height: 1.6;
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
    background: rgba(173, 79, 45, 0.08);
    border: 1px solid rgba(173, 79, 45, 0.16);
  }
  .web-metric__label {
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: ${(props) => props.theme.colors.muted};
  }
  .web-metric__value {
    font-size: 1.6rem;
  }
  .web-metric__copy {
    color: ${(props) => props.theme.colors.muted};
    font-size: 0.9rem;
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
    background: rgba(255, 255, 255, 0.35);
  }
  .web-list__row {
    display: flex;
    gap: 12px;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
  }
  .web-list__title {
    font-size: 1.1rem;
  }
  .web-list__meta {
    color: ${(props) => props.theme.colors.muted};
    font-size: 0.92rem;
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
    background: rgba(64, 136, 91, 0.12);
    color: #2f6f45;
    border-color: rgba(64, 136, 91, 0.2);
  }
  .web-pill--failed {
    background: rgba(173, 79, 45, 0.12);
    color: #9a3b1a;
    border-color: rgba(173, 79, 45, 0.24);
  }
  .web-pill--unknown,
  .web-pill--skipped {
    background: rgba(111, 101, 88, 0.12);
    color: ${(props) => props.theme.colors.muted};
    border-color: rgba(111, 101, 88, 0.18);
  }
  .web-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 20px;
    font-size: 0.96rem;
  }
  .web-table th,
  .web-table td {
    padding: 12px 0;
    border-bottom: 1px solid ${(props) => props.theme.colors.border};
    text-align: left;
    vertical-align: top;
  }
  .web-table th {
    color: ${(props) => props.theme.colors.muted};
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .web-inline-list {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .web-inline-list__item,
  .web-chip {
    display: inline-flex;
    align-items: center;
    padding: 6px 10px;
    border-radius: 999px;
    background: rgba(30, 26, 22, 0.06);
    color: ${(props) => props.theme.colors.text};
    font-size: 0.84rem;
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
    background: rgba(111, 101, 88, 0.08);
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
    color: #fff8f3;
    border-radius: 999px;
    padding: 10px 16px;
    font: inherit;
  }
  .web-button--primary {
    width: 100%;
    justify-content: center;
  }
  .web-button--ghost {
    background: transparent;
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
    background: #fffdf9;
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
    background: rgba(173, 79, 45, 0.12);
    overflow: hidden;
  }
  .web-trend-list__fill {
    height: 100%;
    background: linear-gradient(90deg, #ad4f2d 0%, #d67f56 100%);
  }
  .web-stack {
    display: grid;
    gap: 18px;
  }
  .web-trend-card {
    display: grid;
    gap: 16px;
    padding: 20px;
    border-radius: 20px;
    border: 1px solid ${(props) => props.theme.colors.border};
    background: rgba(255, 255, 255, 0.42);
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
    stroke: rgba(111, 101, 88, 0.24);
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
    stroke: #fff8f3;
    stroke-width: 2;
  }
  .web-trend-card__overlay line {
    stroke: rgba(30, 26, 22, 0.18);
    stroke-dasharray: 3 4;
  }
  .web-trend-card__overlay circle {
    fill: #fff8f3;
    stroke: ${(props) => props.theme.colors.accent};
    stroke-width: 2;
  }
  .web-chip--release {
    background: rgba(173, 79, 45, 0.14);
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
`;

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
        React.createElement(
          ThemeProvider,
          { theme },
          React.createElement(
            React.Fragment,
            null,
            React.createElement(GlobalStyle, null),
            React.createElement(
              WebShell,
              null,
              React.createElement(Component, pageProps),
            ),
          ),
        ),
      ),
    ),
  );
}
