import { Router, Request, Response } from 'express';
import { createContactSchema, updateContactSchema } from '@flint/shared';
import { prisma } from '../../lib/prisma';
import { logAudit } from '../../lib/audit';
import { authMiddleware } from '../../middleware/auth';
import { scopeFor, canWrite } from '../../middleware/rbac';

export const contactsRouter = Router();

contactsRouter.use(authMiddleware);

// GET /contacts
contactsRouter.get('/contacts', async (req: Request, res: Response) => {
  const scopeFilter = scopeFor(req.user!, 'contacts');
  if (scopeFilter === null) {
    return res.status(403).json({ error: 'Forbidden: Insufficient permissions to view contacts' });
  }

  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

  const where: any = {
    deleted_at: null,
    ...scopeFilter,
  };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { designation: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      include: {
        account: { select: { id: true, name: true } },
        owner: { select: { id: true, name: true, email: true } },
      },
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.contact.count({ where }),
  ]);

  return res.json({
    items,
    data: items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
});

// POST /contacts
contactsRouter.post('/contacts', async (req: Request, res: Response) => {
  if (!canWrite(req.user!, 'contacts')) {
    return res.status(403).json({ error: 'Forbidden: Cannot create contacts' });
  }

  const result = createContactSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.issues?.[0]?.message || 'Invalid contact data' });
  }

  const data = result.data;
  const ownerId = data.ownerId || req.user!.id;

  // Verify account exists
  const account = await prisma.account.findUnique({
    where: { id: data.accountId },
  });
  if (!account || account.deleted_at) {
    return res.status(404).json({ error: 'Target account not found' });
  }

  const contact = await prisma.contact.create({
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone || null,
      designation: data.designation || null,
      account_id: data.accountId,
      owner_id: ownerId,
      custom_fields: data.customFields || {},
    },
    include: {
      account: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true, email: true } },
    },
  });

  await logAudit(prisma, {
    userId: req.user!.id,
    entity: 'CONTACTS',
    entityId: contact.id,
    action: 'CREATE',
    changes: { after: contact },
  });

  return res.status(201).json(contact);
});

// GET /contacts/:id
contactsRouter.get('/contacts/:id', async (req: Request, res: Response) => {
  const scopeFilter = scopeFor(req.user!, 'contacts');
  if (scopeFilter === null) {
    return res.status(403).json({ error: 'Forbidden: Insufficient permissions to view contacts' });
  }

  const id = String(req.params.id);
  const contact = await prisma.contact.findFirst({
    where: {
      id,
      deleted_at: null,
      ...scopeFilter,
    },
    include: {
      account: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true, email: true } },
    },
  });

  if (!contact) {
    return res.status(404).json({ error: 'Contact not found' });
  }

  return res.json(contact);
});

// PATCH /contacts/:id
contactsRouter.patch('/contacts/:id', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const existingContact = await prisma.contact.findUnique({
    where: { id },
    include: { owner: true },
  });

  if (!existingContact || existingContact.deleted_at) {
    return res.status(404).json({ error: 'Contact not found' });
  }

  if (!canWrite(req.user!, 'contacts', existingContact)) {
    return res.status(403).json({ error: 'Forbidden: Cannot edit this contact' });
  }

  const result = updateContactSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.issues?.[0]?.message || 'Invalid contact data' });
  }

  const data = result.data;
  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.designation !== undefined) updateData.designation = data.designation;
  if (data.accountId !== undefined) updateData.account_id = data.accountId;
  if (data.ownerId !== undefined) updateData.owner_id = data.ownerId;
  if (data.customFields !== undefined) updateData.custom_fields = data.customFields;

  const updatedContact = await prisma.contact.update({
    where: { id },
    data: updateData,
    include: {
      account: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true, email: true } },
    },
  });

  await logAudit(prisma, {
    userId: req.user!.id,
    entity: 'CONTACTS',
    entityId: updatedContact.id,
    action: 'UPDATE',
    changes: { before: existingContact, after: updatedContact },
  });

  return res.json(updatedContact);
});

// DELETE /contacts/:id (Soft delete)
contactsRouter.delete('/contacts/:id', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const existingContact = await prisma.contact.findUnique({
    where: { id },
    include: { owner: true },
  });

  if (!existingContact || existingContact.deleted_at) {
    return res.status(404).json({ error: 'Contact not found' });
  }

  if (!canWrite(req.user!, 'contacts', existingContact)) {
    return res.status(403).json({ error: 'Forbidden: Cannot delete this contact' });
  }

  await prisma.contact.update({
    where: { id },
    data: { deleted_at: new Date() },
  });

  await logAudit(prisma, {
    userId: req.user!.id,
    entity: 'CONTACTS',
    entityId: id,
    action: 'DELETE',
    changes: { before: existingContact },
  });

  return res.json({ ok: true });
});
