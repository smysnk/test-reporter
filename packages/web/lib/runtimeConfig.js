function normalizeEnvValue(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function resolveWebGraphqlPath() {
  return normalizeEnvValue(process.env.WEB_GRAPHQL_PATH) || '/graphql';
}

export function resolveGaMeasurementId() {
  return normalizeEnvValue(process.env.GA_MEASUREMENT_ID) || null;
}

export function resolvePublicRuntimeConfig() {
  return {
    graphqlPath: resolveWebGraphqlPath(),
    GA_MEASUREMENT_ID: resolveGaMeasurementId(),
  };
}
