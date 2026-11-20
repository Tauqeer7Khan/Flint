import { EventEmitter } from 'events';
import { getIO } from '../realtime';
import { prisma } from './prisma';
import { executeWorkflowsForEvent } from '../modules/workflows/engine';

export type DomainEventName =
  | 'deal.stage_changed'
  | 'deal.won'
  | 'deal.created'
  | 'lead.created'
  | 'lead.converted'
  | 'activity:created'
  | 'task.created'
  | 'ticket.created'
  | 'ticket.updated'
  | 'ticket.sla_breached';

export interface DomainEventPayloadMap {
  'deal.stage_changed': {
    dealId: string;
    fromStageId: string | null;
    toStageId: string;
    changedBy: string | null;
  };
  'deal.won': {
    dealId: string;
    accountId: string;
    ownerId: string | null;
    amount: number;
    employees: number;
    title?: string;
  };
  'deal.created': {
    dealId: string;
    title: string;
    amount: number;
    accountId: string;
    ownerId: string | null;
  };
  'lead.created': {
    leadId: string;
    companyName: string;
    source: string;
    ownerId: string | null;
    companySize?: number;
    customFields?: any;
  };
  'lead.converted': {
    leadId: string;
    accountId: string;
    contactId: string;
    dealId: string;
  };
  'activity:created': {
    activity: any;
    authorName: string;
    mentionedUserIds: string[];
  };
  'task.created': {
    taskId: string;
    title: string;
    assigneeId: string | null;
    accountId: string | null;
  };
  'ticket.created': {
    ticketId: string;
    subject: string;
    priority: string;
    accountId: string;
    assigneeId: string | null;
  };
  'ticket.updated': {
    ticketId: string;
    status: string;
  };
  'ticket.sla_breached': {
    ticketId: string;
    accountId: string;
    priority: string;
    subject: string;
    assigneeId: string | null;
  };
}

class DomainEventBus extends EventEmitter {}

export const domainEventBus = new DomainEventBus();

// Subscribe workflow engine to domain events (Phase 6)
domainEventBus.on('lead.created', (payload) => {
  executeWorkflowsForEvent('lead.created', payload).catch((err) =>
    console.error('[workflow] error executing workflows for lead.created:', err)
  );
});

domainEventBus.on('deal.won', (payload) => {
  executeWorkflowsForEvent('deal.won', payload).catch((err) =>
    console.error('[workflow] error executing workflows for deal.won:', err)
  );
});

domainEventBus.on('ticket.sla_breached', (payload) => {
  executeWorkflowsForEvent('ticket.sla_breached', payload).catch((err) =>
    console.error('[workflow] error executing workflows for ticket.sla_breached:', err)
  );
});

/**
 * Emits a domain event across the system, logs to console, and bridges to Socket.io.
 */
export function emitDomainEvent<K extends DomainEventName>(
  name: K,
  payload: DomainEventPayloadMap[K]
): void {
  // 1. Console log required by specification
  console.log(`[event] ${name}`, payload);

  // 2. Emit internally for event bus listeners (workflow engine in Phase 6, etc.)
  domainEventBus.emit(name, payload);

  // 3. Bridge to Socket.io for live clients invalidation and notifications
  try {
    const io = getIO();
    if (io) {
      if (name.startsWith('deal.')) {
        io.emit('deals:changed', { event: name, payload });
      } else if (name.startsWith('lead.')) {
        io.emit('leads:changed', { event: name, payload });
      } else if (name.startsWith('ticket.')) {
        io.emit('tickets:changed', { event: name, payload });
      } else if (name.startsWith('task.')) {
        io.emit('tasks:changed', { event: name, payload });
      } else if (name === 'activity:created') {
        const actPayload = payload as DomainEventPayloadMap['activity:created'];
        const accountId = actPayload.activity.account_id;
        
        // Emit to account room
        io.to(`account:${accountId}`).emit('activity:new', actPayload.activity);
        // Broadcast general activities:changed
        io.emit('activities:changed', { accountId, activity: actPayload.activity });

        // Handle notifications for mentions
        if (actPayload.mentionedUserIds && actPayload.mentionedUserIds.length > 0) {
          const snippet = actPayload.activity.body
            ? actPayload.activity.body.slice(0, 120)
            : '';

          for (const userId of actPayload.mentionedUserIds) {
            prisma.notification.create({
              data: {
                user_id: userId,
                type: 'MENTION',
                payload: {
                  activityId: actPayload.activity.id,
                  accountId: actPayload.activity.account_id,
                  dealId: actPayload.activity.deal_id || null,
                  ticketId: actPayload.activity.ticket_id || null,
                  authorName: actPayload.authorName,
                  snippet,
                },
              },
            }).then((notification) => {
              console.log(`[notification] MENTION emitted to user:${userId}`, notification.id);
              io.to(`user:${userId}`).emit('notification:new', notification);
            }).catch((err) => {
              console.error(`Failed to create notification for user ${userId}:`, err);
            });
          }
        }
      }
    }
  } catch {
    // Socket.io may not be running in isolated scripts/tests
    if (name === 'activity:created') {
      const actPayload = payload as DomainEventPayloadMap['activity:created'];
      if (actPayload.mentionedUserIds && actPayload.mentionedUserIds.length > 0) {
        const snippet = actPayload.activity.body
          ? actPayload.activity.body.slice(0, 120)
          : '';

        for (const userId of actPayload.mentionedUserIds) {
          prisma.notification.create({
            data: {
              user_id: userId,
              type: 'MENTION',
              payload: {
                activityId: actPayload.activity.id,
                accountId: actPayload.activity.account_id,
                dealId: actPayload.activity.deal_id || null,
                ticketId: actPayload.activity.ticket_id || null,
                authorName: actPayload.authorName,
                snippet,
              },
            },
          }).then((notification) => {
            console.log(`[notification] MENTION stored for user:${userId}`, notification.id);
          }).catch((err) => {
            console.error(`Failed to create notification for user ${userId}:`, err);
          });
        }
      }
    }
  }
}

/**
 * Subscribes to domain events.
 */
export function onDomainEvent<K extends DomainEventName>(
  name: K,
  handler: (payload: DomainEventPayloadMap[K]) => void
): void {
  domainEventBus.on(name, handler as (...args: any[]) => void);
}
