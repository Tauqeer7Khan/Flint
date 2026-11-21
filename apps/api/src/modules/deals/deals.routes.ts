import { Router, Request, Response } from 'express';
import {
  createDealSchema,
  updateDealSchema,
  changeDealStageSchema,
  formatINR,
} from '@flint/shared';
import { prisma } from '../../lib/prisma';
import { logAudit } from '../../lib/audit';
import { authMiddleware } from '../../middleware/auth';
import { scopeFor, canWrite } from '../../middleware/rbac';
import { emitDomainEvent } from '../../lib/events';

export const dealsRouter = Router();

// Apply auth to all routes
dealsRouter.use(authMiddleware);

// GET /pipeline/stages (Must be registered before /deals/:id to avoid parameter clash)
dealsRouter.get('/pipeline/stages', async (_req: Request, res: Response) => {
  const stages = await prisma.pipelineStage.findMany({
    orderBy: { order_index: 'asc' },
  });
  return res.json({ items: stages, data: stages });
});

// GET /deals
dealsRouter.get('/deals', async (req: Request, res: Response) => {
  const scopeFilter = scopeFor(req.user!, 'deals');
  if (scopeFilter === null) {
    return res.status(403).json({ error: 'Forbidden: Insufficient permissions to access deals' });
  }

  const where: any = {
    deleted_at: null,
    ...scopeFilter,
  };

  const stageId = req.query.stageId as string | undefined;
  if (stageId) {
    where.stage_id = stageId;
  }

  const deals = await prisma.deal.findMany({
    where,
    include: {
      account: { select: { id: true, name: true } },
      contact: { select: { id: true, name: true, email: true } },
      owner: { select: { id: true, name: true, email: true, team_id: true } },
      stage: true,
    },
    orderBy: { created_at: 'desc' },
  });

  return res.json({
    items: deals,
    data: deals,
    total: deals.length,
  });
});

// POST /deals
dealsRouter.post('/deals', async (req: Request, res: Response) => {
  if (!canWrite(req.user!, 'deals')) {
    return res.status(403).json({ error: 'Forbidden: You do not have permission to create deals' });
  }

  const result = createDealSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.issues?.[0]?.message || 'Invalid deal data' });
  }

  const data = result.data;

  // Resolve stage: use provided or find first stage by order_index
  let targetStageId = data.stageId;
  if (!targetStageId) {
    const firstStage = await prisma.pipelineStage.findFirst({
      orderBy: { order_index: 'asc' },
    });
    if (!firstStage) {
      return res.status(500).json({ error: 'No pipeline stages configured' });
    }
    targetStageId = firstStage.id;
  }

  const ownerId = data.ownerId || req.user!.id;

  const deal = await prisma.deal.create({
    data: {
      title: data.title,
      amount: data.amount,
      employees: data.employees,
      account_id: data.accountId,
      contact_id: data.contactId || null,
      owner_id: ownerId,
      stage_id: targetStageId,
    },
    include: {
      account: { select: { id: true, name: true } },
      contact: { select: { id: true, name: true, email: true } },
      owner: { select: { id: true, name: true, email: true, team_id: true } },
      stage: true,
    },
  });

  await logAudit(prisma, {
    userId: req.user!.id,
    entity: 'DEALS',
    entityId: deal.id,
    action: 'CREATE',
    changes: { after: deal },
  });

  emitDomainEvent('deal.created', {
    dealId: deal.id,
    title: deal.title,
    amount: deal.amount,
    accountId: deal.account_id,
    ownerId: deal.owner_id,
  });

  return res.status(201).json(deal);
});

// GET /deals/:id
dealsRouter.get('/deals/:id', async (req: Request, res: Response) => {
  const scopeFilter = scopeFor(req.user!, 'deals');
  if (scopeFilter === null) {
    return res.status(403).json({ error: 'Forbidden: Insufficient permissions to view deals' });
  }

  const id = String(req.params.id);
  const deal = await prisma.deal.findFirst({
    where: {
      id,
      deleted_at: null,
      ...scopeFilter,
    },
    include: {
      account: { select: { id: true, name: true } },
      contact: { select: { id: true, name: true, email: true } },
      owner: { select: { id: true, name: true, email: true, team_id: true } },
      stage: true,
      stage_history: {
        include: {
          from_stage: true,
          to_stage: true,
          user: { select: { id: true, name: true } },
        },
        orderBy: { changed_at: 'desc' },
      },
    },
  });

  if (!deal) {
    return res.status(404).json({ error: 'Deal not found' });
  }

  return res.json(deal);
});

// PATCH /deals/:id/stage
dealsRouter.patch('/deals/:id/stage', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const existing = await prisma.deal.findFirst({
    where: { id, deleted_at: null },
    include: {
      owner: { select: { id: true, team_id: true } },
      stage: true,
    },
  });

  if (!existing) {
    return res.status(404).json({ error: 'Deal not found' });
  }

  if (!canWrite(req.user!, 'deals', existing)) {
    return res.status(403).json({ error: 'Forbidden: You cannot modify this deal' });
  }

  const result = changeDealStageSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.issues?.[0]?.message || 'Invalid stage data' });
  }

  const newStage = await prisma.pipelineStage.findUnique({
    where: { id: result.data.stageId },
  });

  if (!newStage) {
    return res.status(400).json({ error: 'Target stage does not exist' });
  }

  const fromStageId = existing.stage_id;
  const toStageId = newStage.id;

  const updatedDeal = await prisma.$transaction(async (tx) => {
    const deal = await tx.deal.update({
      where: { id: existing.id },
      data: { stage_id: toStageId },
      include: {
        account: { select: { id: true, name: true } },
        owner: { select: { id: true, name: true, email: true, team_id: true } },
        stage: true,
      },
    });

    await tx.dealStageHistory.create({
      data: {
        deal_id: deal.id,
        from_stage_id: fromStageId,
        to_stage_id: toStageId,
        changed_by: req.user!.id,
      },
    });

    await logAudit(tx, {
      userId: req.user!.id,
      entity: 'DEALS',
      entityId: deal.id,
      action: 'UPDATE',
      changes: {
        before: { stageId: fromStageId, stageName: existing.stage.name },
        after: { stageId: toStageId, stageName: newStage.name },
      },
    });

    // Auto SYSTEM activity for stage movement
    await tx.activity.create({
      data: {
        type: 'SYSTEM',
        body: `Deal moved from ${existing.stage.name} to ${newStage.name} by ${req.user!.name}`,
        account_id: existing.account_id,
        deal_id: deal.id,
        is_internal: false,
      },
    });

    return deal;
  });

  // Emit deal.stage_changed
  emitDomainEvent('deal.stage_changed', {
    dealId: updatedDeal.id,
    fromStageId,
    toStageId,
    changedBy: req.user!.id,
  });

  // If new stage is Closed Won (probability 100), also emit deal.won and create SYSTEM won activity
  if (newStage.probability === 100) {
    const formattedAmount = formatINR(updatedDeal.amount);
    await prisma.activity.create({
      data: {
        type: 'SYSTEM',
        body: `🎉 Deal won — ${updatedDeal.title} (${formattedAmount})`,
        account_id: updatedDeal.account_id,
        deal_id: updatedDeal.id,
        is_internal: false,
      },
    });

    emitDomainEvent('deal.won', {
      dealId: updatedDeal.id,
      accountId: updatedDeal.account_id,
      ownerId: updatedDeal.owner_id,
      amount: updatedDeal.amount,
      employees: updatedDeal.employees,
      title: updatedDeal.title,
    });
  }

  return res.json(updatedDeal);
});

// PATCH /deals/:id
dealsRouter.patch('/deals/:id', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const existing = await prisma.deal.findFirst({
    where: { id, deleted_at: null },
    include: {
      owner: { select: { id: true, team_id: true } },
    },
  });

  if (!existing) {
    return res.status(404).json({ error: 'Deal not found' });
  }

  if (!canWrite(req.user!, 'deals', existing)) {
    return res.status(403).json({ error: 'Forbidden: You cannot modify this deal' });
  }

  const result = updateDealSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.issues?.[0]?.message || 'Invalid deal data' });
  }

  const data = result.data;
  const updatedDeal = await prisma.deal.update({
    where: { id },
    data: {
      ...(data.title && { title: data.title }),
      ...(data.amount !== undefined && { amount: data.amount }),
      ...(data.employees !== undefined && { employees: data.employees }),
      ...(data.accountId && { account_id: data.accountId }),
      ...(data.contactId !== undefined && { contact_id: data.contactId }),
      ...(data.ownerId !== undefined && { owner_id: data.ownerId }),
      ...(data.stageId && { stage_id: data.stageId }),
    },
    include: {
      account: { select: { id: true, name: true } },
      contact: { select: { id: true, name: true, email: true } },
      owner: { select: { id: true, name: true, email: true, team_id: true } },
      stage: true,
    },
  });

  await logAudit(prisma, {
    userId: req.user!.id,
    entity: 'DEALS',
    entityId: updatedDeal.id,
    action: 'UPDATE',
    changes: { before: existing, after: updatedDeal },
  });

  return res.json(updatedDeal);
});

// DELETE /deals/:id
dealsRouter.delete('/deals/:id', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const existing = await prisma.deal.findFirst({
    where: { id, deleted_at: null },
    include: {
      owner: { select: { id: true, team_id: true } },
    },
  });

  if (!existing) {
    return res.status(404).json({ error: 'Deal not found' });
  }

  if (!canWrite(req.user!, 'deals', existing)) {
    return res.status(403).json({ error: 'Forbidden: You cannot delete this deal' });
  }

  await prisma.deal.update({
    where: { id },
    data: { deleted_at: new Date() },
  });

  await logAudit(prisma, {
    userId: req.user!.id,
    entity: 'DEALS',
    entityId: id,
    action: 'DELETE',
    changes: { before: existing },
  });

  return res.json({ success: true, message: 'Deal deleted successfully' });
});

// GET /deals/:id/alerts - cross-team alert banner check
dealsRouter.get('/deals/:id/alerts', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const deal = await prisma.deal.findFirst({
    where: { id, deleted_at: null },
    select: { id: true, account_id: true, title: true },
  });

  if (!deal) {
    return res.status(404).json({ error: 'Deal not found' });
  }

  // Check for open high/urgent tickets on deal's account
  const ticket = await prisma.ticket.findFirst({
    where: {
      account_id: deal.account_id,
      status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING'] },
      priority: { in: ['HIGH', 'URGENT'] },
    },
    orderBy: [
      { priority: 'desc' }, // URGENT first
      { created_at: 'desc' },
    ],
    select: {
      id: true,
      subject: true,
      priority: true,
      status: true,
    },
  });

  return res.json({
    hasHighPriorityTicket: Boolean(ticket),
    ticket: ticket || null,
  });
});
