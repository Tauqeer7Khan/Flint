import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { loginSchema, demoLoginSchema, SessionUser, ROLES } from '@flint/shared';
import { prisma } from '../../lib/prisma';
import { signSessionToken, signSocketToken } from '../../lib/jwt';
import { authMiddleware, COOKIE_NAME, COOKIE_OPTIONS } from '../../middleware/auth';

export const authRouter = Router();

// POST /auth/login
authRouter.post('/auth/login', async (req: Request, res: Response) => {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    const message = result.error.issues?.[0]?.message || 'Invalid login details';
    return res.status(400).json({ error: message });
  }

  const { email, password } = result.data;
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordValid) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const sessionUser: SessionUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department,
    teamId: user.team_id,
  };

  const token = signSessionToken(sessionUser);
  res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);
  return res.json(sessionUser);
});

// POST /auth/logout
authRouter.post('/auth/logout', (req: Request, res: Response) => {
  res.clearCookie(COOKIE_NAME, COOKIE_OPTIONS);
  return res.json({ ok: true });
});

// GET /auth/me
authRouter.get('/auth/me', authMiddleware, (req: Request, res: Response) => {
  return res.json(req.user);
});

// GET /auth/socket-token
authRouter.get('/auth/socket-token', authMiddleware, (req: Request, res: Response) => {
  const socketToken = signSocketToken(req.user!);
  return res.json({ token: socketToken });
});

// POST /auth/demo (guarded strictly by DEMO_MODE=true)
authRouter.post('/auth/demo', async (req: Request, res: Response) => {
  if (process.env.DEMO_MODE !== 'true') {
    return res.status(403).json({ error: 'Forbidden: Demo mode is disabled' });
  }

  const result = demoLoginSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Valid demo role is required' });
  }

  const { role } = result.data;

  // Designated demo accounts
  const demoEmailMap: Record<string, string> = {
    [ROLES.ADMIN]: 'admin@flint.dev',
    [ROLES.MANAGER]: 'meera@flint.dev',
    [ROLES.SALES_REP]: 'rahul@flint.dev',
    [ROLES.SUPPORT_AGENT]: 'priya@flint.dev',
  };

  const targetEmail = demoEmailMap[role];
  let user = targetEmail
    ? await prisma.user.findUnique({ where: { email: targetEmail } })
    : null;

  if (!user) {
    // Fallback: any user with that role
    user = await prisma.user.findFirst({
      where: { role },
      orderBy: { name: 'asc' },
    });
  }

  if (!user) {
    return res.status(404).json({ error: `No demo user found for role: ${role}` });
  }

  const sessionUser: SessionUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department,
    teamId: user.team_id,
  };

  const token = signSessionToken(sessionUser);
  res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);
  return res.json(sessionUser);
});

// GET /users (assignee picker lookup)
authRouter.get('/users', authMiddleware, async (req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      team_id: true,
    },
    orderBy: { name: 'asc' },
  });

  const formatted = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    department: u.department,
    teamId: u.team_id,
  }));

  return res.json(formatted);
});
