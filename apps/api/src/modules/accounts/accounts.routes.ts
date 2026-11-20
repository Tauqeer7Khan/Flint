import { Router, Request, Response } from 'express';
import { createAccountSchema, updateAccountSchema } from '@flint/shared';
import { prisma } from '../../lib/prisma';
import { logAudit } from '../../lib/audit';
import { authMiddleware } from '../../middleware/auth';
import { scopeFor, canWrite } from '../../middleware/rbac';
import { computePulse } from '../../lib/pulse';

export const accountsRouter = Router();

accountsRouter.use(authMiddleware);

// GET /accounts
accountsRouter.get('/accounts', async (req: Request, res: Response) => {
  const scopeFilter = scopeFor(req.user!, 'accounts');
  if (scopeFilter === null) {
    return res.status(403).json({ error: 'Forbidden: Insufficient permissions to view accounts' });
  }

  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

  const where: any = {
    deleted_at: null,
    ...scopeFilter,
  };

  if (search) {
    where.name = { contains: search, mode: 'insensitive' };
  }

  const [items, total] = await Promise.all([
    prisma.account.findMany({
      where,
      include: {
        owner: { select: { id: true, name: true, email: true } },
        _count: {
          select: {
            contacts: { where: { deleted_at: null } },
            deals: { where: { deleted_at: null } },
          },
        },
      },
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.account.count({ where }),
  ]);

  const itemsWithPulse = await Promise.all(
    items.map(async (acc) => {
      const pulse = await computePulse(acc.id);
      return { ...acc, pulse };
    })
  );

  return res.json({
    items: itemsWithPulse,
    data: itemsWithPulse,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
});

// POST /accounts
accountsRouter.post('/accounts', async (req: Request, res: Response) => {
  if (!canWrite(req.user!, 'accounts')) {
    return res.status(403).json({ error: 'Forbidden: Cannot create accounts' });
  }

  const result = createAccountSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.issues?.[0]?.message || 'Invalid account data' });
  }

  const data = result.data;
  const ownerId = data.ownerId || req.user!.id;

  const account = await prisma.account.create({
    data: {
      name: data.name,
      owner_id: ownerId,
      custom_fields: data.customFields || {},
    },
    include: {
      owner: { select: { id: true, name: true, email: true } },
    },
  });

  await logAudit(prisma, {
    userId: req.user!.id,
    entity: 'ACCOUNTS',
    entityId: account.id,
    action: 'CREATE',
    changes: { after: account },
  });

  return res.status(201).json(account);
});

// GET /accounts/:id
accountsRouter.get('/accounts/:id', async (req: Request, res: Response) => {
  const scopeFilter = scopeFor(req.user!, 'accounts');
  if (scopeFilter === null) {
    return res.status(403).json({ error: 'Forbidden: Insufficient permissions to view accounts' });
  }

  const id = String(req.params.id);
  const account = await prisma.account.findFirst({
    where: {
      id,
      deleted_at: null,
      ...scopeFilter,
    },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      contacts: { where: { deleted_at: null } },
      deals: {
        where: { deleted_at: null },
        include: { stage: true },
      },
      _count: {
        select: {
          contacts: { where: { deleted_at: null } },
          deals: { where: { deleted_at: null } },
        },
      },
    },
  });

  if (!account) {
    return res.status(404).json({ error: 'Account not found' });
  }

  return res.json(account);
});

// PATCH /accounts/:id
accountsRouter.patch('/accounts/:id', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const existingAccount = await prisma.account.findUnique({
    where: { id },
    include: { owner: true },
  });

  if (!existingAccount || existingAccount.deleted_at) {
    return res.status(404).json({ error: 'Account not found' });
  }

  if (!canWrite(req.user!, 'accounts', existingAccount)) {
    return res.status(403).json({ error: 'Forbidden: Cannot edit this account' });
  }

  const result = updateAccountSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.issues?.[0]?.message || 'Invalid account data' });
  }

  const data = result.data;
  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.ownerId !== undefined) updateData.owner_id = data.ownerId;
  if (data.customFields !== undefined) updateData.custom_fields = data.customFields;

  const updatedAccount = await prisma.account.update({
    where: { id },
    data: updateData,
    include: {
      owner: { select: { id: true, name: true, email: true } },
    },
  });

  await logAudit(prisma, {
    userId: req.user!.id,
    entity: 'ACCOUNTS',
    entityId: updatedAccount.id,
    action: 'UPDATE',
    changes: { before: existingAccount, after: updatedAccount },
  });

  return res.json(updatedAccount);
});

// DELETE /accounts/:id (Soft delete)
accountsRouter.delete('/accounts/:id', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const existingAccount = await prisma.account.findUnique({
    where: { id },
    include: { owner: true },
  });

  if (!existingAccount || existingAccount.deleted_at) {
    return res.status(404).json({ error: 'Account not found' });
  }

  if (!canWrite(req.user!, 'accounts', existingAccount)) {
    return res.status(403).json({ error: 'Forbidden: Cannot delete this account' });
  }

  await prisma.account.update({
    where: { id },
    data: { deleted_at: new Date() },
  });

  await logAudit(prisma, {
    userId: req.user!.id,
    entity: 'ACCOUNTS',
    entityId: id,
    action: 'DELETE',
    changes: { before: existingAccount },
  });

  return res.json({ ok: true });
});
