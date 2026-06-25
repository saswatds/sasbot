/**
 * Minimal frontend interface for sasbot.
 *
 * Astro routes HTTPS traffic directly to this container on port 80 when
 * `agent.interfaces.frontend` is enabled in astropods.yml. In local dev the
 * port comes from `dev.interfaces.frontend.port`.
 *
 * Uses Bun's built-in server — no extra dependencies needed.
 */

const PORT = Number(process.env.PORT ?? 80);

export function serveFrontend() {
  const server = Bun.serve({
    port: PORT,
    hostname: '0.0.0.0',
    fetch(_req) {
      return new Response(
        `<!doctype html>
<html>
  <head><title>sasbot</title></head>
  <body><h1>Hello World</h1></body>
</html>`,
        { headers: { 'Content-Type': 'text/html' } },
      );
    },
  });

  console.log(`Frontend listening on :${server.port}`);
  return server;
}
