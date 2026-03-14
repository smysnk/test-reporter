export async function executeBrowserGraphql({ query, variables = {}, fetchImpl = fetch }) {
  const response = await fetchImpl('/graphql', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      'x-test-station-web': '1',
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  const payload = await response.json();
  if (!response.ok || Array.isArray(payload.errors) && payload.errors.length > 0) {
    const message = Array.isArray(payload.errors) && payload.errors.length > 0
      ? payload.errors[0].message
      : `GraphQL request failed with status ${response.status}`;
    const error = new Error(message);
    error.statusCode = response.status;
    error.payload = payload;
    throw error;
  }

  return payload.data || {};
}
