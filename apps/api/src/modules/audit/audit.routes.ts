import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { authMiddleware } from '../../middleware/auth';

export const auditRouter = Router();

// Apply auth to all audit routes
auditRouter.use(authMiddleware);

// GET /audit-logs
auditRouter.get('/audit-logs', async (req: Request, res: Response) => {
  const user = req.user!;

  // RBAC enforcement:
  // ADMIN -> full view
  // MANAGER -> read-only view allowed per matrix ("Settings / Workflows / Audit: View only")
  // SALES_REP / SUPPORT_AGENT -> 403 Forbidden
  if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
    return res.status(403).json({
      error: 'Forbidden: Insufficient permissions to view audit logs',
    });
  }

  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25));
  const entity = typeof req.query.entity === 'string' ? req.query.entity.trim() : '';
  const action = typeof req.query.action === 'string' ? req.query.action.trim() : '';

  const where: any = {};

  if (entity && entity !== 'ALL') {
    where.entity = entity.toUpperCase();
  }

  if (action && action !== 'ALL') {
    where.action = action.toUpperCase();
  }

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return res.json({
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
});
