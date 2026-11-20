import { Router, Request, Response } from 'express';
import { createTaskSchema, updateTaskSchema } from '@flint/shared';
import { prisma } from '../../lib/prisma';
import { logAudit } from '../../lib/audit';
import { authMiddleware } from '../../middleware/auth';
import { scopeFor, canWrite } from '../../middleware/rbac';
import { emitDomainEvent } from '../../lib/events';
import { getIO } from '../../realtime';

export const tasksRouter = Router();

// Apply auth to all routes
tasksRouter.use(authMiddleware);

// GET /tasks/my (Must be registered before /tasks/:id)
tasksRouter.get('/tasks/my', async (req: Request, res: Response) => {
  const tasks = await prisma.task.findMany({
    where: {
      assignee_id: req.user!.id,
      status: { not: 'COMPLETED' },
    },
    include: {
      assignee: { select: { id: true, name: true, role: true } },
      creator: { select: { id: true, name: true } },
      account: { select: { id: true, name: true } },
    },
    orderBy: { due_at: 'asc' },
  });

  const now = new Date();
  const enrichedTasks = tasks.map((task) => ({
    ...task,
    isOverdue: Boolean(task.due_at && new Date(task.due_at) < now && task.status !== 'COMPLETED'),
  }));

  return res.json({
    items: enrichedTasks,
    tasks: enrichedTasks,
    data: enrichedTasks,
    total: enrichedTasks.length,
  });
});

// GET /tasks
tasksRouter.get('/tasks', async (req: Request, res: Response) => {
  const scopeFilter = scopeFor(req.user!, 'tasks');
  if (scopeFilter === null) {
    return res.status(403).json({ error: 'Forbidden: Insufficient permissions to view tasks' });
  }

  const where: any = {
    ...scopeFilter,
  };

  const status = req.query.status as string | undefined;
  if (status) {
    where.status = status === 'DONE' ? 'COMPLETED' : status;
  }

  const assigneeId = req.query.assigneeId as string | undefined;
  if (assigneeId === 'me') {
    where.assignee_id = req.user!.id;
  } else if (assigneeId) {
    where.assignee_id = assigneeId;
  }

  const tasks = await prisma.task.findMany({
    where,
    include: {
      assignee: { select: { id: true, name: true, role: true } },
      creator: { select: { id: true, name: true } },
      account: { select: { id: true, name: true } },
    },
    orderBy: { due_at: 'asc' },
  });

  const now = new Date();
  const enrichedTasks = tasks.map((task) => ({
    ...task,
    isOverdue: Boolean(task.due_at && new Date(task.due_at) < now && task.status !== 'COMPLETED'),
  }));

  return res.json({
    items: enrichedTasks,
    tasks: enrichedTasks,
    data: enrichedTasks,
    total: enrichedTasks.length,
  });
});

// POST /tasks
tasksRouter.post('/tasks', async (req: Request, res: Response) => {
  const result = createTaskSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.issues?.[0]?.message || 'Invalid task data' });
  }

  const data = result.data;
  const task = await prisma.task.create({
    data: {
      title: data.title,
      description: data.description || null,
      assignee_id: data.assigneeId,
      created_by: req.user!.id,
      due_at: data.dueAt ? new Date(data.dueAt) : null,
      priority: data.priority as any,
      account_id: data.accountId || null,
      contact_id: data.contactId || null,
      deal_id: data.dealId || null,
      ticket_id: data.ticketId || null,
    },
    include: {
      assignee: { select: { id: true, name: true, role: true } },
      creator: { select: { id: true, name: true } },
      account: { select: { id: true, name: true } },
    },
  });

  await logAudit(prisma, {
    userId: req.user!.id,
    entity: 'TASKS',
    entityId: task.id,
    action: 'CREATE',
    changes: { after: task },
  });

  emitDomainEvent('task.created', {
    taskId: task.id,
    title: task.title,
    assigneeId: task.assignee_id,
    accountId: task.account_id,
  });

  return res.status(201).json(task);
});

// PATCH /tasks/:id
tasksRouter.patch('/tasks/:id', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      assignee: { select: { id: true, team_id: true } },
      creator: { select: { id: true, team_id: true } },
    },
  });

  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  if (!canWrite(req.user!, 'tasks', task)) {
    return res.status(403).json({ error: 'Forbidden: You do not have permission to modify this task' });
  }

  const result = updateTaskSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.issues?.[0]?.message || 'Invalid task update' });
  }

  const data = result.data;
  const statusToSave = data.status === 'DONE' ? 'COMPLETED' : data.status;

  const updatedTask = await prisma.task.update({
    where: { id },
    data: {
      ...(data.title && { title: data.title }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.assigneeId && { assignee_id: data.assigneeId }),
      ...(data.dueAt !== undefined && { due_at: data.dueAt ? new Date(data.dueAt) : null }),
      ...(data.priority && { priority: data.priority as any }),
      ...(statusToSave && { status: statusToSave as any }),
      ...(data.accountId !== undefined && { account_id: data.accountId }),
      ...(data.contactId !== undefined && { contact_id: data.contactId }),
      ...(data.dealId !== undefined && { deal_id: data.dealId }),
      ...(data.ticketId !== undefined && { ticket_id: data.ticketId }),
    },
    include: {
      assignee: { select: { id: true, name: true, role: true } },
      creator: { select: { id: true, name: true } },
      account: { select: { id: true, name: true } },
    },
  });

  await logAudit(prisma, {
    userId: req.user!.id,
    entity: 'TASKS',
    entityId: id,
    action: 'UPDATE',
    changes: { before: task, after: updatedTask },
  });

  try {
    getIO().emit('tasks:changed', { taskId: id });
  } catch {}

  return res.json(updatedTask);
});

// DELETE /tasks/:id
tasksRouter.delete('/tasks/:id', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      assignee: { select: { id: true, team_id: true } },
      creator: { select: { id: true, team_id: true } },
    },
  });

  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  if (!canWrite(req.user!, 'tasks', task)) {
    return res.status(403).json({ error: 'Forbidden: You do not have permission to delete this task' });
  }

  await prisma.task.delete({ where: { id } });

  await logAudit(prisma, {
    userId: req.user!.id,
    entity: 'TASKS',
    entityId: id,
    action: 'DELETE',
    changes: { before: task },
  });

  try {
    getIO().emit('tasks:changed', { taskId: id });
  } catch {}

  return res.json({ success: true, message: 'Task deleted successfully' });
});
