import { z } from 'zod';
import { ROLES, LEAD_SOURCES, type Role, type Department, type LeadSource } from './constants';

export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const demoLoginSchema = z.object({
  role: z.enum([ROLES.ADMIN, ROLES.MANAGER, ROLES.SALES_REP, ROLES.SUPPORT_AGENT]),
});

export type DemoLoginInput = z.infer<typeof demoLoginSchema>;

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: Department;
  teamId: string | null;
}

// Empulz Custom Fields Schema (stored in custom_fields JSONB)
export const empulzCustomFieldsSchema = z.object({
  companySize: z.union([z.number().int().positive(), z.literal('')]).optional(),
  currentHrTool: z.string().optional(),
  interestedModules: z.array(z.string()).optional().default([]),
  hrContactDesignation: z.string().optional(),
});

export type EmpulzCustomFields = z.infer<typeof empulzCustomFieldsSchema>;

// Leads Schemas
export const createLeadSchema = z.object({
  companyName: z.string().min(2, 'Company name must be at least 2 characters'),
  contactName: z.string().min(2, 'Contact name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().optional().nullable(),
  source: z.enum(LEAD_SOURCES),
  status: z.string().default('NEW'),
  ownerId: z.string().optional().nullable(),
  consent: z.boolean().default(true),
  customFields: empulzCustomFieldsSchema.optional().nullable(),
});

export type CreateLeadInput = z.infer<typeof createLeadSchema>;

export const updateLeadSchema = createLeadSchema.partial();
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;

// Lead Conversion Schema
export const convertLeadSchema = z.object({
  leadId: z.string().min(1, 'Lead ID is required'),
  dealTitle: z.string().min(2, 'Deal title must be at least 2 characters'),
  dealAmount: z.number().nonnegative('Deal amount must be non-negative'),
  employees: z.number().int().positive('Employees count must be a positive integer'),
  selectedModules: z.array(z.string()).default([]),
});

export type ConvertLeadInput = z.infer<typeof convertLeadSchema>;

// Accounts Schemas
export const createAccountSchema = z.object({
  name: z.string().min(2, 'Account name must be at least 2 characters'),
  ownerId: z.string().optional().nullable(),
  customFields: empulzCustomFieldsSchema.optional().nullable(),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;

export const updateAccountSchema = createAccountSchema.partial();
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;

// Contacts Schemas
export const createContactSchema = z.object({
  name: z.string().min(2, 'Contact name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().optional().nullable(),
  designation: z.string().optional().nullable(),
  accountId: z.string().min(1, 'Account ID is required'),
  ownerId: z.string().optional().nullable(),
  customFields: empulzCustomFieldsSchema.optional().nullable(),
});

export type CreateContactInput = z.infer<typeof createContactSchema>;

export const updateContactSchema = createContactSchema.partial();
export type UpdateContactInput = z.infer<typeof updateContactSchema>;

// Deals Schemas
export const createDealSchema = z.object({
  title: z.string().min(2, 'Deal title must be at least 2 characters'),
  amount: z.number().int().nonnegative('Amount must be non-negative').default(0),
  employees: z.number().int().positive('Employees must be at least 1').default(1),
  accountId: z.string().min(1, 'Account ID is required'),
  contactId: z.string().optional().nullable(),
  ownerId: z.string().optional().nullable(),
  stageId: z.string().optional().nullable(),
});

export type CreateDealInput = z.infer<typeof createDealSchema>;

export const updateDealSchema = createDealSchema.partial();
export type UpdateDealInput = z.infer<typeof updateDealSchema>;

export const changeDealStageSchema = z.object({
  stageId: z.string().min(1, 'Stage ID is required'),
});

export type ChangeDealStageInput = z.infer<typeof changeDealStageSchema>;

// Quote Schemas
export const createQuoteSchema = z.object({
  employees: z.number().int().positive('Employees must be at least 1'),
  productIds: z.array(z.string()).min(1, 'At least one product is required'),
  updateDealAmount: z.boolean().default(true),
});

export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;

// Activities Schemas
export const USER_ACTIVITY_TYPES = ['NOTE', 'CALL', 'MEETING', 'INTERNAL_COMMENT'] as const;
export type UserActivityType = (typeof USER_ACTIVITY_TYPES)[number];

export const createActivitySchema = z.object({
  type: z.enum(USER_ACTIVITY_TYPES),
  body: z.string().min(1, 'Activity body cannot be empty'),
  isInternal: z.boolean().default(false),
  mentions: z.array(z.string()).default([]),
  accountId: z.string().min(1, 'Account ID is required'),
  leadId: z.string().optional().nullable(),
  contactId: z.string().optional().nullable(),
  dealId: z.string().optional().nullable(),
  ticketId: z.string().optional().nullable(),
});

export type CreateActivityInput = z.infer<typeof createActivitySchema>;

// Tasks Schemas
export const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export type TicketPriority = TaskPriority;

export const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;
export type TaskStatusType = (typeof TASK_STATUSES)[number];
export type TaskStatus = TaskStatusType;

export const createTaskSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters'),
  description: z.string().optional().nullable(),
  assigneeId: z.string().min(1, 'Assignee ID is required'),
  dueAt: z.union([z.string(), z.date()]).optional().nullable(),
  priority: z.enum(TASK_PRIORITIES).default('MEDIUM'),
  accountId: z.string().optional().nullable(),
  contactId: z.string().optional().nullable(),
  dealId: z.string().optional().nullable(),
  ticketId: z.string().optional().nullable(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = createTaskSchema.partial().extend({
  status: z.enum([...TASK_STATUSES, 'DONE'] as const).optional(),
});

export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

// Tickets Schemas
export const TICKET_STATUSES = ['OPEN', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED'] as const;
export type TicketStatusType = (typeof TICKET_STATUSES)[number];
export type TicketStatus = TicketStatusType;

export const createTicketSchema = z.object({
  subject: z.string().min(3, 'Subject must be at least 3 characters'),
  description: z.string().optional().nullable(),
  priority: z.enum(TASK_PRIORITIES).default('MEDIUM'),
  accountId: z.string().min(1, 'Account ID is required'),
  contactId: z.string().optional().nullable(),
  assigneeId: z.string().optional().nullable(),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;

export const updateTicketSchema = createTicketSchema.partial().extend({
  status: z.enum(TICKET_STATUSES).optional(),
});

export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;

// Ticket Reply Schema
export const replyTicketSchema = z.object({
  body: z.string().min(1, 'Reply message cannot be empty'),
  isInternal: z.boolean().default(false),
});

export type ReplyTicketInput = z.infer<typeof replyTicketSchema>;

// Workflow Toggle Schema
export const workflowToggleSchema = z.object({
  isActive: z.boolean(),
});

export type WorkflowToggleInput = z.infer<typeof workflowToggleSchema>;

// Public Waitlist Schema (Empulz web-to-lead)
export const waitlistSchema = z.object({
  name: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Please enter a valid work email address'),
  companyName: z.string().min(2, 'Company name must be at least 2 characters'),
  companySize: z.coerce.number().int().min(1, 'Company size must be at least 1 employee'),
  currentHrTool: z.string().optional(),
  interestedModules: z.array(z.string()).default([]),
  hrContactDesignation: z.string().optional(),
  consent: z.literal(true, {
    message: 'You must agree to be contacted about Empulz updates',
  }),
  website: z.string().optional(), // HONEYPOT — must be empty server-side
});

export type WaitlistInput = z.infer<typeof waitlistSchema>;

// Account Pulse Types
export interface AccountPulse {
  score: number;
  color: 'GREEN' | 'YELLOW' | 'RED';
  highValue: boolean;
  trend: string;
}

// Analytics Overview Types
export interface ForecastBucket {
  label: string;
  value: number;
}

export interface RepPerformanceItem {
  id: string;
  name: string;
  dealsOwned: number;
  dealsWon: number;
  wonAmount: number;
  pipelineValue: number;
}

export interface AnalyticsOverview {
  revenueThisMonth: number;
  conversionRate: number;
  avgDealSize: number;
  openTickets: number;
  slaBreaches: number;
  forecast: ForecastBucket[];
  repPerformance: RepPerformanceItem[];
}

// Audit Log Types
export interface AuditLogItem {
  id: string;
  user_id: string | null;
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
  entity: string;
  entity_id: string;
  action: string;
  changes: {
    before?: any;
    after?: any;
    [key: string]: any;
  };
  created_at: string;
}

export interface AuditLogsResponse {
  items: AuditLogItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}



