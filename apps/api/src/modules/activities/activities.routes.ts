import { Router, Request, Response } from 'express';
import { createActivitySchema } from '@flint/shared';
import { prisma } from '../../lib/prisma';
import { logAudit } from '../../lib/audit';
import { authMiddleware } from '../../middleware/auth';
import { emitDomainEvent } from '../../lib/events';
import { computePulse } from '../../lib/pulse';

export const activitiesRouter = Router();

// Apply auth to all routes
activitiesRouter.use(authMiddleware);

// GET /activities
activitiesRouter.get('/activities', async (req: Request, res: Response) => {
  const accountId = req.query.accountId as string | undefined;
  const leadId = req.query.leadId as string | undefined;
  const dealId = req.query.dealId as string | undefined;
  const ticketId = req.query.ticketId as string | undefined;
  const contactId = req.query.contactId as string | undefined;
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));

  // Visibility rule: SUPPORT_AGENT must NEVER see activities linked to leads
  if (req.user!.role === 'SUPPORT_AGENT' && leadId) {
    return res.status(403).json({ error: 'Forbidden: Insufficient permissions to view lead activities' });
  }

  const where: any = {};

  if (req.user!.role === 'SUPPORT_AGENT') {
    where.lead_id = null;
  }

  if (accountId) where.account_id = accountId;
  if (leadId) where.lead_id = leadId;
  if (dealId) where.deal_id = dealId;
  if (ticketId) where.ticket_id = ticketId;
  if (contactId) where.contact_id = contactId;

  const [items, total] = await Promise.all([
    prisma.activity.findMany({
      where,
      include: {
        author: {
          select: { id: true, name: true, role: true, department: true },
        },
        account: {
          select: { id: true, name: true },
        },
      },
      orderBy: { created_at: 'desc' },
      take: limit,
    }),
    prisma.activity.count({ where }),
  ]);

  return res.json({
    items,
    data: items,
    total,
  });
});

// POST /activities
activitiesRouter.post('/activities', async (req: Request, res: Response) => {
  // Disallow SYSTEM type from user creation
  if (req.body?.type === 'SYSTEM') {
    return res.status(400).json({ error: 'SYSTEM activity type can only be created by system actions' });
  }

  const result = createActivitySchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.issues?.[0]?.message || 'Invalid activity data' });
  }

  const data = result.data;

  // Verify account exists
  const account = await prisma.account.findFirst({
    where: { id: data.accountId, deleted_at: null },
  });
  if (!account) {
    return res.status(404).json({ error: 'Associated account not found' });
  }

  // Validate mention user IDs exist in DB
  let validMentionIds: string[] = [];
  if (data.mentions && data.mentions.length > 0) {
    const foundUsers = await prisma.user.findMany({
      where: { id: { in: data.mentions } },
      select: { id: true },
    });
    validMentionIds = foundUsers.map((u) => u.id);
  }

  // Coerce is_internal if type is INTERNAL_COMMENT
  const isInternal = data.type === 'INTERNAL_COMMENT' ? true : Boolean(data.isInternal);

  const activity = await prisma.activity.create({
    data: {
      type: data.type,
      body: data.body,
      is_internal: isInternal,
      mentions: validMentionIds,
      author_id: req.user!.id,
      account_id: data.accountId,
      lead_id: data.leadId || null,
      contact_id: data.contactId || null,
      deal_id: data.dealId || null,
      ticket_id: data.ticketId || null,
    },
    include: {
      author: {
        select: { id: true, name: true, role: true, department: true },
      },
      account: {
        select: { id: true, name: true },
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
    mentionedUserIds: validMentionIds,
  });

  return res.status(201).json(activity);
});

// GET /accounts/:id/360
activitiesRouter.get('/accounts/:id/360', async (req: Request, res: Response) => {
  const id = String(req.params.id);

  const account = await prisma.account.findFirst({
    where: { id, deleted_at: null },
    include: {
      owner: { select: { id: true, name: true, email: true } },
    },
  });

  if (!account) {
    return res.status(404).json({ error: 'Account not found' });
  }

  const isSupport = req.user!.role === 'SUPPORT_AGENT';

  const [contacts, deals, tasks, tickets, quotes, timeline, pulse] = await Promise.all([
    // Contacts
    prisma.contact.findMany({
      where: { account_id: id, deleted_at: null },
      orderBy: { name: 'asc' },
    }),

    // Deals
    prisma.deal.findMany({
      where: { account_id: id, deleted_at: null },
      include: {
        stage: { select: { id: true, name: true, probability: true } },
        owner: { select: { id: true, name: true } },
      },
      orderBy: { created_at: 'desc' },
    }),

    // Open Tasks
    prisma.task.findMany({
      where: { account_id: id, status: { not: 'COMPLETED' } },
      include: {
        assignee: { select: { id: true, name: true } },
      },
      orderBy: { due_at: 'asc' },
    }),

    // Open Tickets
    prisma.ticket.findMany({
      where: { account_id: id, status: { not: 'CLOSED' } },
      include: {
        assignee: { select: { id: true, name: true } },
      },
      orderBy: { created_at: 'desc' },
    }),

    // Quotes
    prisma.document.findMany({
      where: { account_id: id, type: 'QUOTE' },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, price_per_employee_month: true } },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    }),

    // Activity Timeline (last 50, exclude lead-linked internal activities for Support Agent)
    prisma.activity.findMany({
      where: {
        account_id: id,
        ...(isSupport ? { lead_id: null } : {}),
      },
      include: {
        author: {
          select: { id: true, name: true, role: true, department: true },
        },
      },
      orderBy: { created_at: 'desc' },
      take: 50,
    }),

    // Account Pulse health score
    computePulse(id),
  ]);

  return res.json({
    account,
    contacts,
    deals,
    tasks,
    tickets,
    quotes,
    timeline,
    pulse,
  });
});
