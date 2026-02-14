import { Graph, z } from '@saswatds/astro-graph';
import { getRedis } from '../lib/redis';

const TASKS_KEY = 'sasbot:tasks';
const TASK_PREFIX = 'sasbot:task:';

export const addTask = new Graph(
  z.object({
    title: z.string().describe('Task title'),
    due: z.string().optional().describe('Due date (ISO string or natural like "tomorrow")'),
    priority: z
      .enum(['low', 'medium', 'high'])
      .optional()
      .describe('Task priority level'),
  })
)
  .meta({
    title: 'Add Task',
    description: 'Create a new task with title, optional due date, and priority',
  })
  .run(
    (f) =>
      f.evaluate({
        fn: async (input: { title: string; due?: string; priority?: string }) => {
          const redis = getRedis();
          const id = `task_${Date.now()}`;
          const task = {
            id,
            title: input.title,
            due: input.due || null,
            priority: input.priority || 'medium',
            status: 'open',
            createdAt: new Date().toISOString(),
          };
          // Score: priority weight + timestamp for ordering
          const priorityScore = { high: 3, medium: 2, low: 1 }[task.priority] || 2;
          const score = priorityScore * 1e13 + Date.now();
          await redis.set(`${TASK_PREFIX}${id}`, JSON.stringify(task));
          await redis.zadd(TASKS_KEY, score, id);
          return { created: true, task };
        },
      }),
    { name: 'Create Task' }
  )
  .compile();

export const listTasks = new Graph(
  z.object({
    status: z
      .enum(['open', 'done', 'all'])
      .optional()
      .describe('Filter by status (default: open)'),
  })
)
  .meta({
    title: 'List Tasks',
    description: 'List tasks filtered by status',
  })
  .run(
    (f) =>
      f.evaluate({
        fn: async (input: { status?: string }) => {
          const redis = getRedis();
          const filter = input.status || 'open';
          const ids = await redis.zrevrange(TASKS_KEY, 0, -1);
          const tasks = [];

          for (const id of ids) {
            const raw = await redis.get(`${TASK_PREFIX}${id}`);
            if (!raw) continue;
            const task = JSON.parse(raw);
            if (filter === 'all' || task.status === filter) {
              tasks.push(task);
            }
          }
          return { tasks, count: tasks.length };
        },
      }),
    { name: 'Fetch Tasks' }
  )
  .compile();

export const completeTask = new Graph(
  z.object({
    id: z.string().describe('Task ID to mark as done'),
  })
)
  .meta({
    title: 'Complete Task',
    description: 'Mark a task as done by its ID',
  })
  .run(
    (f) =>
      f.evaluate({
        fn: async (input: { id: string }) => {
          const redis = getRedis();
          const raw = await redis.get(`${TASK_PREFIX}${input.id}`);
          if (!raw) return { error: 'Task not found', id: input.id };
          const task = JSON.parse(raw);
          task.status = 'done';
          task.completedAt = new Date().toISOString();
          await redis.set(`${TASK_PREFIX}${input.id}`, JSON.stringify(task));
          return { completed: true, task };
        },
      }),
    { name: 'Complete Task' }
  )
  .compile();
