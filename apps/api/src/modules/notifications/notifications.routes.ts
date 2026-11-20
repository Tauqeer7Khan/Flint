import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { authMiddleware } from '../../middleware/auth';

export const notificationsRouter = Router();

// GET /notifications - recent 20 notifications for the authenticated user
notificationsRouter.get('/notifications', authMiddleware, async (req: Request, res: Response) => {
  const userId = req.user!.id;

  const notifications = await prisma.notification.findMany({
    where: { user_id: userId },
    orderBy: { created_at: 'desc' },
    take: 20,
  });

  const unreadCount = await prisma.notification.count({
    where: {
      user_id: userId,
      read_at: null,
    },
  });

  const mapped = notifications.map((n) => {
    const p = (n.payload as any) || {};
    const title =
      p.title ||
      (n.type === 'MENTION'
        ? `${p.authorName || 'Someone'} mentioned you`
        : p.workflowName || 'Notification');
    const body = p.body || p.message || p.snippet || '';
    const link_url =
      p.link_url ||
      (p.dealId
        ? `/deals/${p.dealId}`
        : p.ticketId
        ? `/tickets/${p.ticketId}`
        : p.accountId
        ? `/accounts/${p.accountId}`
        : null);

    return {
      ...n,
      title,
      body,
      link_url,
    };
  });

  return res.json({
    items: mapped,
    notifications: mapped,
    unreadCount,
    total: mapped.length,
  });
});

// PATCH /notifications/:id/read - mark single notification as read
notificationsRouter.patch('/notifications/:id/read', authMiddleware, async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const userId = req.user!.id;

  await prisma.notification.updateMany({
    where: {
      id,
      user_id: userId,
    },
    data: {
      read_at: new Date(),
    },
  });

  return res.json({ success: true, id });
});

// POST /notifications/read-all - mark all user's notifications as read
notificationsRouter.post('/notifications/read-all', authMiddleware, async (req: Request, res: Response) => {
  const userId = req.user!.id;

  await prisma.notification.updateMany({
    where: {
      user_id: userId,
      read_at: null,
    },
    data: {
      read_at: new Date(),
    },
  });

  return res.json({ success: true });
});
