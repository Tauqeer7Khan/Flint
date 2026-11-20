export const ROLES = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  SALES_REP: 'SALES_REP',
  SUPPORT_AGENT: 'SUPPORT_AGENT',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const DEPARTMENTS = {
  SALES: 'SALES',
  CUSTOMER_SUCCESS: 'CUSTOMER_SUCCESS',
  SUPPORT: 'SUPPORT',
} as const;

export type Department = (typeof DEPARTMENTS)[keyof typeof DEPARTMENTS];

export const LEAD_SOURCES = [
  'Waitlist',
  'LinkedIn',
  'Referral',
  'Event',
] as const;

export type LeadSource = (typeof LEAD_SOURCES)[number];

export interface PipelineStageConfig {
  name: string;
  probability: number;
  order_index: number;
}

export const PIPELINE_STAGES: readonly PipelineStageConfig[] = [
  { name: 'Waitlist', probability: 10, order_index: 1 },
  { name: 'Demo Scheduled', probability: 25, order_index: 2 },
  { name: 'Pilot / Proposal', probability: 50, order_index: 3 },
  { name: 'Negotiation', probability: 75, order_index: 4 },
  { name: 'Closed Won', probability: 100, order_index: 5 },
  { name: 'Closed Lost', probability: 0, order_index: 6 },
] as const;

export interface ModuleConfig {
  name: string;
  price_per_employee_month: number;
}

export const MODULES: readonly ModuleConfig[] = [
  { name: 'HR Operations', price_per_employee_month: 40 },
  { name: 'Attendance', price_per_employee_month: 30 },
  { name: 'Payroll', price_per_employee_month: 50 },
  { name: 'Employee Benefits Hub', price_per_employee_month: 45 },
  { name: 'Wellness Hub', price_per_employee_month: 35 },
  { name: 'LifeAssist', price_per_employee_month: 25 },
  { name: 'Rewards & Recognition', price_per_employee_month: 30 },
  { name: 'Growth OS', price_per_employee_month: 35 },
  { name: 'Performance', price_per_employee_month: 40 },
  { name: 'Reports & Analytics', price_per_employee_month: 20 },
] as const;

export const SLA_TARGETS_MINUTES = {
  normal: {
    URGENT: 60,
    HIGH: 240,
    MEDIUM: 480,
    LOW: 1440,
  },
  demo: {
    URGENT: 2,
    HIGH: 5,
    MEDIUM: 8,
    LOW: 24,
  },
} as const;

export const ACCOUNT_PULSE = {
  START_SCORE: 100,
  PENALTY_PER_OPEN_TICKET: 15,
  MAX_OPEN_TICKET_PENALTY: 45,
  PENALTY_HIGH_OR_URGENT_TICKET: 15,
  PENALTY_INACTIVE_OVER_30_DAYS: 25,
  PENALTY_INACTIVE_15_TO_30_DAYS: 10,
  HIGH_VALUE_DEAL_THRESHOLD_INR: 1000000,
  HIGH_VALUE_THRESHOLD_SHIFT: 10,
  THRESHOLDS: {
    GREEN: 70,
    YELLOW: 40,
  },
} as const;

export const WORKFLOW_TRIGGERS = [
  'lead.created',
  'deal.won',
  'ticket.sla_breached',
] as const;
export type WorkflowTrigger = (typeof WORKFLOW_TRIGGERS)[number];

export const WORKFLOW_ACTIONS = [
  'assign_user',
  'create_task',
  'notify',
] as const;
export type WorkflowActionType = (typeof WORKFLOW_ACTIONS)[number];
