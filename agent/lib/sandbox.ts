export interface SandboxHandle {
  name: string;
  class: string;
  state: string;
  endpoint: string;
  headers: Record<string, string>;
  expiresAt: string;
}

export interface SandboxRecord {
  name: string;
  class: string;
  state: string;
  createdAt: string;
  lastActiveAt: string;
  ceilingAt?: string;
}

export interface ExecRequest {
  command: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
}

export interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
  truncated: boolean;
}

export class SandboxRequestError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'SandboxRequestError';
  }
}

export class SandboxUnavailableError extends Error {
  constructor(cause: unknown) {
    super(`sandbox control plane unreachable: ${String(cause)}`);
    this.name = 'SandboxUnavailableError';
    this.cause = cause;
  }
}

export class SandboxNotEnabledError extends SandboxRequestError {
  constructor(message: string) {
    super(409, message);
    this.name = 'SandboxNotEnabledError';
  }
}

interface DeployTokenClaims {
  subject: string;
  issuer: string;
}

function decodeDeployToken(raw: string): DeployTokenClaims {
  if (!raw) throw new Error('ASTRO_AUTHZ_TOKEN is empty');
  const parts = raw.split('.');
  if (parts.length !== 3) {
    throw new Error(`ASTRO_AUTHZ_TOKEN: expected 3 segments, got ${parts.length}`);
  }
  const payload = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString('utf8'));
  const subject = typeof payload.sub === 'string' ? payload.sub : '';
  const issuer = typeof payload.iss === 'string' ? payload.iss : '';
  if (!subject) throw new Error('ASTRO_AUTHZ_TOKEN has no sub claim');
  if (!issuer) throw new Error('ASTRO_AUTHZ_TOKEN has no iss claim');
  return { subject, issuer };
}

export interface SandboxOptions {
  identityToken?: string;
  serverUrl?: string;
  timeoutSeconds?: number;
  fetchImpl?: typeof fetch;
}

export class SandboxClient {
  readonly deploymentId: string;
  readonly serverUrl: string;
  private readonly token: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly handles = new Map<string, SandboxHandle>();

  constructor(options: SandboxOptions = {}) {
    this.token = options.identityToken ?? process.env.ASTRO_AUTHZ_TOKEN ?? '';
    const claims = decodeDeployToken(this.token);
    this.deploymentId = claims.subject;
    this.serverUrl = (options.serverUrl ?? claims.issuer).replace(/\/+$/, '');
    this.timeoutMs = (options.timeoutSeconds ?? 30) * 1000;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async attach(name: string, sandboxClass?: string): Promise<SandboxHandle> {
    const body = sandboxClass ? JSON.stringify({ class: sandboxClass }) : undefined;
    const handle = await this.request<Record<string, unknown>>(
      'PUT',
      `/api/v1/sandboxes/${encodeURIComponent(name)}`,
      body,
    );
    const resolved: SandboxHandle = {
      name: String(handle.name ?? name),
      class: String(handle.class ?? ''),
      state: String(handle.state ?? ''),
      endpoint: withScheme(String(handle.endpoint ?? '')),
      headers: (handle.headers as Record<string, string>) ?? {},
      expiresAt: String(handle.expires_at ?? ''),
    };
    this.handles.set(name, resolved);
    return resolved;
  }

  async exec(name: string, request: ExecRequest): Promise<ExecResult> {
    let handle = this.handles.get(name) ?? (await this.attach(name));
    try {
      return await this.execOn(handle, request);
    } catch (err) {
      if (!isStaleHandle(err)) throw err;
      this.handles.delete(name);
      handle = await this.attach(name);
      return await this.execOn(handle, request);
    }
  }

  async get(name: string): Promise<SandboxRecord> {
    return toRecord(
      await this.request<Record<string, unknown>>(
        'GET',
        `/api/v1/sandboxes/${encodeURIComponent(name)}`,
      ),
    );
  }

  async list(): Promise<SandboxRecord[]> {
    const body = await this.request<{ sandboxes?: Record<string, unknown>[] }>(
      'GET',
      '/api/v1/sandboxes',
    );
    return (body.sandboxes ?? []).map(toRecord);
  }

  async stop(name: string): Promise<void> {
    await this.request<void>('POST', `/api/v1/sandboxes/${encodeURIComponent(name)}/stop`);
    this.handles.delete(name);
  }

  async delete(name: string): Promise<void> {
    await this.request<void>('DELETE', `/api/v1/sandboxes/${encodeURIComponent(name)}`);
    this.handles.delete(name);
  }

  private async execOn(handle: SandboxHandle, request: ExecRequest): Promise<ExecResult> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${handle.endpoint}/v1/exec`, {
        method: 'POST',
        headers: { ...handle.headers, 'content-type': 'application/json' },
        body: JSON.stringify({
          command: request.command,
          cwd: request.cwd,
          env: request.env,
          timeout_ms: request.timeoutMs,
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      throw new SandboxUnavailableError(err);
    }
    if (!res.ok) {
      throw new SandboxRequestError(res.status, await errorMessage(res, 'exec failed'));
    }
    const out = (await res.json()) as Record<string, unknown>;
    return {
      exitCode: Number(out.exit_code ?? 0),
      stdout: String(out.stdout ?? ''),
      stderr: String(out.stderr ?? ''),
      durationMs: Number(out.duration_ms ?? 0),
      timedOut: out.timed_out === true,
      truncated: out.truncated === true,
    };
  }

  private async request<T>(method: string, path: string, body?: string): Promise<T> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.serverUrl}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${this.token}`,
          ...(body ? { 'content-type': 'application/json' } : {}),
        },
        body,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      throw new SandboxUnavailableError(err);
    }
    if (res.status === 409) {
      throw new SandboxNotEnabledError(await errorMessage(res, 'sandboxes are not enabled'));
    }
    if (!res.ok) {
      throw new SandboxRequestError(
        res.status,
        await errorMessage(res, `${method} ${path} failed`),
      );
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }
}

function withScheme(endpoint: string): string {
  if (!endpoint) return endpoint;
  return /^https?:\/\//.test(endpoint) ? endpoint : `https://${endpoint}`;
}

function isStaleHandle(err: unknown): boolean {
  if (err instanceof SandboxUnavailableError) return true;
  return err instanceof SandboxRequestError && (err.status === 401 || err.status === 403);
}

function toRecord(row: Record<string, unknown>): SandboxRecord {
  return {
    name: String(row.name ?? ''),
    class: String(row.class ?? ''),
    state: String(row.state ?? ''),
    createdAt: String(row.created_at ?? ''),
    lastActiveAt: String(row.last_active_at ?? ''),
    ceilingAt: row.ceiling_at ? String(row.ceiling_at) : undefined,
  };
}

async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error ?? fallback;
  } catch {
    return fallback;
  }
}
