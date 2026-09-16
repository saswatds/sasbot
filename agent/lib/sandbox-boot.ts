import { SandboxClient } from './sandbox';

const NAME = 'boot';
const MARKER = '/tmp/boot-marker';

function log(line: string): void {
  console.log(`sandbox: ${line}`);
}

export async function runSandboxOnBoot(): Promise<void> {
  let client: SandboxClient;
  try {
    client = new SandboxClient({ timeoutSeconds: 60 });
  } catch (err) {
    log(`skipped, no usable identity token: ${String(err)}`);
    return;
  }

  const stamp = String(Date.now());
  log(`attaching deployment=${client.deploymentId} server=${client.serverUrl}`);

  try {
    const handle = await client.attach(NAME);
    log(
      `attached state=${handle.state} class=${handle.class} endpoint=${handle.endpoint} headers=${Object.keys(handle.headers).join(',')} expires_at=${handle.expiresAt}`,
    );

    const echo = await client.exec(NAME, { command: ['/bin/echo', 'hello from the sandbox'] });
    log(
      `exec exit=${echo.exitCode} duration_ms=${echo.durationMs} stdout=${JSON.stringify(echo.stdout)} stderr=${JSON.stringify(echo.stderr)}`,
    );

    const uname = await client.exec(NAME, { command: ['/bin/uname', '-a'] });
    log(`uname exit=${uname.exitCode} stdout=${JSON.stringify(uname.stdout.trim())}`);

    await client.exec(NAME, { command: ['/bin/sh', '-c', `echo ${stamp} > ${MARKER}`] });

    const record = await client.get(NAME);
    log(
      `record state=${record.state} created_at=${record.createdAt} last_active_at=${record.lastActiveAt} ceiling_at=${record.ceilingAt ?? 'none'}`,
    );

    const rows = await client.list();
    log(`list count=${rows.length} names=${rows.map((row) => row.name).join(',')}`);

    await client.stop(NAME);
    log(`stopped state=${(await client.get(NAME)).state}`);

    const resumeStarted = Date.now();
    const resumed = await client.attach(NAME);
    const marker = await client.exec(NAME, { command: ['/bin/cat', MARKER] });
    log(
      `resumed resume_ms=${Date.now() - resumeStarted} state=${resumed.state} marker=${JSON.stringify(marker.stdout.trim())} wrote=${stamp}`,
    );
  } catch (err) {
    log(`failed ${(err as Error).name}: ${(err as Error).message}`);
  } finally {
    try {
      await client.delete(NAME);
      log('deleted');
    } catch (err) {
      log(`delete failed ${String(err)}`);
    }
  }
}
