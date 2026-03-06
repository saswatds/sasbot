import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getRedis } from '../lib/redis';

const TASKS_KEY = 'sasbot:tasks';
const TASK_PREFIX = 'sasbot:task:';

export const addTask = createTool({
  id: 'add-task',
  description: 'Create a new task with title, optional due date, and priority',
  inputSchema: z.object({
    title: z.string().describe('Task title'),
    due: z.string().optional().describe('Due date (ISO string or natural like "tomorrow")'),
    priority: z
      .enum(['low', 'medium', 'high'])
      .optional()
      .describe('Task priority level'),
  }),
  execute: async (input) => {
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
    const priorityScore = { high: 3, medium: 2, low: 1 }[task.priority] || 2;
    const score = priorityScore * 1e13 + Date.now();
    await redis.set(`${TASK_PREFIX}${id}`, JSON.stringify(task));
    await redis.zadd(TASKS_KEY, score, id);
    return { created: true, task };
  },
});

export const listTasks = createTool({
  id: 'list-tasks',
  description: 'List tasks filtered by status',
  inputSchema: z.object({
    status: z
      .enum(['open', 'done', 'all'])
      .optional()
      .describe('Filter by status (default: open)'),
  }),
  execute: async (input) => {
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
});

export const completeTask = createTool({
  id: 'complete-task',
  description: 'Mark a task as done by its ID',
  inputSchema: z.object({
    id: z.string().describe('Task ID to mark as done'),
  }),
  execute: async (input) => {
    const redis = getRedis();
    const raw = await redis.get(`${TASK_PREFIX}${input.id}`);
    if (!raw) return { error: 'Task not found', id: input.id };
    const task = JSON.parse(raw);
    task.status = 'done';
    task.completedAt = new Date().toISOString();
    await redis.set(`${TASK_PREFIX}${input.id}`, JSON.stringify(task));
    return { completed: true, task };
  },
});
