import { ModelRouterEmbeddingModel } from '@mastra/core/llm';

const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'ollama/nomic-embed-text';

let model: ModelRouterEmbeddingModel | null = null;

function getModel(): ModelRouterEmbeddingModel {
  if (!model) {
    model = new ModelRouterEmbeddingModel(EMBEDDING_MODEL);
  }
  return model;
}

export async function getEmbedding(text: string): Promise<number[]> {
  const m = getModel();
  const result = await m.doEmbed({ values: [text] });
  return result.embeddings[0]!;
}

export async function getEmbeddings(texts: string[]): Promise<number[][]> {
  const m = getModel();
  const result = await m.doEmbed({ values: texts });
  return result.embeddings;
}
