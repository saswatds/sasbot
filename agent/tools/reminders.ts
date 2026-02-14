import { Graph, z } from '@saswatds/astro-graph';
import { getRedis } from '../lib/redis';

const REMINDERS_KEY = 'sasbot:reminders';
const REMINDER_PREFIX = 'sasbot:reminder:';

type SendMessageFn = (content: string) => void;
let sendMessage: SendMessageFn | null = null;
const scheduledTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

export function initReminders(messageFn: SendMessageFn) {
  sendMessage = messageFn;
  loadPendingReminders();
}

async function loadPendingReminders() {
  const redis = getRedis();
  const ids = await redis.zrangebyscore(REMINDERS_KEY, '-inf', '+inf');
  for (const id of ids) {
    const raw = await redis.get(`${REMINDER_PREFIX}${id}`);
    if (!raw) continue;
    const reminder = JSON.parse(raw);
    if (reminder.status === 'pending') {
      scheduleReminder(reminder);
    }
  }
}

function scheduleReminder(reminder: { id: string; message: string; triggerAt: string }) {
  const delay = new Date(reminder.triggerAt).getTime() - Date.now();
  if (delay <= 0) {
    fireReminder(reminder);
    return;
  }
  const timer = setTimeout(() => fireReminder(reminder), delay);
  scheduledTimers.set(reminder.id, timer);
}

async function fireReminder(reminder: { id: string; message: string; triggerAt: string }) {
  scheduledTimers.delete(reminder.id);
  const redis = getRedis();
  const raw = await redis.get(`${REMINDER_PREFIX}${reminder.id}`);
  if (raw) {
    const r = JSON.parse(raw);
    r.status = 'fired';
    r.firedAt = new Date().toISOString();
    await redis.set(`${REMINDER_PREFIX}${reminder.id}`, JSON.stringify(r));
  }
  sendMessage?.(`Reminder: ${reminder.message}`);
}

export const setReminder = new Graph(
  z.object({
    message: z.string().describe('What to be reminded about'),
    trigger_at: z
      .string()
      .describe('When to trigger the reminder (ISO datetime string)'),
  })
)
  .meta({
    title: 'Set Reminder',
    description: 'Set a reminder with a message and trigger time',
  })
  .run(
    (f) =>
      f.evaluate({
        fn: async (input: { message: string; trigger_at: string }) => {
          const redis = getRedis();
          const id = `rem_${Date.now()}`;
          const reminder = {
            id,
            message: input.message,
            triggerAt: input.trigger_at,
            status: 'pending',
            createdAt: new Date().toISOString(),
          };
          const score = new Date(input.trigger_at).getTime();
          await redis.set(`${REMINDER_PREFIX}${id}`, JSON.stringify(reminder));
          await redis.zadd(REMINDERS_KEY, score, id);
          scheduleReminder(reminder);
          return { set: true, reminder };
        },
      }),
    { name: 'Create Reminder' }
  )
  .compile();

export const listReminders = new Graph(z.object({}))
  .meta({
    title: 'List Reminders',
    description: 'List all pending reminders',
  })
  .run(
    (f) =>
      f.evaluate({
        fn: async () => {
          const redis = getRedis();
          const ids = await redis.zrangebyscore(REMINDERS_KEY, '-inf', '+inf');
          const reminders = [];
          for (const id of ids) {
            const raw = await redis.get(`${REMINDER_PREFIX}${id}`);
            if (!raw) continue;
            const reminder = JSON.parse(raw);
            if (reminder.status === 'pending') {
              reminders.push(reminder);
            }
          }
          return { reminders, count: reminders.length };
        },
      }),
    { name: 'Fetch Reminders' }
  )
  .compile();
