import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { authMiddleware } from '../../middleware/auth';
import { scopeFor } from '../../middleware/rbac';
import { AnalyticsOverview, ForecastBucket, RepPerformanceItem } from '@flint/shared';

export const analyticsRouter = Router();

analyticsRouter.use(authMiddleware);

// GET /analytics/overview
analyticsRouter.get('/analytics/overview', async (req: Request, res: Response) => {
  const user = req.user!;

  // Scopes per role
  // For deals: Sales Rep sees own, Manager team's, Admin all
  const dealScope: any =
    user.role === 'SALES_REP'
      ? { owner_id: user.id }
      : user.role === 'MANAGER'
      ? (user.teamId ? { owner: { team_id: user.teamId } } : { owner_id: user.id })
      : {};

  // For tickets:
  const ticketScope = scopeFor(user, 'tickets') || {};

  // For leads:
  const leadScope = scopeFor(user, 'leads'); // null for SUPPORT_AGENT

  // Date range for current calendar month
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  // 1. Revenue this month: Σ amount of deals in Closed Won stage with updated_at in current calendar month
  const wonDealsThisMonth = await prisma.deal.findMany({
    where: {
      deleted_at: null,
      ...dealScope,
      stage: {
        probability: 100,
      },
      updated_at: {
        gte: startOfMonth,
        lte: endOfMonth,
      },
    },
    select: {
      amount: true,
    },
  });
  const revenueThisMonth = wonDealsThisMonth.reduce((sum, d) => sum + d.amount, 0);

  // 2. Conversion rate: converted leads / total leads (%, 1 decimal)
  let conversionRate = 0;
  if (leadScope !== null) {
    const [totalLeads, convertedLeads] = await Promise.all([
      prisma.lead.count({
        where: {
          deleted_at: null,
          ...leadScope,
        },
      }),
      prisma.lead.count({
        where: {
          deleted_at: null,
          status: 'CONVERTED',
          ...leadScope,
        },
      }),
    ]);
    if (totalLeads > 0) {
      conversionRate = parseFloat(((convertedLeads / totalLeads) * 100).toFixed(1));
    }
  }

  // 3. Avg deal size: avg amount of deals in open + won stages (probability > 0)
  const activeDeals = await prisma.deal.findMany({
    where: {
      deleted_at: null,
      ...dealScope,
      stage: {
        probability: { gt: 0 },
      },
    },
    select: {
      amount: true,
    },
  });
  const avgDealSize =
    activeDeals.length > 0
      ? Math.round(activeDeals.reduce((sum, d) => sum + d.amount, 0) / activeDeals.length)
      : 0;

  // 4. Open tickets & SLA breaches
  // openTickets: count status IN (OPEN, IN_PROGRESS, WAITING)
  // slaBreaches: count sla_breached_at NOT NULL among open
  const [openTickets, slaBreaches] = await Promise.all([
    prisma.ticket.count({
      where: {
        ...ticketScope,
        status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING'] },
      },
    }),
    prisma.ticket.count({
      where: {
        ...ticketScope,
        status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING'] },
        sla_breached_at: { not: null },
      },
    }),
  ]);

  // 5. Forecast (stage-bucket proxy, weighted Σ amount * probability / 100):
  // 30d = deals in Negotiation (probability 75)
  // 60d = Pilot / Proposal (probability 50)
  // 90d = Demo Scheduled (25) + Waitlist (10)
  const pipelineDeals = await prisma.deal.findMany({
    where: {
      deleted_at: null,
      ...dealScope,
      stage: {
        probability: { in: [10, 25, 50, 75] },
      },
    },
    include: {
      stage: { select: { probability: true } },
    },
  });

  let f30 = 0;
  let f60 = 0;
  let f90 = 0;

  for (const deal of pipelineDeals) {
    const prob = deal.stage.probability;
    const weighted = (deal.amount * prob) / 100;
    if (prob === 75) {
      f30 += weighted;
    } else if (prob === 50) {
      f60 += weighted;
    } else if (prob === 25 || prob === 10) {
      f90 += weighted;
    }
  }

  const forecast: ForecastBucket[] = [
    { label: '30 days', value: Math.round(f30) },
    { label: '60 days', value: Math.round(f60) },
    { label: '90 days', value: Math.round(f90) },
  ];

  // 6. Rep performance: per SALES_REP/MANAGER user
  // name, dealsOwned, dealsWon, wonAmount, pipelineValue. Sorted by wonAmount desc.
  const reps = await prisma.user.findMany({
    where: {
      role: { in: ['SALES_REP', 'MANAGER'] },
    },
    select: {
      id: true,
      name: true,
    },
  });

  // Fetch all active deals with their owners
  const repDeals = await prisma.deal.findMany({
    where: {
      deleted_at: null,
      owner_id: { in: reps.map((r) => r.id) },
    },
    include: {
      stage: { select: { probability: true } },
    },
  });

  const repPerformance: RepPerformanceItem[] = reps.map((rep) => {
    const userDeals = repDeals.filter((d) => d.owner_id === rep.id);
    const dealsOwned = userDeals.length;
    const wonDeals = userDeals.filter((d) => d.stage.probability === 100);
    const dealsWon = wonDeals.length;
    const wonAmount = wonDeals.reduce((sum, d) => sum + d.amount, 0);
    const openDeals = userDeals.filter((d) => d.stage.probability > 0 && d.stage.probability < 100);
    const pipelineValue = Math.round(
      openDeals.reduce((sum, d) => sum + (d.amount * d.stage.probability) / 100, 0)
    );

    return {
      id: rep.id,
      name: rep.name,
      dealsOwned,
      dealsWon,
      wonAmount,
      pipelineValue,
    };
  });

  repPerformance.sort((a, b) => b.wonAmount - a.wonAmount);

  const overview: AnalyticsOverview = {
    revenueThisMonth,
    conversionRate,
    avgDealSize,
    openTickets,
    slaBreaches,
    forecast,
    repPerformance,
  };

  return res.json(overview);
});
