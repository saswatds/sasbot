import { MessagingClient, RoomClient } from '@astropods/messaging';
import type { RequestContext } from '@mastra/core/request-context';

let client: Promise<MessagingClient> | undefined;

function messaging(): Promise<MessagingClient> {
  client ??= (async () => {
    const c = new MessagingClient(process.env.GRPC_SERVER_ADDR ?? 'localhost:9090');
    await c.connect();
    return c;
  })();
  return client;
}

export async function roomFor(requestContext?: RequestContext): Promise<RoomClient | { error: string }> {
  const threadId = requestContext?.get('threadId');
  if (typeof threadId !== 'string' || threadId === '') {
    return { error: 'No conversation to find a room for.' };
  }
  const client = await messaging();
  if (!(await client.getRoomGrant(threadId))) {
    return { error: 'This conversation is not a room task, so there is no room to use. Room tools work only while handling a task from a room.' };
  }
  return new RoomClient(client, threadId);
}
