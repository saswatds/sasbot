import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getRedis } from '../lib/redis';

const PREFIX = 'sasbot:notes:';
const TAGS_PREFIX = 'sasbot:notes:tags:';
const KEYS_SET = 'sasbot:notes:keys';

export const saveNote = createTool({
  id: 'save-note',
  description: 'Save a personal note with a key, content, and optional tags',
  inputSchema: z.object({
    key: z.string().describe('Unique key/name for the note'),
    content: z.string().describe('The note content'),
    tags: z
      .array(z.string())
      .optional()
      .describe('Optional tags for categorization'),
  }),
  execute: async (input) => {
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
});

export const searchNotes = createTool({
  id: 'search-notes',
  description: 'Search personal notes by keyword or tag',
  inputSchema: z.object({
    query: z.string().describe('Search keyword or tag to find notes'),
  }),
  execute: async (input) => {
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
});

export const listNotes = createTool({
  id: 'list-notes',
  description: 'List all saved note keys and their tags',
  inputSchema: z.object({}),
  execute: async () => {
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
});
