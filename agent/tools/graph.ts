import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { runQuery } from '../lib/neo4j';

export const addEntity = createTool({
  id: 'add-entity',
  description: 'Add an entity (person, project, concept, etc.) to the knowledge graph',
  inputSchema: z.object({
    name: z.string().describe('Name of the entity'),
    type: z.string().describe('Type/label (e.g. Person, Project, Concept, Tool, Company)'),
    properties: z
      .record(z.string(), z.unknown())
      .optional()
      .describe('Additional properties for the entity'),
  }),
  execute: async (input) => {
    const props = { name: input.name, ...input.properties, updatedAt: new Date().toISOString() };
    const result = await runQuery(
      `MERGE (n:\`${input.type}\` {name: $name})
       SET n += $props
       RETURN n.name AS name, labels(n) AS labels`,
      { name: input.name, props },
    );
    return { created: true, entity: result[0] };
  },
});

export const addRelationship = createTool({
  id: 'add-relationship',
  description: 'Create a relationship between two entities in the knowledge graph',
  inputSchema: z.object({
    from: z.string().describe('Name of the source entity'),
    fromType: z.string().describe('Type/label of the source entity'),
    to: z.string().describe('Name of the target entity'),
    toType: z.string().describe('Type/label of the target entity'),
    relationship: z.string().describe('Relationship type (e.g. WORKS_ON, KNOWS, USES, DEPENDS_ON)'),
    properties: z
      .record(z.string(), z.unknown())
      .optional()
      .describe('Additional properties for the relationship'),
  }),
  execute: async (input) => {
    const relProps = { ...input.properties, createdAt: new Date().toISOString() };
    const result = await runQuery(
      `MATCH (a:\`${input.fromType}\` {name: $from})
       MATCH (b:\`${input.toType}\` {name: $to})
       MERGE (a)-[r:\`${input.relationship}\`]->(b)
       SET r += $props
       RETURN a.name AS from, type(r) AS relationship, b.name AS to`,
      { from: input.from, to: input.to, props: relProps },
    );
    if (result.length === 0) {
      return { error: 'One or both entities not found. Create them first with add-entity.' };
    }
    return { created: true, relationship: result[0] };
  },
});

export const queryGraph = createTool({
  id: 'query-graph',
  description: 'Query the knowledge graph using natural-language-like patterns. Finds entities and their relationships.',
  inputSchema: z.object({
    entity: z.string().optional().describe('Entity name to look up'),
    type: z.string().optional().describe('Filter by entity type'),
    depth: z.number().optional().describe('Relationship traversal depth (default 1)'),
  }),
  execute: async (input) => {
    const depth = input.depth || 1;

    if (input.entity) {
      const typeFilter = input.type ? `:\`${input.type}\`` : '';
      const result = await runQuery(
        `MATCH (n${typeFilter} {name: $name})-[r*0..${depth}]-(connected)
         RETURN n.name AS entity, labels(n) AS labels,
                [rel IN r | {type: type(rel), target: endNode(rel).name, source: startNode(rel).name}] AS relationships,
                collect(DISTINCT {name: connected.name, labels: labels(connected)}) AS connected`,
        { name: input.entity },
      );
      if (result.length === 0) {
        return { found: false, entity: input.entity };
      }
      return { found: true, results: result };
    }

    // List entities by type
    const typeFilter = input.type ? `:\`${input.type}\`` : '';
    const result = await runQuery(
      `MATCH (n${typeFilter})
       OPTIONAL MATCH (n)-[r]->(m)
       RETURN n.name AS name, labels(n) AS labels,
              collect({type: type(r), target: m.name}) AS outgoing
       ORDER BY n.name LIMIT 50`,
    );
    return { entities: result, count: result.length };
  },
});

export const searchGraph = createTool({
  id: 'search-graph',
  description: 'Run a custom Cypher query against the knowledge graph. Use for complex queries that the other graph tools cannot handle.',
  inputSchema: z.object({
    cypher: z.string().describe('Cypher query to execute (read-only)'),
    params: z
      .record(z.string(), z.unknown())
      .optional()
      .describe('Query parameters'),
  }),
  execute: async (input) => {
    const query = input.cypher.trim().toUpperCase();
    if (query.startsWith('CREATE') || query.startsWith('DELETE') || query.startsWith('DROP') || query.startsWith('REMOVE') || query.startsWith('SET')) {
      return { error: 'Only read queries (MATCH/RETURN) are allowed. Use add-entity or add-relationship for writes.' };
    }
    const result = await runQuery(input.cypher, input.params || {});
    return { results: result, count: result.length };
  },
});
