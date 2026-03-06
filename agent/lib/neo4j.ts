import neo4j, { type Driver } from 'neo4j-driver';

let driver: Driver | null = null;

export function getNeo4j(): Driver {
  if (!driver) {
    const url = process.env.NEO4J_URL || `bolt://${process.env.NEO4J_HOST || 'localhost'}:${process.env.NEO4J_PORT || '7687'}`;
    const user = process.env.NEO4J_USER || 'neo4j';
    const password = process.env.NEO4J_PASSWORD || 'neo4j';
    driver = neo4j.driver(url, neo4j.auth.basic(user, password));
  }
  return driver;
}

export async function runQuery<T = Record<string, unknown>>(
  cypher: string,
  params: Record<string, unknown> = {},
): Promise<T[]> {
  const session = getNeo4j().session();
  try {
    const result = await session.run(cypher, params);
    return result.records.map((r) => r.toObject() as T);
  } finally {
    await session.close();
  }
}
