import { QdrantVector } from '@mastra/qdrant';

let qdrant: QdrantVector | null = null;

export const COLLECTION_NAME = 'sasbot-knowledge';
export const EMBEDDING_DIMENSION = parseInt(process.env.EMBEDDING_DIMENSION || '768', 10);

export function getQdrant(): QdrantVector {
  if (!qdrant) {
    const url = process.env.QDRANT_URL || `http://${process.env.QDRANT_HOST || 'localhost'}:${process.env.QDRANT_PORT || '6333'}`;
    qdrant = new QdrantVector({ id: 'sasbot-qdrant', url });
  }
  return qdrant;
}

export async function ensureCollection() {
  const q = getQdrant();
  const indexes = await q.listIndexes();
  if (!indexes.includes(COLLECTION_NAME)) {
    await q.createIndex({
      indexName: COLLECTION_NAME,
      dimension: EMBEDDING_DIMENSION,
      metric: 'cosine',
    });
  }
}
