import { Graph, z } from '@saswatds/astro-graph';
import { getRedis } from '../lib/redis';

const PREFIX = 'sasbot:notes:';
const TAGS_PREFIX = 'sasbot:notes:tags:';
const KEYS_SET = 'sasbot:notes:keys';

export const saveNote = new Graph(
  z.object({
    key: z.string().describe('Unique key/name for the note'),
    content: z.string().describe('The note content'),
    tags: z
      .array(z.string())
      .optional()
      .describe('Optional tags for categorization'),
  })
)
  .meta({
    title: 'Save Note',
    description: 'Save a personal note with a key, content, and optional tags',
  })
  .run(
    (f) =>
      f.evaluate({
        fn: async (input: { key: string; content: string; tags?: string[] }) => {
          const redis = getRedis();
          const noteData = {
            content: input.content,
            tags: input.tags || [],
            updatedAt: new Date().toISOString(),
          };
          await redis.set(`${PREFIX}${input.key}`, JSON.stringify(noteData));
          if (input.tags) {
            for (const tag of input.tags) {
              await redis.sadd(`${TAGS_PREFIX}${tag}`, input.key);
            }
          }
          await redis.sadd(KEYS_SET, input.key);
          return { saved: true, key: input.key };
        },
      }),
    { name: 'Save to Redis' }
  )
  .compile();

export const searchNotes = new Graph(
  z.object({
    query: z.string().describe('Search keyword or tag to find notes'),
  })
)
  .meta({
    title: 'Search Notes',
    description: 'Search personal notes by keyword or tag',
  })
  .run(
    (f) =>
      f.evaluate({
        fn: async (input: { query: string }) => {
          const redis = getRedis();
          const allKeys = await redis.smembers(KEYS_SET);
          const results: Array<{ key: string; content: string; tags: string[] }> = [];
          const query = input.query.toLowerCase();

          for (const key of allKeys) {
            const raw = await redis.get(`${PREFIX}${key}`);
            if (!raw) continue;
            const note = JSON.parse(raw);
            if (
              key.toLowerCase().includes(query) ||
              note.content.toLowerCase().includes(query) ||
              note.tags.some((t: string) => t.toLowerCase().includes(query))
            ) {
              results.push({ key, content: note.content, tags: note.tags });
            }
          }
          return { results, count: results.length };
        },
      }),
    { name: 'Search Redis Notes' }
  )
  .compile();

export const listNotes = new Graph(z.object({}))
  .meta({
    title: 'List Notes',
    description: 'List all saved note keys and their tags',
  })
  .run(
    (f) =>
      f.evaluate({
        fn: async () => {
          const redis = getRedis();
          const allKeys = await redis.smembers(KEYS_SET);
          const notes: Array<{ key: string; tags: string[]; updatedAt: string }> = [];

          for (const key of allKeys) {
            const raw = await redis.get(`${PREFIX}${key}`);
            if (!raw) continue;
            const note = JSON.parse(raw);
            notes.push({ key, tags: note.tags, updatedAt: note.updatedAt });
          }
          return { notes, count: notes.length };
        },
      }),
    { name: 'List Redis Notes' }
  )
  .compile();
