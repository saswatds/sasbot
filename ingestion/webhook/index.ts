/**
 * sasbot - Webhook Ingestion Server
 *
 * An HTTP server that receives webhook events and ingests data
 * into Qdrant (vector search) and Neo4j (knowledge graph).
 *
 * Environment variables available:
 *   PORT - Server port (default: 3001)
 *   QDRANT_URL - Qdrant vector database connection URL
 *   NEO4J_URL - Neo4j graph database connection URL
 *   EMBEDDING_MODEL - Ollama embedding model (default: ollama/nomic-embed-text)
 */

import { QdrantVector } from '@mastra/qdrant';
import { createOllama } from 'ollama-ai-provider-v2';
import neo4j from 'neo4j-driver';

const PORT = Number(process.env.PORT || 3001);
const COLLECTION_NAME = 'sasbot-knowledge';
const EMBEDDING_DIMENSION = 768;
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'nomic-embed-text';

// Qdrant setup
const qdrantUrl = process.env.QDRANT_URL || `http://${process.env.QDRANT_HOST || 'localhost'}:${process.env.QDRANT_PORT || '6333'}`;
const qdrant = new QdrantVector({ id: 'ingestion-qdrant', url: qdrantUrl });

// Neo4j setup
const neo4jUrl = process.env.NEO4J_URL || `bolt://${process.env.NEO4J_HOST || 'localhost'}:${process.env.NEO4J_PORT || '7687'}`;
const neo4jDriver = neo4j.driver(neo4jUrl, neo4j.auth.basic(
  process.env.NEO4J_USER || 'neo4j',
  process.env.NEO4J_PASSWORD || 'neo4j',
));

// Ollama embedding
const ollamaProvider = createOllama({
  baseURL: process.env.OLLAMA_BASE_URL,
});

async function getEmbedding(text: string): Promise<number[]> {
  const model = ollamaProvider.textEmbeddingModel(EMBEDDING_MODEL);
  const result = await model.doEmbed({ values: [text] });
  return result.embeddings[0]!;
}

async function ensureCollection() {
  const indexes = await qdrant.listIndexes();
  if (!indexes.includes(COLLECTION_NAME)) {
    await qdrant.createIndex({
      indexName: COLLECTION_NAME,
      dimension: EMBEDDING_DIMENSION,
      metric: 'cosine',
    });
    console.log(`Created Qdrant collection: ${COLLECTION_NAME}`);
  }
}

interface IngestPayload {
  content: string;
  title?: string;
  source?: string;
  metadata?: Record<string, unknown>;
  entities?: Array<{ name: string; type: string; properties?: Record<string, unknown> }>;
  relationships?: Array<{ from: string; fromType: string; to: string; toType: string; type: string }>;
}

async function ingestToQdrant(payload: IngestPayload) {
  const vector = await getEmbedding(payload.content);
  const ids = await qdrant.upsert({
    indexName: COLLECTION_NAME,
    vectors: [vector],
    metadata: [{
      content: payload.content,
      title: payload.title || '',
      source: payload.source || 'webhook',
      ingestedAt: new Date().toISOString(),
      ...payload.metadata,
    }],
  });
  return ids[0];
}

async function ingestToNeo4j(payload: IngestPayload) {
  const session = neo4jDriver.session();
  try {
    // Ingest entities
    if (payload.entities) {
      for (const entity of payload.entities) {
        const props = { name: entity.name, ...entity.properties, updatedAt: new Date().toISOString() };
        await session.run(
          `MERGE (n:\`${entity.type}\` {name: $name}) SET n += $props`,
          { name: entity.name, props },
        );
      }
    }
    // Ingest relationships
    if (payload.relationships) {
      for (const rel of payload.relationships) {
        await session.run(
          `MATCH (a:\`${rel.fromType}\` {name: $from})
           MATCH (b:\`${rel.toType}\` {name: $to})
           MERGE (a)-[r:\`${rel.type}\`]->(b)
           SET r.createdAt = $createdAt`,
          { from: rel.from, to: rel.to, createdAt: new Date().toISOString() },
        );
      }
    }
  } finally {
    await session.close();
  }
}

// Ensure collection on startup
ensureCollection().catch((err) => console.error('Qdrant init error:', err.message));

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    if (req.method === 'GET' && url.pathname === '/health') {
      return new Response('ok');
    }

    // Ingest a document into Qdrant (vector) and optionally Neo4j (graph)
    if (req.method === 'POST' && url.pathname === '/ingest') {
      try {
        const body = (await req.json()) as IngestPayload;
        if (!body.content) {
          return Response.json({ error: 'content is required' }, { status: 400 });
        }

        const vectorId = await ingestToQdrant(body);
        await ingestToNeo4j(body);

        console.log(`Ingested: "${(body.title || body.content).slice(0, 60)}" [${body.source || 'webhook'}]`);
        return Response.json({ status: 'ingested', vectorId }, { status: 201 });
      } catch (error) {
        console.error('Ingestion error:', error);
        return Response.json({ error: 'ingestion failed' }, { status: 500 });
      }
    }

    // Batch ingest multiple documents
    if (req.method === 'POST' && url.pathname === '/ingest/batch') {
      try {
        const body = (await req.json()) as { documents: IngestPayload[] };
        if (!body.documents?.length) {
          return Response.json({ error: 'documents array is required' }, { status: 400 });
        }

        const results = await Promise.allSettled(
          body.documents.map(async (doc) => {
            const vectorId = await ingestToQdrant(doc);
            await ingestToNeo4j(doc);
            return vectorId;
          }),
        );

        const succeeded = results.filter((r) => r.status === 'fulfilled').length;
        const failed = results.filter((r) => r.status === 'rejected').length;
        console.log(`Batch ingested: ${succeeded} succeeded, ${failed} failed`);

        return Response.json({ status: 'batch_ingested', succeeded, failed }, { status: 201 });
      } catch (error) {
        console.error('Batch ingestion error:', error);
        return Response.json({ error: 'batch ingestion failed' }, { status: 500 });
      }
    }

    // Legacy webhook endpoint
    if (req.method === 'POST' && url.pathname === '/webhook') {
      try {
        const body = await req.json();
        console.log('Webhook received:', JSON.stringify(body).slice(0, 200));
        return Response.json({ status: 'accepted' }, { status: 202 });
      } catch (error) {
        console.error('Error processing webhook:', error);
        return Response.json({ error: 'invalid payload' }, { status: 400 });
      }
    }

    return Response.json({ error: 'not found' }, { status: 404 });
  },
});

console.log(`Webhook ingestion server listening on port ${server.port}`);
