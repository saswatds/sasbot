import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getEmbedding } from '../lib/embed';
import { getQdrant, COLLECTION_NAME } from '../lib/qdrant';

export const semanticSearch = createTool({
  id: 'semantic-search',
  description: 'Search the knowledge base for relevant information using semantic similarity. Use this when the user asks a question that might be answered by stored documents, notes, or ingested content.',
  inputSchema: z.object({
    query: z.string().describe('The search query in natural language'),
    topK: z.number().optional().describe('Number of results to return (default 5)'),
  }),
  execute: async (input) => {
    const queryVector = await getEmbedding(input.query);
    const qdrant = getQdrant();
    const results = await qdrant.query({
      indexName: COLLECTION_NAME,
      queryVector,
      topK: input.topK || 5,
      includeVector: false,
    });
    return {
      results: results.map((r) => ({
        score: r.score,
        content: r.metadata?.content || '',
        source: r.metadata?.source || 'unknown',
        title: r.metadata?.title || '',
        ...Object.fromEntries(
          Object.entries(r.metadata || {}).filter(
            ([k]) => !['content', 'source', 'title'].includes(k),
          ),
        ),
      })),
      count: results.length,
    };
  },
});

export const ingestDocument = createTool({
  id: 'ingest-document',
  description: 'Store a document or piece of text in the knowledge base for future retrieval. Use this to save important information that should be searchable later.',
  inputSchema: z.object({
    content: z.string().describe('The text content to store'),
    title: z.string().optional().describe('Title or label for the document'),
    source: z.string().optional().describe('Source of the content (e.g. "manual", "web", "chat")'),
    metadata: z
      .record(z.string(), z.unknown())
      .optional()
      .describe('Additional metadata to attach'),
  }),
  execute: async (input) => {
    const vector = await getEmbedding(input.content);
    const qdrant = getQdrant();
    const ids = await qdrant.upsert({
      indexName: COLLECTION_NAME,
      vectors: [vector],
      metadata: [
        {
          content: input.content,
          title: input.title || '',
          source: input.source || 'manual',
          ingestedAt: new Date().toISOString(),
          ...input.metadata,
        },
      ],
    });
    return { ingested: true, id: ids[0] };
  },
});
