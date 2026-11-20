import { prisma } from '../../lib/prisma';
import { getIO } from '../../realtime';
import { ROLES, DEPARTMENTS } from '@flint/shared';

export interface ActionLog {
  type: string;
  details: Record<string, any>;
  timestamp: string;
}

/**
 * Resolves a field path from payload or nested objects.
 * Handles: "source", "lead.source", "companySize", "customFields.companySize", etc.
 */
function resolveValue(path: string, payload: any): any {
  if (!payload) return undefined;
  if (path in payload) return payload[path];

  // Try dot-notation path
  const parts = path.split('.');
  let curr = payload;
  for (const part of parts) {
    if (curr === undefined || curr === null) return undefined;
    curr = curr[part];
  }
  if (curr !== undefined) return curr;

  // Check common prefixes or sub-properties
  if (parts.length === 2 && parts[0] === 'lead' && payload[parts[1]] !== undefined) {
    return payload[parts[1]];
  }
  if (parts.length === 2 && parts[0] === 'deal' && payload[parts[1]] !== undefined) {
    return payload[parts[1]];
  }
  if (parts.length === 2 && parts[0] === 'ticket' && payload[parts[1]] !== undefined) {
    return payload[parts[1]];
  }

  // Check custom fields
  if (payload.customFields && payload.customFields[path] !== undefined) {
    return payload.customFields[path];
  }

  return undefined;
}

/**
 * Evaluates conditions against event payload.
 */
export function evaluateConditions(conditions: any, payload: any): boolean {
  if (!conditions) return true;

  // Empty array or empty object -> always passes
  if (Array.isArray(conditions)) {
    if (conditions.length === 0) return true;
    return conditions.every((cond) => {
      const actual = resolveValue(cond.field || cond.key, payload);
      const expected = cond.value;
      switch (cond.operator || 'equals') {
        case 'equals':
        case '==':
        case 'eq':
          return String(actual) === String(expected);
        case '!=':
        case 'not_equals':
          return String(actual) !== String(expected);
        case '>=':
        case 'gte':
          return Number(actual) >= Number(expected);
        case '<=':
        case 'lte':
          return Number(actual) <= Number(expected);
        case '>':
        case 'gt':
          return Number(actual) > Number(expected);
        case '<':
        case 'lt':
          return Number(actual) < Number(expected);
        default:
          return actual === expected;
      }
    });
  }

  if (typeof conditions === 'object') {
    const keys = Object.keys(conditions);
    if (keys.length === 0) return true;

    // Single structured condition: { field, operator, value }
    if ('field' in conditions && 'value' in conditions) {
      return evaluateConditions([conditions], payload);
    }

    // Key-value pairs: e.g. { "source": "Waitlist" } or { "minEmployees": 500 }
    for (const [key, expected] of Object.entries(conditions)) {
      if (key === 'minEmployees' || key === 'min_employees') {
        const actualEmployees =
          resolveValue('employees', payload) ||
          resolveValue('companySize', payload) ||
          0;
        if (Number(actualEmployees) < Number(expected)) return false;
        continue;
      }

      const actual = resolveValue(key, payload);
      if (actual === undefined) {
        // Fallback check in case key was "source" but payload has "lead.source"
        if (String(payload.source) !== String(expected)) return false;
      } else if (String(actual).toLowerCase() !== String(expected).toLowerCase()) {
        return false;
      }
    }
    return true;
  }

  return true;
}

/**
 * Replaces mustache template tokens: {{lead.companyName}}, {{deal.title}}, etc.
 */
function interpolateTemplate(template: string, payload: any): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, path) => {
    const cleanPath = path.trim();
    const val = resolveValue(cleanPath, payload);
    return val !== undefined && val !== null ? String(val) : '';
  });
}

/**
 * Executes a single workflow instance with a given event payload.
 */
export async function executeSingleWorkflow(workflow: any, eventPayload: any) {
  const actionsExecuted: ActionLog[] = [];
  let lastAssignedUser: { id: string; name: string; email: string; role: string } | null = null;

  try {
    // 1. Evaluate conditions
    const matched = evaluateConditions(workflow.conditions, eventPayload);
    if (!matched) {
      console.log(`[workflow] conditions not met for "${workflow.name}", skipping.`);
      return null;
    }

    const actions = (Array.isArray(workflow.actions) ? workflow.actions : []) as any[];

    // 2. Sequential action execution
    for (const action of actions) {
      const actionType = action.type;

      if (actionType === 'assign_user') {
        // Handle lead assignment
        if (eventPayload.leadId) {
          let companySize = Number(eventPayload.companySize) || 0;
          if (!companySize) {
            const lead = await prisma.lead.findUnique({
              where: { id: eventPayload.leadId },
            });
            companySize = Number((lead?.custom_fields as any)?.companySize) || 0;
          }

          // Rule: size >= 500 -> Manager (Meera), else Sales Rep (Rahul)
          let targetUser = null;
          if (companySize >= 500) {
            targetUser =
              (await prisma.user.findFirst({ where: { email: 'meera@flint.dev' } })) ||
              (await prisma.user.findFirst({ where: { role: ROLES.MANAGER } }));
          } else {
            targetUser =
              (await prisma.user.findFirst({ where: { email: 'rahul@flint.dev' } })) ||
              (await prisma.user.findFirst({ where: { role: ROLES.SALES_REP } }));
          }

          if (targetUser) {
            await prisma.lead.update({
              where: { id: eventPayload.leadId },
              data: { owner_id: targetUser.id },
            });
            lastAssignedUser = targetUser;
            actionsExecuted.push({
              type: 'assign_user',
              details: {
                leadId: eventPayload.leadId,
                assignedToId: targetUser.id,
                assignedToName: targetUser.name,
                role: targetUser.role,
                companySize,
                rule: companySize >= 500 ? 'size >= 500 (Manager)' : 'size < 500 (Sales Rep)',
              },
              timestamp: new Date().toISOString(),
            });
          }
        } else if (eventPayload.ticketId) {
          // SLA breach escalation -> Manager (Meera)
          const manager =
            (await prisma.user.findFirst({ where: { email: 'meera@flint.dev' } })) ||
            (await prisma.user.findFirst({ where: { role: ROLES.MANAGER } }));

          if (manager) {
            await prisma.ticket.update({
              where: { id: eventPayload.ticketId },
              data: { assignee_id: manager.id },
            });
            lastAssignedUser = manager;
            actionsExecuted.push({
              type: 'assign_user',
              details: {
                ticketId: eventPayload.ticketId,
                assignedToId: manager.id,
                assignedToName: manager.name,
                role: 'MANAGER',
                reason: 'SLA breach escalation to management',
              },
              timestamp: new Date().toISOString(),
            });
          }
        }
      } else if (actionType === 'create_task') {
        // If forEach: "purchased_modules" on deal.won
        if (action.forEach === 'purchased_modules' && eventPayload.dealId) {
          // Fetch deal with account and quotes
          const deal = await prisma.deal.findUnique({
            where: { id: eventPayload.dealId },
            include: {
              account: true,
              documents: {
                where: { type: 'QUOTE' },
                include: {
                  items: {
                    include: { product: true },
                  },
                },
              },
            },
          });

          const accountName = deal?.account?.name || eventPayload.accountName || 'Customer';

          // Find CS User (Kavya Reddy / Support Agent)
          const csUser =
            (await prisma.user.findFirst({ where: { email: 'kavya@flint.dev' } })) ||
            (await prisma.user.findFirst({ where: { email: 'priya@flint.dev' } })) ||
            (await prisma.user.findFirst({ where: { department: DEPARTMENTS.CUSTOMER_SUCCESS } })) ||
            (await prisma.user.findFirst({ where: { role: ROLES.SUPPORT_AGENT } }));

          // Extract unique products
          const uniqueProducts: Array<{ id: string; name: string }> = [];
          const seenProductIds = new Set<string>();

          if (deal?.documents) {
            for (const doc of deal.documents) {
              for (const item of doc.items) {
                if (item.product && !seenProductIds.has(item.product.id)) {
                  seenProductIds.add(item.product.id);
                  uniqueProducts.push({ id: item.product.id, name: item.product.name });
                }
              }
            }
          }

          // Fallback if no quote items found
          if (uniqueProducts.length === 0) {
            uniqueProducts.push(
              { id: 'p1', name: 'HR Operations' },
              { id: 'p2', name: 'Attendance' },
              { id: 'p3', name: 'Payroll' }
            );
          }

          const dueDays = action.dueDays || 3;
          const dueAt = new Date(Date.now() + dueDays * 24 * 3600 * 1000);
          const createdTasks: any[] = [];

          for (const prod of uniqueProducts) {
            const task = await prisma.task.create({
              data: {
                title: `Onboarding: ${prod.name} setup for ${accountName}`,
                description: `Automated onboarding task generated upon deal closing for ${deal?.title || accountName}.`,
                priority: 'HIGH',
                status: 'TODO',
                assignee_id: csUser?.id || null,
                account_id: deal?.account_id || eventPayload.accountId || null,
                deal_id: deal?.id || eventPayload.dealId || null,
                due_at: dueAt,
              },
            });
            createdTasks.push({ id: task.id, title: task.title, product: prod.name });
          }

          actionsExecuted.push({
            type: 'create_task',
            details: {
              mode: 'forEach:purchased_modules',
              tasksCount: createdTasks.length,
              tasks: createdTasks,
              assigneeId: csUser?.id,
              assigneeName: csUser?.name,
              dueInDays: dueDays,
            },
            timestamp: new Date().toISOString(),
          });
        } else {
          // Standard single task creation
          const task = await prisma.task.create({
            data: {
              title: action.title || 'Automated Workflow Task',
              description: action.description || 'Generated by Flint Automation Engine',
              priority: action.priority || 'MEDIUM',
              status: 'TODO',
              account_id: eventPayload.accountId || null,
              deal_id: eventPayload.dealId || null,
              ticket_id: eventPayload.ticketId || null,
              due_at: action.dueDays
                ? new Date(Date.now() + action.dueDays * 24 * 3600 * 1000)
                : null,
            },
          });
          actionsExecuted.push({
            type: 'create_task',
            details: { taskId: task.id, title: task.title },
            timestamp: new Date().toISOString(),
          });
        }
      } else if (actionType === 'notify') {
        // Resolve target recipient user
        let targetUserId: string | null = null;
        let targetUserName = '';

        if (action.targetRole === 'MANAGER') {
          const mgr =
            (await prisma.user.findFirst({ where: { email: 'meera@flint.dev' } })) ||
            (await prisma.user.findFirst({ where: { role: ROLES.MANAGER } }));
          targetUserId = mgr?.id || null;
          targetUserName = mgr?.name || 'Manager';
        } else if (action.targetRole === 'SUPPORT_AGENT') {
          const cs =
            (await prisma.user.findFirst({ where: { email: 'kavya@flint.dev' } })) ||
            (await prisma.user.findFirst({ where: { role: ROLES.SUPPORT_AGENT } }));
          targetUserId = cs?.id || null;
          targetUserName = cs?.name || 'Support/CS';
        } else if (lastAssignedUser) {
          targetUserId = lastAssignedUser.id;
          targetUserName = lastAssignedUser.name;
        } else if (eventPayload.ownerId) {
          targetUserId = eventPayload.ownerId;
        }

        const template = action.template || 'Workflow notification for {{workflow.name}}';
        const message = interpolateTemplate(template, {
          ...eventPayload,
          lead: eventPayload,
          deal: eventPayload,
          ticket: eventPayload,
        });

        if (targetUserId) {
          const notification = await prisma.notification.create({
            data: {
              user_id: targetUserId,
              type: 'WORKFLOW',
              payload: {
                message,
                workflowId: workflow.id,
                workflowName: workflow.name,
                trigger: workflow.trigger,
                data: eventPayload,
              },
            },
          });

          // Socket.io dispatch
          try {
            const io = getIO();
            if (io) {
              io.to(`user:${targetUserId}`).emit('notification:new', notification);
            }
          } catch {
            // Ignore socket error in standalone script
          }

          actionsExecuted.push({
            type: 'notify',
            details: {
              notificationId: notification.id,
              userId: targetUserId,
              userName: targetUserName,
              message,
            },
            timestamp: new Date().toISOString(),
          });
        }
      }
    }

    // 3. Record SUCCESS run
    const run = await prisma.workflowRun.create({
      data: {
        workflow_id: workflow.id,
        trigger_event: eventPayload,
        status: 'SUCCESS',
        log: {
          actionsExecuted: actionsExecuted as any,
          completedAt: new Date().toISOString(),
        } as any,
      },
    });

    console.log(`[workflow] executed ${workflow.name} for event ${workflow.trigger}: SUCCESS`);

    try {
      const io = getIO();
      if (io) {
        io.emit('workflows:changed', { workflowId: workflow.id, runId: run.id });
      }
    } catch {
      // Ignore
    }

    return run;
  } catch (err: any) {
    console.error(`[workflow] execution failed for "${workflow.name}":`, err);

    // Record FAILED run
    const failedRun = await prisma.workflowRun.create({
      data: {
        workflow_id: workflow.id,
        trigger_event: eventPayload,
        status: 'FAILED',
        log: {
          error: err.message || String(err),
          actionsExecuted: actionsExecuted as any,
          failedAt: new Date().toISOString(),
        } as any,
      },
    });

    console.log(`[workflow] executed ${workflow.name} for event ${workflow.trigger}: FAILED`);
    return failedRun;
  }
}

/**
 * Main entry point: finds all active workflows for the given trigger and executes them.
 */
export async function executeWorkflowsForEvent(trigger: string, eventPayload: any) {
  try {
    const activeWorkflows = await prisma.workflow.findMany({
      where: {
        trigger,
        is_active: true,
      },
      orderBy: { created_at: 'asc' },
    });

    if (activeWorkflows.length === 0) {
      return [];
    }

    const runs = [];
    for (const wf of activeWorkflows) {
      const run = await executeSingleWorkflow(wf, eventPayload);
      if (run) runs.push(run);
    }
    return runs;
  } catch (err) {
    console.error(`[workflow] error querying workflows for trigger "${trigger}":`, err);
    return [];
  }
}
