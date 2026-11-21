import { Request, Response, NextFunction } from 'express';
import { Role, SessionUser } from '@flint/shared';
import { verifySessionToken } from '../lib/jwt';
import { prisma } from '../lib/prisma';

export const COOKIE_NAME = 'flint_token';

export const COOKIE_OPTIONS = {
  httpOnly: true,
  get secure() {
    return (process.env.WEB_ORIGIN || '').startsWith('https://');
  },
  sameSite: 'lax' as const,
  maxAge: 12 * 60 * 60 * 1000, // 12 hours
  path: '/',
};

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE_NAME] || req.headers.authorization?.replace(/^Bearer\s+/i, '');

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  try {
    const payload = verifySessionToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        team_id: true,
      },
    });

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: User no longer exists' });
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      teamId: user.team_id,
    };

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient role permissions' });
    }

    next();
  };
}
