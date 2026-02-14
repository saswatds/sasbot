import { Graph, z } from '@saswatds/astro-graph';

const BRAVE_API_KEY = process.env.BRAVE_SEARCH_API_KEY;

export const webSearch = new Graph(
  z.object({
    query: z.string().describe('Search query'),
    count: z.number().optional().describe('Number of results (default 5)'),
  })
)
  .meta({
    title: 'Web Search',
    description: 'Search the web using Brave Search API',
  })
  .run(
    (f) =>
      f.evaluate({
        fn: async (input: { query: string; count?: number }) => {
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
      }),
    { name: 'Brave Search' }
  )
  .compile();

export const fetchUrl = new Graph(
  z.object({
    url: z.string().describe('URL to fetch content from'),
  })
)
  .meta({
    title: 'Fetch URL',
    description: 'Fetch and extract readable content from a URL',
  })
  .run(
    (f) =>
      f.evaluate({
        fn: async (input: { url: string }) => {
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
            // Basic HTML stripping — extract text content
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
      }),
    { name: 'Fetch URL Content' }
  )
  .compile();
