import { Router, Request, Response } from 'express';
import {
  createLeadSchema,
  updateLeadSchema,
  convertLeadSchema,
} from '@flint/shared';
import { prisma } from '../../lib/prisma';
import { logAudit } from '../../lib/audit';
import { authMiddleware } from '../../middleware/auth';
import { scopeFor, canWrite } from '../../middleware/rbac';
import { emitDomainEvent } from '../../lib/events';

export const leadsRouter = Router();

// Apply auth to all lead routes
leadsRouter.use(authMiddleware);

// GET /leads
leadsRouter.get('/leads', async (req: Request, res: Response) => {
  const scopeFilter = scopeFor(req.user!, 'leads');
  if (scopeFilter === null) {
    return res.status(403).json({ error: 'Forbidden: Insufficient permissions to access leads' });
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
      { company_name: { contains: search, mode: 'insensitive' } },
      { contact_name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.lead.count({ where }),
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

// POST /leads
leadsRouter.post('/leads', async (req: Request, res: Response) => {
  if (!canWrite(req.user!, 'leads')) {
    return res.status(403).json({ error: 'Forbidden: Cannot create leads' });
  }

  const result = createLeadSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.issues?.[0]?.message || 'Invalid lead data' });
  }

  const data = result.data;
  const ownerId = data.ownerId || req.user!.id;

  const lead = await prisma.lead.create({
    data: {
      company_name: data.companyName,
      contact_name: data.contactName,
      email: data.email,
      phone: data.phone || null,
      source: data.source,
      status: data.status || 'NEW',
      owner_id: ownerId,
      consent: data.consent ?? true,
      custom_fields: data.customFields || {},
    },
    include: {
      owner: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  await logAudit(prisma, {
    userId: req.user!.id,
    entity: 'LEADS',
    entityId: lead.id,
    action: 'CREATE',
    changes: { after: lead },
  });

  emitDomainEvent('lead.created', {
    leadId: lead.id,
    companyName: lead.company_name,
    source: lead.source,
    ownerId: lead.owner_id,
    companySize: (lead.custom_fields as any)?.companySize,
    customFields: lead.custom_fields,
  });

  return res.status(201).json(lead);
});

// GET /leads/:id
leadsRouter.get('/leads/:id', async (req: Request, res: Response) => {
  const scopeFilter = scopeFor(req.user!, 'leads');
  if (scopeFilter === null) {
    return res.status(403).json({ error: 'Forbidden: Insufficient permissions to view leads' });
  }

  const id = String(req.params.id);
  const lead = await prisma.lead.findFirst({
    where: {
      id,
      deleted_at: null,
      ...scopeFilter,
    },
    include: {
      owner: { select: { id: true, name: true, email: true } },
    },
  });

  if (!lead) {
    return res.status(404).json({ error: 'Lead not found' });
  }

  return res.json(lead);
});

// PATCH /leads/:id
leadsRouter.patch('/leads/:id', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const existingLead = await prisma.lead.findUnique({
    where: { id },
    include: { owner: true },
  });

  if (!existingLead || existingLead.deleted_at) {
    return res.status(404).json({ error: 'Lead not found' });
  }

  if (!canWrite(req.user!, 'leads', existingLead)) {
    return res.status(403).json({ error: 'Forbidden: Cannot edit this lead' });
  }

  const result = updateLeadSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.issues?.[0]?.message || 'Invalid lead data' });
  }

  const data = result.data;
  const updateData: any = {};
  if (data.companyName !== undefined) updateData.company_name = data.companyName;
  if (data.contactName !== undefined) updateData.contact_name = data.contactName;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.source !== undefined) updateData.source = data.source;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.ownerId !== undefined) updateData.owner_id = data.ownerId;
  if (data.consent !== undefined) updateData.consent = data.consent;
  if (data.customFields !== undefined) updateData.custom_fields = data.customFields;

  const updatedLead = await prisma.lead.update({
    where: { id },
    data: updateData,
    include: {
      owner: { select: { id: true, name: true, email: true } },
    },
  });

  await logAudit(prisma, {
    userId: req.user!.id,
    entity: 'LEADS',
    entityId: updatedLead.id,
    action: 'UPDATE',
    changes: { before: existingLead, after: updatedLead },
  });

  return res.json(updatedLead);
});

// DELETE /leads/:id (Soft delete)
leadsRouter.delete('/leads/:id', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const existingLead = await prisma.lead.findUnique({
    where: { id },
    include: { owner: true },
  });

  if (!existingLead || existingLead.deleted_at) {
    return res.status(404).json({ error: 'Lead not found' });
  }

  if (!canWrite(req.user!, 'leads', existingLead)) {
    return res.status(403).json({ error: 'Forbidden: Cannot delete this lead' });
  }

  await prisma.lead.update({
    where: { id },
    data: { deleted_at: new Date() },
  });

  await logAudit(prisma, {
    userId: req.user!.id,
    entity: 'LEADS',
    entityId: id,
    action: 'DELETE',
    changes: { before: existingLead },
  });

  return res.json({ ok: true });
});

// POST /leads/:id/convert (Convert Lead → Account + Contact + Deal)
leadsRouter.post('/leads/:id/convert', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const existingLead = await prisma.lead.findUnique({
    where: { id },
    include: { owner: true },
  });

  if (!existingLead || existingLead.deleted_at) {
    return res.status(404).json({ error: 'Lead not found' });
  }

  if (existingLead.status === 'CONVERTED') {
    return res.status(400).json({ error: 'Lead has already been converted' });
  }

  if (!canWrite(req.user!, 'leads', existingLead)) {
    return res.status(403).json({ error: 'Forbidden: Cannot convert this lead' });
  }

  const result = convertLeadSchema.safeParse({
    leadId: id,
    ...req.body,
  });

  if (!result.success) {
    return res.status(400).json({ error: result.error.issues?.[0]?.message || 'Invalid conversion payload' });
  }

  const { dealTitle, dealAmount, employees, selectedModules } = result.data;

  // Single transaction for atomicity
  const conversionResult = await prisma.$transaction(async (tx) => {
    const ownerId = existingLead.owner_id || req.user!.id;
    const customFields = (existingLead.custom_fields as any) || {};

    // 1. Create Account
    const account = await tx.account.create({
      data: {
        name: existingLead.company_name,
        owner_id: ownerId,
        custom_fields: customFields,
      },
    });

    // 2. Create Contact
    const contact = await tx.contact.create({
      data: {
        name: existingLead.contact_name,
        email: existingLead.email,
        phone: existingLead.phone,
        designation: customFields.hrContactDesignation || null,
        account_id: account.id,
        owner_id: ownerId,
        custom_fields: customFields,
      },
    });

    // 3. Fetch first Pipeline Stage (Waitlist)
    let stage = await tx.pipelineStage.findFirst({
      where: { name: 'Waitlist' },
    });
    if (!stage) {
      stage = await tx.pipelineStage.findFirst({
        orderBy: { order_index: 'asc' },
      });
    }
    if (!stage) {
      throw new Error('No active pipeline stage found');
    }

    // 4. Create Deal
    const deal = await tx.deal.create({
      data: {
        title: dealTitle,
        amount: Math.round(dealAmount),
        employees: employees,
        stage_id: stage.id,
        account_id: account.id,
        contact_id: contact.id,
        owner_id: ownerId,
        custom_fields: {
          selectedModules: selectedModules || [],
        },
      },
    });

    // 5. Update Lead status
    const updatedLead = await tx.lead.update({
      where: { id: existingLead.id },
      data: { status: 'CONVERTED' },
    });

    // 6. Log Audit
    await logAudit(tx, {
      userId: req.user!.id,
      entity: 'LEADS',
      entityId: existingLead.id,
      action: 'CONVERT',
      changes: {
        before: { status: existingLead.status },
        after: {
          status: 'CONVERTED',
          accountId: account.id,
          contactId: contact.id,
          dealId: deal.id,
        },
      },
    });

    // 7. Create SYSTEM Activity for auto timeline record
    await tx.activity.create({
      data: {
        type: 'SYSTEM',
        body: 'Lead converted: Account + Contact + Deal created',
        account_id: account.id,
        lead_id: existingLead.id,
        contact_id: contact.id,
        deal_id: deal.id,
        is_internal: false,
      },
    });

    return { account, contact, deal, lead: updatedLead };
  });

  emitDomainEvent('lead.converted', {
    leadId: conversionResult.lead.id,
    accountId: conversionResult.account.id,
    contactId: conversionResult.contact.id,
    dealId: conversionResult.deal.id,
  });

  return res.json(conversionResult);
});
