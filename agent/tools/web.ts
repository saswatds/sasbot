import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const BRAVE_API_KEY = process.env.BRAVE_SEARCH_API_KEY;

export const webSearch = createTool({
  id: 'web-search',
  description: 'Search the web using Brave Search API',
  inputSchema: z.object({
    query: z.string().describe('Search query'),
    count: z.number().optional().describe('Number of results (default 5)'),
  }),
  execute: async (input) => {
    if (!BRAVE_API_KEY) {
      return { error: 'BRAVE_SEARCH_API_KEY not configured', results: [] };
    }
    const count = input.count || 5;
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(input.query)}&count=${count}`;
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': BRAVE_API_KEY,
      },
    });
    if (!res.ok) {
      return { error: `Search failed: ${res.status}`, results: [] };
    }
    const data = await res.json();
    const results = (data.web?.results || []).map(
      (r: { title: string; url: string; description: string }) => ({
        title: r.title,
        url: r.url,
        description: r.description,
      })
    );
    return { results, count: results.length };
  },
});

export const fetchUrl = createTool({
  id: 'fetch-url',
  description: 'Fetch and extract readable content from a URL',
  inputSchema: z.object({
    url: z.string().describe('URL to fetch content from'),
  }),
  execute: async (input) => {
    const res = await fetch(input.url, {
      headers: {
        'User-Agent': 'sasbot/1.0',
        Accept: 'text/html,application/json,text/plain',
      },
      redirect: 'follow',
    });
    if (!res.ok) {
      return { error: `Fetch failed: ${res.status}`, url: input.url };
    }
    const contentType = res.headers.get('content-type') || '';
    let content: string;
    if (contentType.includes('application/json')) {
      const json = await res.json();
      content = JSON.stringify(json, null, 2);
    } else {
      const html = await res.text();
      content = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 10000);
    }
    return { url: input.url, content, length: content.length };
  },
});
