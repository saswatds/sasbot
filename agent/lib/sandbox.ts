import { Workspace } from '@mastra/core/workspace';
import type { RequestContext } from '@mastra/core/request-context';
import { AstroSandbox } from '@astropods/adapter-mastra';

const workspaces = new Map<string, Workspace>();

export function workspaceFor({
  requestContext,
}: {
  requestContext: RequestContext;
}): Workspace | undefined {
  if (!process.env.ASTRO_AUTHZ_TOKEN) return undefined;

  const threadId = requestContext?.get('threadId');
  if (typeof threadId !== 'string' || threadId === '') return undefined;

  const name = `sasbot-${threadId}`;
  let workspace = workspaces.get(name);
  if (!workspace) {
    workspace = new Workspace({ name, sandbox: new AstroSandbox({ name }) });
    workspaces.set(name, workspace);
  }
  return workspace;
}
