import env from '../../config/env.mjs';

function resolveDefaultServerUrl() {
  return `http://localhost:${env.get('SERVER_PORT').default(4400).asPortNumber()}`;
}

const nextConfig = {
  compiler: {
    styledComponents: true,
  },
  async rewrites() {
    return [
      {
        source: '/graphql',
        destination: '/api/graphql-proxy',
      },
    ];
  },
  env: {
    NEXT_PUBLIC_GRAPHQL_PATH: env.get('WEB_GRAPHQL_PATH').default('/graphql').asString(),
  },
};

export default nextConfig;
