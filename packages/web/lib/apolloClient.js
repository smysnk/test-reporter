import { ApolloClient, HttpLink, InMemoryCache, ApolloLink, from } from '@apollo/client';
import { onError } from '@apollo/client/link/error';
import { extractTraceContextFromHeaders, readHeaderValue } from '../../../config/request-trace.mjs';
import { handleUnauthorizedApolloError } from './authErrors.js';
import { createClientRequestTrace, recordClientRequestTrace } from './pageProfiling.js';

const GRAPHQL_URL = process.env.NEXT_PUBLIC_GRAPHQL_PATH || '/graphql';

let apolloClient;

export function getApolloClient() {
  if (typeof window === 'undefined') {
    return createApolloClient();
  }

  if (!apolloClient) {
    apolloClient = createApolloClient();
  }

  return apolloClient;
}

function createApolloClient() {
  const httpLink = new HttpLink({
    uri: GRAPHQL_URL,
    credentials: 'include',
    fetch: createTracedFetch(),
  });

  const errorLink = onError(({ graphQLErrors, networkError, operation }) => {
    if (graphQLErrors?.length || networkError) {
      console.error('GraphQL request failed', {
        operationName: operation?.operationName || null,
        graphQLErrors,
        networkError: networkError?.message || null,
      });
      handleUnauthorizedApolloError({ graphQLErrors, networkError });
    }
  });

  const requestMetadataLink = new ApolloLink((operation, forward) => {
    operation.setContext(({ headers = {} }) => ({
      headers: {
        ...headers,
        'x-test-station-web': '1',
      },
    }));
    return forward(operation);
  });

  return new ApolloClient({
    link: from([errorLink, requestMetadataLink, httpLink]),
    cache: new InMemoryCache(),
  });
}

function createTracedFetch() {
  return async function tracedFetch(input, init = {}) {
    const requestTrace = createClientRequestTrace({
      kind: 'graphql-proxy',
      url: typeof input === 'string' ? input : input?.url || GRAPHQL_URL,
    });
    const response = await fetch(input, {
      ...init,
      headers: {
        ...(init.headers || {}),
        ...(requestTrace?.headers || {}),
      },
    });

    if (requestTrace) {
      recordClientRequestTrace({
        type: 'fetch',
        target: typeof input === 'string' ? input : input?.url || GRAPHQL_URL,
        requestTrace: requestTrace.traceContext,
        responseTrace: extractTraceContextFromHeaders(response.headers),
        upstreamRequestId: readHeaderValue(response.headers, 'x-test-station-upstream-request-id'),
        upstreamTraceId: readHeaderValue(response.headers, 'x-test-station-upstream-trace-id'),
        upstreamParentRequestId: readHeaderValue(response.headers, 'x-test-station-upstream-parent-request-id'),
        serverTiming: readHeaderValue(response.headers, 'server-timing'),
        status: response.status,
        ok: response.ok,
      });
    }

    return response;
  };
}
