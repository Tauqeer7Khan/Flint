import { Router, Request, Response } from 'express';
import { createQuoteSchema } from '@flint/shared';
import { prisma } from '../../lib/prisma';
import { logAudit } from '../../lib/audit';
import { authMiddleware } from '../../middleware/auth';
import { canWrite } from '../../middleware/rbac';

export const quotesRouter = Router();

// Apply auth to all routes
quotesRouter.use(authMiddleware);

// GET /products
quotesRouter.get('/products', async (_req: Request, res: Response) => {
  const products = await prisma.product.findMany({
    where: { is_active: true },
    select: {
      id: true,
      name: true,
      price_per_employee_month: true,
      is_active: true,
    },
    orderBy: { name: 'asc' },
  });

  return res.json({ items: products, data: products });
});

// GET /deals/:id/quotes
quotesRouter.get('/deals/:id/quotes', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const quotes = await prisma.document.findMany({
    where: {
      deal_id: id,
      type: 'QUOTE',
    },
    include: {
      items: {
        include: {
          product: {
            select: { id: true, name: true, price_per_employee_month: true },
          },
        },
      },
    },
    orderBy: { created_at: 'desc' },
  });

  return res.json({ items: quotes, data: quotes });
});

// POST /deals/:id/quotes
quotesRouter.post('/deals/:id/quotes', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const deal = await prisma.deal.findFirst({
    where: { id, deleted_at: null },
    include: {
      owner: { select: { id: true, team_id: true } },
    },
  });

  if (!deal) {
    return res.status(404).json({ error: 'Deal not found' });
  }

  if (!canWrite(req.user!, 'deals', deal)) {
    return res.status(403).json({ error: 'Forbidden: You cannot create quotes for this deal' });
  }

  const result = createQuoteSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.issues?.[0]?.message || 'Invalid quote data' });
  }

  const { employees, productIds, updateDealAmount } = result.data;

  // Fetch products from database (server-authoritative pricing)
  const products = await prisma.product.findMany({
    where: {
      id: { in: productIds },
      is_active: true,
    },
  });

  if (products.length !== productIds.length) {
    return res.status(400).json({ error: 'One or more selected products are invalid or inactive' });
  }

  // Calculate pricing
  const sumPricePerEmpMonth = products.reduce((acc, p) => acc + p.price_per_employee_month, 0);
  const monthlyTotal = employees * sumPricePerEmpMonth;
  const annualTotal = monthlyTotal * 12;

  // Generate unique Quote number Q-YYYY-####
  const currentYear = new Date().getFullYear();
  const quoteCount = await prisma.document.count({
    where: { type: 'QUOTE' },
  });
  const quoteNumber = `Q-${currentYear}-${String(quoteCount + 1).padStart(4, '0')}`;

  const createdDocument = await prisma.$transaction(async (tx) => {
    const document = await tx.document.create({
      data: {
        type: 'QUOTE',
        number: quoteNumber,
        monthly_total: monthlyTotal,
        annual_total: annualTotal,
        account_id: deal.account_id,
        deal_id: deal.id,
        items: {
          create: products.map((p) => ({
            product_id: p.id,
            qty: employees,
            unit_price: p.price_per_employee_month,
          })),
        },
      },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, price_per_employee_month: true } },
          },
        },
      },
    });

    if (updateDealAmount) {
      await tx.deal.update({
        where: { id: deal.id },
        data: {
          amount: annualTotal,
          employees: employees,
        },
      });
    }

    await logAudit(tx, {
      userId: req.user!.id,
      entity: 'DOCUMENTS',
      entityId: document.id,
      action: 'CREATE',
      changes: {
        after: {
          number: quoteNumber,
          monthlyTotal,
          annualTotal,
          employees,
          dealId: deal.id,
        },
      },
    });

    return document;
  });

  return res.status(201).json(createdDocument);
});
