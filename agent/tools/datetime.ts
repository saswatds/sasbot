import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const currentDatetime = createTool({
  id: 'current-datetime',
  description: 'Returns the current date, time, timezone, and day of week',
  inputSchema: z.object({}),
  execute: async () => {
    const now = new Date();
    return {
      iso: now.toISOString(),
      date: now.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      time: now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      dayOfWeek: now.toLocaleDateString('en-US', { weekday: 'long' }),
      unix: Math.floor(now.getTime() / 1000),
    };
  },
});
