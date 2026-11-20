import { Router, Request, Response } from 'express';
import { createTicketSchema, updateTicketSchema, replyTicketSchema } from '@flint/shared';
import { prisma } from '../../lib/prisma';
import { logAudit } from '../../lib/audit';
import { authMiddleware } from '../../middleware/auth';
import { scopeFor, canWrite } from '../../middleware/rbac';
import { computeSlaDue } from '../../lib/sla';
import { emitDomainEvent } from '../../lib/events';
import { getIO } from '../../realtime';

export const ticketsRouter = Router();

// Apply auth to all routes
ticketsRouter.use(authMiddleware);

// GET /tickets
ticketsRouter.get('/tickets', async (req: Request, res: Response) => {
  const scopeFilter = scopeFor(req.user!, 'tickets');
  if (scopeFilter === null) {
    return res.status(403).json({ error: 'Forbidden: Insufficient permissions to view tickets' });
  }

  const where: any = {
    ...scopeFilter,
  };

  const status = req.query.status as string | undefined;
  if (status && status !== 'ALL') {
    where.status = status;
  }

  const priority = req.query.priority as string | undefined;
  if (priority && priority !== 'ALL') {
    where.priority = priority;
  }

  const accountId = req.query.accountId as string | undefined;
  if (accountId) {
    where.account_id = accountId;
  }

  const tickets = await prisma.ticket.findMany({
    where,
    include: {
      account: { select: { id: true, name: true } },
      contact: { select: { id: true, name: true, email: true } },
      assignee: { select: { id: true, name: true, role: true } },
    },
    orderBy: { created_at: 'desc' },
  });

  const enrichedTickets = tickets.map((t) => ({
    ...t,
    slaBreached: t.sla_breached_at !== null,
    slaDueAt: t.sla_due_at,
  }));

  return res.json({
    items: enrichedTickets,
    tickets: enrichedTickets,
    data: enrichedTickets,
    total: enrichedTickets.length,
  });
});

// POST /tickets
ticketsRouter.post('/tickets', async (req: Request, res: Response) => {
  if (!canWrite(req.user!, 'tickets')) {
    return res.status(403).json({ error: 'Forbidden: You do not have permission to create tickets' });
  }

  const result = createTicketSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.issues?.[0]?.message || 'Invalid ticket data' });
  }

  const data = result.data;

  // Resolve Assignee: if not provided, assign to first support agent (e.g. Priya)
  let assigneeId = data.assigneeId;
  if (!assigneeId) {
    const defaultAgent = await prisma.user.findFirst({
      where: { role: 'SUPPORT_AGENT' },
      orderBy: { created_at: 'asc' },
    });
    assigneeId = defaultAgent ? defaultAgent.id : req.user!.id;
  }

  // Calculate SLA due date
  const slaDueAt = computeSlaDue(data.priority);

  // Look up SLA policy
  const slaPolicy = await prisma.slaPolicy.findUnique({
    where: { priority: data.priority as any },
  });

  const ticket = await prisma.ticket.create({
    data: {
      subject: data.subject,
      description: data.description || null,
      priority: data.priority as any,
      status: 'OPEN',
      account_id: data.accountId,
      contact_id: data.contactId || null,
      assignee_id: assigneeId,
      sla_due_at: slaDueAt,
      sla_policy_id: slaPolicy?.id || null,
    },
    include: {
      account: { select: { id: true, name: true } },
      contact: { select: { id: true, name: true, email: true } },
      assignee: { select: { id: true, name: true, role: true } },
    },
  });

  await logAudit(prisma, {
    userId: req.user!.id,
    entity: 'TICKETS',
    entityId: ticket.id,
    action: 'CREATE',
    changes: { after: ticket },
  });

  emitDomainEvent('ticket.created', {
    ticketId: ticket.id,
    subject: ticket.subject,
    priority: ticket.priority,
    accountId: ticket.account_id,
    assigneeId: ticket.assignee_id,
  });

  return res.status(201).json({
    ...ticket,
    ticket,
    slaBreached: ticket.sla_breached_at !== null,
    slaDueAt: ticket.sla_due_at,
  });
});

// GET /tickets/:id
ticketsRouter.get('/tickets/:id', async (req: Request, res: Response) => {
  const scopeFilter = scopeFor(req.user!, 'tickets');
  if (scopeFilter === null) {
    return res.status(403).json({ error: 'Forbidden: Insufficient permissions to view tickets' });
  }

  const id = String(req.params.id);
  const ticket = await prisma.ticket.findFirst({
    where: {
      id,
      ...scopeFilter,
    },
    include: {
      account: { select: { id: true, name: true } },
      contact: { select: { id: true, name: true, email: true, phone: true } },
      assignee: { select: { id: true, name: true, email: true, role: true } },
      activities: {
        include: {
          author: { select: { id: true, name: true, role: true, department: true } },
        },
        orderBy: { created_at: 'asc' },
      },
    },
  });

  if (!ticket) {
    return res.status(404).json({ error: 'Ticket not found' });
  }

  return res.json({
    ...ticket,
    ticket,
    canEdit: canWrite(req.user!, 'tickets', ticket),
    slaBreached: ticket.sla_breached_at !== null,
    slaDueAt: ticket.sla_due_at,
  });
});

// PATCH /tickets/:id
ticketsRouter.patch('/tickets/:id', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      assignee: { select: { id: true, team_id: true } },
    },
  });

  if (!ticket) {
    return res.status(404).json({ error: 'Ticket not found' });
  }

  if (!canWrite(req.user!, 'tickets', ticket)) {
    return res.status(403).json({ error: 'Forbidden: You do not have permission to modify tickets' });
  }

  const result = updateTicketSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.issues?.[0]?.message || 'Invalid ticket update' });
  }

  const data = result.data;

  // If first transition to IN_PROGRESS and first_response_at is null, record first_response_at
  let firstResponseAt = ticket.first_response_at;
  if (
    data.status &&
    data.status !== 'OPEN' &&
    ticket.first_response_at === null
  ) {
    firstResponseAt = new Date();
  }

  const updatedTicket = await prisma.ticket.update({
    where: { id },
    data: {
      ...(data.subject && { subject: data.subject }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.priority && { priority: data.priority as any }),
      ...(data.status && { status: data.status as any }),
      ...(data.assigneeId && { assignee_id: data.assigneeId }),
      ...(data.contactId !== undefined && { contact_id: data.contactId }),
      first_response_at: firstResponseAt,
    },
    include: {
      account: { select: { id: true, name: true } },
      contact: { select: { id: true, name: true, email: true } },
      assignee: { select: { id: true, name: true, role: true } },
    },
  });

  await logAudit(prisma, {
    userId: req.user!.id,
    entity: 'TICKETS',
    entityId: id,
    action: 'UPDATE',
    changes: { before: ticket, after: updatedTicket },
  });

  emitDomainEvent('ticket.updated', {
    ticketId: updatedTicket.id,
    status: updatedTicket.status,
  });

  return res.json({
    ...updatedTicket,
    ticket: updatedTicket,
    slaBreached: updatedTicket.sla_breached_at !== null,
    slaDueAt: updatedTicket.sla_due_at,
  });
});

// POST /tickets/:id/replies
ticketsRouter.post('/tickets/:id/replies', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const ticket = await prisma.ticket.findUnique({
    where: { id },
  });

  if (!ticket) {
    return res.status(404).json({ error: 'Ticket not found' });
  }

  const result = replyTicketSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.issues?.[0]?.message || 'Invalid reply message' });
  }

  const { body, isInternal } = result.data;

  // If public reply and first_response_at is null, record first_response_at
  if (!isInternal && ticket.first_response_at === null) {
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { first_response_at: new Date() },
    });
  }

  const activity = await prisma.activity.create({
    data: {
      type: isInternal ? 'INTERNAL_COMMENT' : 'NOTE',
      body,
      is_internal: Boolean(isInternal),
      ticket_id: ticket.id,
      account_id: ticket.account_id,
      contact_id: ticket.contact_id || null,
      author_id: req.user!.id,
    },
    include: {
      author: {
        select: { id: true, name: true, role: true, department: true },
      },
    },
  });

  await logAudit(prisma, {
    userId: req.user!.id,
    entity: 'ACTIVITIES',
    entityId: activity.id,
    action: 'CREATE',
    changes: { after: activity },
  });

  emitDomainEvent('activity:created', {
    activity,
    authorName: req.user!.name,
    mentionedUserIds: [],
  });

  try {
    getIO().emit('tickets:changed', { ticketId: ticket.id });
  } catch {}

  return res.status(201).json(activity);
});

// GET /tickets/:id/alerts - cross-team alert banner check
ticketsRouter.get('/tickets/:id/alerts', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    select: { id: true, account_id: true, subject: true },
  });

  if (!ticket) {
    return res.status(404).json({ error: 'Ticket not found' });
  }

  // Check for active open deals on ticket's account (probability between 1 and 99)
  const deal = await prisma.deal.findFirst({
    where: {
      account_id: ticket.account_id,
      deleted_at: null,
      stage: {
        probability: {
          gt: 0,
          lt: 100,
        },
      },
    },
    orderBy: [
      { amount: 'desc' }, // Highest value deal first
      { created_at: 'desc' },
    ],
    include: {
      stage: { select: { name: true, probability: true } },
    },
  });

  return res.json({
    hasActiveDeal: Boolean(deal),
    deal: deal
      ? {
          id: deal.id,
          title: deal.title,
          amount: deal.amount,
          stageName: deal.stage.name,
        }
      : null,
  });
});
