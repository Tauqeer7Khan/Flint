import { prisma } from '../lib/prisma';
import { logAudit } from '../lib/audit';
import { emitDomainEvent } from '../lib/events';
import { getIO } from '../realtime';

let schedulerHandle: NodeJS.Timeout | null = null;

/**
 * Runs a single sweep for breaching tickets.
 */
export async function runSlaSweep(): Promise<number> {
  const now = new Date();

  // Query un-breached, unresolved tickets whose deadline has passed
  const breachingTickets = await prisma.ticket.findMany({
    where: {
      status: { notIn: ['RESOLVED', 'CLOSED'] },
      sla_breached_at: null,
      sla_due_at: { lt: now },
    },
    select: {
      id: true,
      subject: true,
      priority: true,
      account_id: true,
      assignee_id: true,
      sla_due_at: true,
    },
  });

  if (breachingTickets.length > 0) {
    for (const ticket of breachingTickets) {
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { sla_breached_at: now },
      });

      await logAudit(prisma, {
        userId: 'SYSTEM',
        entity: 'TICKETS',
        entityId: ticket.id,
        action: 'UPDATE',
        changes: {
          before: { sla_breached_at: null },
          after: { sla_breached_at: now },
        },
      });

      emitDomainEvent('ticket.sla_breached', {
        ticketId: ticket.id,
        accountId: ticket.account_id,
        priority: ticket.priority,
        subject: ticket.subject,
        assigneeId: ticket.assignee_id,
      });
    }

    try {
      getIO().emit('tickets:changed', { count: breachingTickets.length });
    } catch {}
  }

  console.log(`[scheduler] sla sweep: ${breachingTickets.length} breaches`);
  return breachingTickets.length;
}

/**
 * Starts the in-process SLA sweep scheduler (interval: ~15 seconds).
 */
export function startScheduler(): NodeJS.Timeout {
  if (schedulerHandle) {
    clearInterval(schedulerHandle);
  }

  // Initial sweep after 3s
  setTimeout(() => {
    runSlaSweep().catch((err) => console.error('[scheduler] error in initial sweep:', err));
  }, 3000);

  // Periodic sweep every 15s
  schedulerHandle = setInterval(() => {
    runSlaSweep().catch((err) => console.error('[scheduler] error in sweep:', err));
  }, 15000);

  return schedulerHandle;
}

/**
 * Stops the scheduler.
 */
export function stopScheduler(): void {
  if (schedulerHandle) {
    clearInterval(schedulerHandle);
    schedulerHandle = null;
  }
}
