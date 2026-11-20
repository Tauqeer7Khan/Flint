import { SLA_TARGETS_MINUTES, type TaskPriority } from '@flint/shared';

/**
 * Returns the target SLA resolution/first-response time in minutes.
 * In DEMO_MODE, compressed targets are used:
 * - URGENT: 2 min
 * - HIGH: 5 min
 * - MEDIUM: 8 min
 * - LOW: 24 min
 */
export function getSlaMinutes(priority: TaskPriority | string): number {
  const isDemo = process.env.DEMO_MODE === 'true';
  const p = (priority as TaskPriority) || 'MEDIUM';

  if (isDemo) {
    return SLA_TARGETS_MINUTES.demo[p] ?? SLA_TARGETS_MINUTES.demo.MEDIUM;
  }
  return SLA_TARGETS_MINUTES.normal[p] ?? SLA_TARGETS_MINUTES.normal.MEDIUM;
}

/**
 * Computes the target deadline date for a ticket based on priority and demo mode.
 */
export function computeSlaDue(priority: TaskPriority | string): Date {
  const minutes = getSlaMinutes(priority);
  return new Date(Date.now() + minutes * 60 * 1000);
}
