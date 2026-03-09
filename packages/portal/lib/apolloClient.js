import { ApolloClient, HttpLink, InMemoryCache, ApolloLink, from } from '@apollo/client';
import { onError } from '@apollo/client/link/error';
import { handleUnauthorizedApolloError } from './authErrors.js';

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
        'x-test-station-portal': '1',
      },
    }));
    return forward(operation);
  });

  return new ApolloClient({
    link: from([errorLink, requestMetadataLink, httpLink]),
    cache: new InMemoryCache(),
  });
}
