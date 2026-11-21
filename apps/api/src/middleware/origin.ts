import { Request, Response, NextFunction } from 'express';

export function originCheckMiddleware(req: Request, res: Response, next: NextFunction) {
  const mutatingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  if (mutatingMethods.includes(req.method)) {
    const origin = req.headers.origin;
    const rawOrigins = process.env.WEB_ORIGIN || 'http://localhost:3000';
    const allowedOrigins = rawOrigins.split(',').map((o) => o.trim()).filter(Boolean);
    if (origin && !allowedOrigins.includes(origin)) {
      return res.status(403).json({ error: 'Forbidden: Invalid request origin' });
    }
  }
  next();
}
