/**
 * Routes a model call through the Astropods LiteLLM gateway.
 *
 * Pass the model alias configured on the gateway (e.g. "claude-sonnet"). The
 * gateway URL and key are read from the env vars injected by the `astro-gateway`
 * provider declared in astropods.yml.
 */
export function astroGateway(model: string) {
  const url = `${process.env.ASTRO_GATEWAY_URL}/v1`;
  const apiKey = process.env.ASTRO_GATEWAY_API_KEY;

  if (!url) throw new Error('ASTRO_GATEWAY_URL is not set');
  if (!apiKey) throw new Error('ASTRO_GATEWAY_API_KEY is not set');

  // Log to track url and api key
  console.log('[-]', url, ' -- ', apiKey);

  return {
    providerId: 'astro',
    modelId: model,
    url,
    apiKey,
  };
}
