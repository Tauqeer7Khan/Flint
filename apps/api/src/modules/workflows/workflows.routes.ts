import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { logAudit } from '../../lib/audit';
import { getIO } from '../../realtime';
import { workflowToggleSchema } from '@flint/shared';
import { executeSingleWorkflow } from './engine';
import { authMiddleware } from '../../middleware/auth';

export const workflowsRouter = Router();

// Apply auth to all workflow routes
workflowsRouter.use(authMiddleware);

// GET /workflows - list all workflows with run counts + last 5 runs
workflowsRouter.get('/workflows', async (req: Request, res: Response) => {
  if (req.user!.role !== 'ADMIN' && req.user!.role !== 'MANAGER') {
    return res.status(403).json({
      error: 'Forbidden: Insufficient permissions to view workflows',
    });
  }

  const workflows = await prisma.workflow.findMany({
    orderBy: { created_at: 'asc' },
    include: {
      runs: {
        orderBy: { created_at: 'desc' },
        take: 5,
        select: {
          id: true,
          status: true,
          created_at: true,
        },
      },
      _count: {
        select: { runs: true },
      },
    },
  });

  const formatted = workflows.map((wf) => ({
    id: wf.id,
    name: wf.name,
    trigger: wf.trigger,
    conditions: wf.conditions,
    actions: wf.actions,
    is_active: wf.is_active,
    totalRuns: wf._count.runs,
    recentRuns: wf.runs,
    created_at: wf.created_at,
    updated_at: wf.updated_at,
  }));

  return res.json({ items: formatted, workflows: formatted, total: formatted.length });
});

// PATCH /workflows/:id/toggle - toggle active state
workflowsRouter.patch('/workflows/:id/toggle', async (req: Request, res: Response) => {
  if (req.user!.role !== 'ADMIN') {
    return res.status(403).json({
      error: 'Forbidden: Only administrators can modify workflows',
    });
  }

  const id = String(req.params.id);
  const existing = await prisma.workflow.findUnique({
    where: { id },
  });

  if (!existing) {
    return res.status(404).json({ error: 'Workflow not found' });
  }

  let nextActive: boolean;
  if (req.body && typeof req.body.isActive === 'boolean') {
    nextActive = req.body.isActive;
  } else {
    nextActive = !existing.is_active;
  }

  const updated = await prisma.workflow.update({
    where: { id },
    data: { is_active: nextActive },
  });

  await logAudit(prisma, {
    userId: req.user!.id,
    entity: 'WORKFLOWS',
    entityId: id,
    action: 'UPDATE',
    changes: {
      before: { is_active: existing.is_active },
      after: { is_active: nextActive },
    },
  });

  try {
    const io = getIO();
    if (io) {
      io.emit('workflows:changed', { workflowId: id, is_active: nextActive });
    }
  } catch {
    // Ignore socket error
  }

  return res.json(updated);
});

// GET /workflows/runs - list workflow run history
workflowsRouter.get('/workflows/runs', async (req: Request, res: Response) => {
  if (req.user!.role !== 'ADMIN' && req.user!.role !== 'MANAGER') {
    return res.status(403).json({
      error: 'Forbidden: Insufficient permissions to view workflow runs',
    });
  }

  const runs = await prisma.workflowRun.findMany({
    orderBy: { created_at: 'desc' },
    take: 50,
    include: {
      workflow: {
        select: {
          id: true,
          name: true,
          trigger: true,
        },
      },
    },
  });

  return res.json({ items: runs, runs, total: runs.length });
});

// POST /workflows/:id/test - trigger a test/dry run
workflowsRouter.post('/workflows/:id/test', async (req: Request, res: Response) => {
  if (req.user!.role !== 'ADMIN') {
    return res.status(403).json({
      error: 'Forbidden: Only administrators can test workflows',
    });
  }

  const id = String(req.params.id);
  const workflow = await prisma.workflow.findUnique({
    where: { id },
  });

  if (!workflow) {
    return res.status(404).json({ error: 'Workflow not found' });
  }

  // Construct realistic test payload per trigger
  let testPayload: any = {};

  if (workflow.trigger === 'lead.created') {
    const lead = await prisma.lead.findFirst({
      where: { source: 'Waitlist', deleted_at: null },
    });
    testPayload = {
      leadId: lead?.id || 'test-lead-id',
      companyName: lead?.company_name || 'Flipkart Commerce Solutions',
      source: 'Waitlist',
      companySize: (lead?.custom_fields as any)?.companySize || 600,
      ownerId: lead?.owner_id || null,
    };
  } else if (workflow.trigger === 'deal.won') {
    const deal =
      (await prisma.deal.findFirst({
        where: {
          documents: {
            some: { type: 'QUOTE' },
          },
          deleted_at: null,
        },
        include: { account: true },
      })) ||
      (await prisma.deal.findFirst({
        where: { deleted_at: null },
        include: { account: true },
      }));

    testPayload = {
      dealId: deal?.id || 'test-deal-id',
      accountId: deal?.account_id || 'test-account-id',
      accountName: deal?.account?.name || 'Dunzo',
      amount: deal?.amount || 720000,
      employees: deal?.employees || 500,
      title: deal?.title || 'Complete Employee Experience Suite',
    };
  } else if (workflow.trigger === 'ticket.sla_breached') {
    const ticket =
      (await prisma.ticket.findFirst({
        where: { status: 'OPEN' },
      })) || (await prisma.ticket.findFirst());

    testPayload = {
      ticketId: ticket?.id || 'test-ticket-id',
      accountId: ticket?.account_id || 'test-account-id',
      priority: ticket?.priority || 'URGENT',
      subject: ticket?.subject || 'Attendance geo-fence sync failure',
    };
  }

  const run = await executeSingleWorkflow(workflow, testPayload);

  await logAudit(prisma, {
    userId: req.user!.id,
    entity: 'WORKFLOWS',
    entityId: id,
    action: 'UPDATE',
    changes: {
      workflowName: workflow.name,
      testRunId: run?.id || null,
      status: run?.status || 'SKIPPED',
    },
  });

  return res.status(200).json({
    success: true,
    message: `Test run for "${workflow.name}" completed`,
    run,
  });
});
