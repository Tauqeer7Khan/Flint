import http from 'http';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import 'dotenv/config';

import { prisma } from './lib/prisma';
import { originCheckMiddleware } from './middleware/origin';
import { authRouter } from './modules/auth/auth.routes';
import { leadsRouter } from './modules/leads/leads.routes';
import { accountsRouter } from './modules/accounts/accounts.routes';
import { contactsRouter } from './modules/contacts/contacts.routes';
import { dealsRouter } from './modules/deals/deals.routes';
import { quotesRouter } from './modules/quotes/quotes.routes';
import { activitiesRouter } from './modules/activities/activities.routes';
import { tasksRouter } from './modules/tasks/tasks.routes';
import { ticketsRouter } from './modules/tickets/tickets.routes';
import { workflowsRouter } from './modules/workflows/workflows.routes';
import { searchRouter } from './modules/search/search.routes';
import { notificationsRouter } from './modules/notifications/notifications.routes';
import { analyticsRouter } from './modules/analytics/analytics.routes';
import { auditRouter } from './modules/audit/audit.routes';
import { publicRouter } from './modules/public/public.routes';
import { initRealtime } from './realtime';
import { startScheduler } from './scheduler';

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const rawOrigins = process.env.WEB_ORIGIN || 'http://localhost:3000';
const allowedOrigins = rawOrigins.split(',').map((o) => o.trim()).filter(Boolean);

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Core Middlewares
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json());
app.use(originCheckMiddleware);

// Health check route
app.get('/health', async (req: Request, res: Response) => {
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    res.json({ ok: true, database: 'healthy' });
  } catch (err: any) {
    res.status(503).json({ ok: false, error: 'Database unavailable' });
  }
});

// Public Routes (NO auth required)
app.use(publicRouter);

// Domain Routes
app.use(authRouter);
app.use(leadsRouter);
app.use(accountsRouter);
app.use(contactsRouter);
app.use(dealsRouter);
app.use(quotesRouter);
app.use(activitiesRouter);
app.use(tasksRouter);
app.use(ticketsRouter);
app.use(workflowsRouter);
app.use(searchRouter);
app.use(notificationsRouter);
app.use(analyticsRouter);
app.use(auditRouter);

// Central error middleware (Express 5 handles async errors automatically)
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('API Error:', err);
  const status = typeof err.status === 'number' ? err.status : 500;
  res.status(status).json({
    error: err.message || 'Internal Server Error',
  });
});

// Wrap with http.Server for Socket.io integration
const server = http.createServer(app);
initRealtime(server);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Flint API running on http://0.0.0.0:${PORT}`);
  startScheduler();
});
