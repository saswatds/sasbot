/**
 * sasbot - Webhook Ingestion Server
 *
 * An HTTP server that receives webhook events and ingests data
 * into your knowledge stores.
 *
 * Environment variables available:
 *   PORT - Server port (default: 3001)
 *   QDRANT_URL - Qdrant vector database connection URL
 *   NEO4J_URL - Neo4j graph database connection URL
 *   GITHUB_TOKEN - GitHub API token for fetching repository data
 */

const PORT = Number(process.env.PORT || 3001);

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    if (req.method === "GET" && url.pathname === "/health") {
      return new Response("ok");
    }

    if (req.method === "POST" && url.pathname === "/webhook") {
      try {
        const body = await req.json();
        console.log("Webhook received:", JSON.stringify(body).slice(0, 200));

        //
        // TODO: Process the webhook payload and ingest into knowledge stores
        //
        // const qdrantUrl = process.env.QDRANT_URL;
        // Generate embeddings and upsert into Qdrant
        // const neo4jUrl = process.env.NEO4J_URL;
        // Store relationships in Neo4j

        return Response.json({ status: "accepted" }, { status: 202 });
      } catch (error) {
        console.error("Error processing webhook:", error);
        return Response.json({ error: "invalid payload" }, { status: 400 });
      }
    }

    return Response.json({ error: "not found" }, { status: 404 });
  },
});

console.log(`Webhook ingestion server listening on port ${server.port}`);
