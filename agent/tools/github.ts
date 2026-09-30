import { ConnectionClient, ConnectionError } from '@astropods/adapter-core/connections';
import type { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const GUIDANCE: Record<string, string> = {
  not_consented: 'Ask the user to allow GitHub access for sasbot in chat.',
  not_active: 'Ask the user to send a message in web chat, then try again.',
  not_connected: 'Ask the user to connect GitHub on their personal account.',
  needs_reauthorization: 'Ask the user to reconnect GitHub on their personal account.',
};

let connections: ConnectionClient | undefined;

async function githubToken(requestContext?: RequestContext): Promise<{ token: string } | { error: string }> {
  const userId = requestContext?.get('resourceId');
  if (typeof userId !== 'string' || userId === '') {
    return { error: 'No chatting user for this turn, so GitHub is unavailable.' };
  }
  try {
    connections ??= new ConnectionClient();
    const { accessToken } = await connections.getToken('github', userId);
    return { token: accessToken };
  } catch (err) {
    if (err instanceof ConnectionError) {
      return { error: GUIDANCE[err.code] ?? `GitHub is unavailable: ${err.message}` };
    }
    return { error: `GitHub is unavailable: ${String(err)}` };
  }
}

async function ghFetch(path: string, token: string) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'sasbot/1.0',
    },
  });
  if (!res.ok) {
    throw new GitHubRefusal(res.status, await githubMessage(res), res.headers.get('x-github-sso'));
  }
  return res.json();
}

class GitHubRefusal extends Error {
  constructor(
    readonly status: number,
    readonly githubMessage: string,
    readonly sso: string | null,
  ) {
    super(`GitHub API ${status}: ${githubMessage}`);
  }
}

async function githubMessage(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const body = JSON.parse(text) as { message?: unknown };
    if (typeof body.message === 'string') return body.message;
  } catch {}
  return text || res.statusText;
}

function describeFailure(err: unknown): string {
  if (err instanceof GitHubRefusal) {
    const authorize = err.sso?.match(/url=(\S+)/)?.[1];
    if (authorize) {
      return `GitHub refused the request because the organization enforces SAML SSO. Ask the user to authorize the Astropods GitHub connection for that organization: ${authorize}`;
    }
    return `GitHub refused the request (${err.status}): ${err.githubMessage}. The user's GitHub connection is working, so do not ask them to configure a token.`;
  }
  return `GitHub request failed: ${String(err)}`;
}

async function withGitHub<T extends object>(
  requestContext: RequestContext | undefined,
  empty: T,
  run: (token: string) => Promise<T>,
): Promise<T | (T & { error: string })> {
  const auth = await githubToken(requestContext);
  if ('error' in auth) {
    console.warn(JSON.stringify({ msg: 'github: no token for this turn', reason: auth.error }));
    return { ...empty, error: auth.error };
  }
  try {
    return await run(auth.token);
  } catch (err) {
    console.warn(
      JSON.stringify({
        msg: 'github: request refused',
        status: err instanceof GitHubRefusal ? err.status : null,
        github_message: err instanceof GitHubRefusal ? err.githubMessage : String(err),
        sso_required: err instanceof GitHubRefusal ? Boolean(err.sso) : false,
      })
    );
    return { ...empty, error: describeFailure(err) };
  }
}

export const githubNotifications = createTool({
  id: 'github-notifications',
  description: 'Fetch unread GitHub notifications',
  inputSchema: z.object({}),
  execute: async (_input, { requestContext }) =>
    withGitHub(requestContext, { notifications: [] as unknown[], count: 0 }, async (token) => {
    const data = await ghFetch('/notifications?all=false', token);
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
    }),
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
  execute: async (input, { requestContext }) =>
    withGitHub(requestContext, { prs: [] as unknown[], count: 0 }, async (token) => {
    const state = input.state || 'open';
    const data = await ghFetch(
      `/repos/${input.repo}/pulls?state=${state}&per_page=20`,
      token
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
    }),
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
  execute: async (input, { requestContext }) =>
    withGitHub(requestContext, { issues: [] as unknown[], count: 0 }, async (token) => {
    let data;
    if (input.query) {
      const q = `${input.query} repo:${input.repo} is:issue`;
      const result = await ghFetch(
        `/search/issues?q=${encodeURIComponent(q)}&per_page=20`,
        token
      );
      data = result.items;
    } else {
      const state = input.state || 'open';
      data = await ghFetch(
        `/repos/${input.repo}/issues?state=${state}&per_page=20`,
        token
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
    }),
});
