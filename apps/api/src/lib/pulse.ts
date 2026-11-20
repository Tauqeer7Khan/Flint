import { AccountPulse } from '@flint/shared';
import { prisma } from './prisma';

/**
 * Computes Account Pulse health score according to the locked Empulz specification:
 * - Start at 100
 * - -15 per open ticket (status IN OPEN, IN_PROGRESS, WAITING), capped at -45
 * - extra -15 if any open ticket is HIGH or URGENT
 * - Recency (days since latest activity.created_at for account):
 *     > 30 days (or no activity) -> -25
 *     15-30 days -> -10
 *     < 15 days -> 0
 * - High-value account: any active open deal (probability 1-99%) with amount >= ₹10,00,000
 * - Thresholds:
 *     Normal: 🟢 >= 70, 🟡 40-69, 🔴 < 40
 *     High-Value (shifted +10): 🟢 >= 80, 🟡 50-79, 🔴 < 50
 * - Trend: cosmetic hardcoded '+12%'
 */
export async function computePulse(accountId: string): Promise<AccountPulse> {
  const [openTickets, latestActivity, highValueDeal] = await Promise.all([
    // Open tickets for the account
    prisma.ticket.findMany({
      where: {
        account_id: accountId,
        status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING'] },
      },
      select: {
        id: true,
        priority: true,
      },
    }),

    // Latest activity timestamp for account
    prisma.activity.findFirst({
      where: {
        account_id: accountId,
      },
      orderBy: {
        created_at: 'desc',
      },
      select: {
        created_at: true,
      },
    }),

    // High value open deal check: probability between 1 and 99, amount >= 1,000,000
    prisma.deal.findFirst({
      where: {
        account_id: accountId,
        deleted_at: null,
        amount: { gte: 1000000 },
        stage: {
          probability: {
            gt: 0,
            lt: 100,
          },
        },
      },
      select: {
        id: true,
      },
    }),
  ]);

  // 1. Ticket penalties
  // -15 per open ticket, capped at -45
  const rawTicketPenalty = openTickets.length * 15;
  const ticketPenalty = Math.min(45, rawTicketPenalty);

  // Extra -15 if any open ticket is HIGH or URGENT
  const hasHighOrUrgent = openTickets.some(
    (t) => t.priority === 'HIGH' || t.priority === 'URGENT'
  );
  const highUrgentPenalty = hasHighOrUrgent ? 15 : 0;

  // 2. Recency penalty
  let recencyPenalty = 0;
  if (!latestActivity) {
    recencyPenalty = 25; // No activity -> treated as > 30 days
  } else {
    const now = new Date().getTime();
    const actTime = new Date(latestActivity.created_at).getTime();
    const daysSince = (now - actTime) / (1000 * 60 * 60 * 24);

    if (daysSince > 30) {
      recencyPenalty = 25;
    } else if (daysSince >= 15) {
      recencyPenalty = 10;
    } else {
      recencyPenalty = 0;
    }
  }

  // 3. Compute raw score (clamped between 0 and 100)
  const rawScore = 100 - ticketPenalty - highUrgentPenalty - recencyPenalty;
  const score = Math.max(0, Math.min(100, rawScore));

  // 4. Color calculation
  const highValue = Boolean(highValueDeal);
  let color: 'GREEN' | 'YELLOW' | 'RED';

  if (highValue) {
    // Shifted +10: 80 / 50
    if (score >= 80) {
      color = 'GREEN';
    } else if (score >= 50) {
      color = 'YELLOW';
    } else {
      color = 'RED';
    }
  } else {
    // Normal: 70 / 40
    if (score >= 70) {
      color = 'GREEN';
    } else if (score >= 40) {
      color = 'YELLOW';
    } else {
      color = 'RED';
    }
  }

  return {
    score,
    color,
    highValue,
    trend: '+12%',
  };
}
