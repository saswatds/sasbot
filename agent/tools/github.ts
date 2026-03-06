import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

async function ghFetch(path: string) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'sasbot/1.0',
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

export const githubNotifications = createTool({
  id: 'github-notifications',
  description: 'Fetch unread GitHub notifications',
  inputSchema: z.object({}),
  execute: async () => {
    if (!GITHUB_TOKEN) {
      return { error: 'GITHUB_TOKEN not configured', notifications: [] };
    }
    const data = await ghFetch('/notifications?all=false');
    const notifications = data.map(
      (n: {
        id: string;
        reason: string;
        subject: { title: string; type: string; url: string };
        repository: { full_name: string };
        updated_at: string;
      }) => ({
        id: n.id,
        reason: n.reason,
        title: n.subject.title,
        type: n.subject.type,
        repo: n.repository.full_name,
        updatedAt: n.updated_at,
      })
    );
    return { notifications, count: notifications.length };
  },
});

export const githubPrs = createTool({
  id: 'github-prs',
  description: 'List pull requests for a repository',
  inputSchema: z.object({
    repo: z.string().describe('Repository in owner/name format'),
    state: z
      .enum(['open', 'closed', 'all'])
      .optional()
      .describe('PR state filter (default: open)'),
  }),
  execute: async (input) => {
    if (!GITHUB_TOKEN) {
      return { error: 'GITHUB_TOKEN not configured', prs: [] };
    }
    const state = input.state || 'open';
    const data = await ghFetch(
      `/repos/${input.repo}/pulls?state=${state}&per_page=20`
    );
    const prs = data.map(
      (pr: {
        number: number;
        title: string;
        state: string;
        user: { login: string };
        created_at: string;
        html_url: string;
        draft: boolean;
      }) => ({
        number: pr.number,
        title: pr.title,
        state: pr.state,
        author: pr.user.login,
        createdAt: pr.created_at,
        url: pr.html_url,
        draft: pr.draft,
      })
    );
    return { prs, count: prs.length };
  },
});

export const githubIssues = createTool({
  id: 'github-issues',
  description: 'List or search issues for a repository',
  inputSchema: z.object({
    repo: z.string().describe('Repository in owner/name format'),
    query: z
      .string()
      .optional()
      .describe('Search query to filter issues'),
    state: z
      .enum(['open', 'closed', 'all'])
      .optional()
      .describe('Issue state filter (default: open)'),
  }),
  execute: async (input) => {
    if (!GITHUB_TOKEN) {
      return { error: 'GITHUB_TOKEN not configured', issues: [] };
    }
    let data;
    if (input.query) {
      const q = `${input.query} repo:${input.repo} is:issue`;
      const result = await ghFetch(
        `/search/issues?q=${encodeURIComponent(q)}&per_page=20`
      );
      data = result.items;
    } else {
      const state = input.state || 'open';
      data = await ghFetch(
        `/repos/${input.repo}/issues?state=${state}&per_page=20`
      );
    }
    const issues = data.map(
      (issue: {
        number: number;
        title: string;
        state: string;
        user: { login: string };
        created_at: string;
        html_url: string;
        labels: Array<{ name: string }>;
      }) => ({
        number: issue.number,
        title: issue.title,
        state: issue.state,
        author: issue.user.login,
        createdAt: issue.created_at,
        url: issue.html_url,
        labels: issue.labels.map((l) => l.name),
      })
    );
    return { issues, count: issues.length };
  },
});
