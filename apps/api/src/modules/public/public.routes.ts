import { Router, Request, Response } from 'express';
import { waitlistSchema } from '@flint/shared';
import { prisma } from '../../lib/prisma';
import { emitDomainEvent } from '../../lib/events';

export const publicRouter = Router();

// In-memory rate limiting: max 5 requests per IP per minute
interface RateLimitEntry {
  count: number;
  resetAt: number;
}
const rateLimitMap = new Map<string, RateLimitEntry>();

// Cleanup stale rate limit entries periodically (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (entry.resetAt <= now) {
      rateLimitMap.delete(ip);
    }
  }
}, 300000);

// POST /public/waitlist (NO authMiddleware)
publicRouter.post('/public/waitlist', async (req: Request, res: Response) => {
  // 1. In-memory Rate Limit check (5 req/min per IP)
  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
    req.socket.remoteAddress ||
    'unknown-ip';

  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || entry.resetAt <= now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60000 });
  } else {
    entry.count += 1;
    if (entry.count > 5) {
      return res.status(429).json({ error: 'Too many requests. Please try again in a minute.' });
    }
  }

  // 2. Honeypot check: website field must be empty
  if (req.body.website && typeof req.body.website === 'string' && req.body.website.trim().length > 0) {
    // Silent drop: return 200 without creating lead
    return res.status(200).json({ success: true, message: "You're on the list!" });
  }

  // 3. Zod validation
  const result = waitlistSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: result.error.issues?.[0]?.message || 'Invalid form submission',
    });
  }

  const { name, email, companyName, companySize, currentHrTool, interestedModules, hrContactDesignation } = result.data;

  // 4. Create Lead in Database
  const newLead = await prisma.lead.create({
    data: {
      source: 'Waitlist',
      status: 'NEW',
      company_name: companyName,
      contact_name: name,
      email,
      custom_fields: {
        companySize,
        currentHrTool: currentHrTool || '',
        interestedModules: interestedModules || [],
        hrContactDesignation: hrContactDesignation || '',
      },
      consent: true,
    },
  });

  // 5. Emit lead.created domain event (triggers Phase 6 Waitlist Lead Routing workflow)
  try {
    await emitDomainEvent('lead.created', {
      leadId: newLead.id,
      companyName: newLead.company_name,
      source: newLead.source,
      ownerId: newLead.owner_id,
      companySize,
      customFields: newLead.custom_fields,
    });
  } catch (err) {
    console.error('Failed to emit lead.created domain event:', err);
  }

  // 6. Response: 201 Created
  return res.status(201).json({
    success: true,
    message: "You're on the list! We'll reach out soon.",
  });
});
