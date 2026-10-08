import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { RoomClient, RoomError } from '@astropods/messaging';
import type { RequestContext } from '@mastra/core/request-context';
import { roomFor } from '../lib/room';

const MAX_TEXT = 100_000;

async function withRoom<T>(requestContext: RequestContext | undefined, run: (room: RoomClient) => Promise<T>) {
  const room = await roomFor(requestContext);
  if ('error' in room) return room;
  try {
    return await run(room);
  } catch (err) {
    if (err instanceof RoomError) return { error: `Room API returned ${err.status}: ${err.message}` };
    throw err;
  }
}

export const roomInfo = createTool({
  id: 'room-info',
  description: 'Get the room this task came from: its name, the agents in it and the people in it',
  inputSchema: z.object({}),
  execute: async (_input, { requestContext }) => withRoom(requestContext, (room) => room.get()),
});

export const roomTasks = createTool({
  id: 'room-tasks',
  description: "List sasbot's open tasks in this room, each with its linked input and output documents",
  inputSchema: z.object({}),
  execute: async (_input, { requestContext }) => withRoom(requestContext, (room) => room.listTasks('assigned')),
});

export const readRoomDocument = createTool({
  id: 'read-room-document',
  description: 'Read a document from this room by its ID, for example a task input. Returns its text',
  inputSchema: z.object({ documentId: z.string().describe('The document ID, from room-tasks') }),
  execute: async ({ documentId }, { requestContext }) =>
    withRoom(requestContext, async (room) => {
      const bytes = await room.readDocument(documentId);
      const text = new TextDecoder().decode(bytes);
      return { documentId, text: text.slice(0, MAX_TEXT), truncated: text.length > MAX_TEXT };
    }),
});

export const uploadRoomDocument = createTool({
  id: 'upload-room-document',
  description: 'Save a document to this room, for example the result of a task, so the people and agents in the room can see it',
  inputSchema: z.object({
    name: z.string().describe('File name, for example q3-summary.md'),
    content: z.string().describe('The document content'),
    contentType: z.string().optional().describe('MIME type, default text/markdown'),
  }),
  execute: async ({ name, content, contentType }, { requestContext }) =>
    withRoom(requestContext, (room) => room.uploadDocument(name, content, contentType ?? 'text/markdown')),
});
