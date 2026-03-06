import { createOllama } from 'ollama-ai-provider-v2';

const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'nomic-embed-text';

let provider: ReturnType<typeof createOllama> | null = null;

function getProvider() {
  if (!provider) {
    provider = createOllama({
      baseURL: process.env.OLLAMA_BASE_URL,
    });
  }
  return provider;
}

export async function getEmbedding(text: string): Promise<number[]> {
  const model = getProvider().textEmbeddingModel(EMBEDDING_MODEL);
  const result = await model.doEmbed({ values: [text] });
  return result.embeddings[0]!;
}

export async function getEmbeddings(texts: string[]): Promise<number[][]> {
  const model = getProvider().textEmbeddingModel(EMBEDDING_MODEL);
  const result = await model.doEmbed({ values: texts });
  return result.embeddings;
}
