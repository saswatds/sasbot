import { Graph, z } from '@saswatds/astro-graph';

export const currentDatetime = new Graph(z.object({}))
  .meta({
    title: 'Current Datetime',
    description: 'Returns the current date, time, timezone, and day of week',
  })
  .run(
    (f) =>
      f.evaluate({
        fn: async () => {
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
      }),
    { name: 'Get Current Datetime' }
  )
  .compile();
