import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { scopeFor } from '../../middleware/rbac';
import { authMiddleware } from '../../middleware/auth';

export const searchRouter = Router();

searchRouter.get('/search', authMiddleware, async (req: Request, res: Response) => {
  const q = String(req.query.q || '').trim();

  // If query is less than 2 characters, return empty arrays per spec
  if (q.length < 2) {
    return res.json({
      accounts: [],
      contacts: [],
      deals: [],
      leads: [],
    });
  }

  const queryPattern = `%${q}%`;

  try {
    // 1. Search Accounts (top 5)
    const accountsRaw = await prisma.$queryRaw<
      Array<{ id: string; name: string; owner_id: string | null; owner_name: string | null }>
    >`
      SELECT 
        a.id, 
        a.name, 
        u.id as owner_id, 
        u.name as owner_name
      FROM accounts a
      LEFT JOIN users u ON a.owner_id = u.id
      WHERE a.deleted_at IS NULL
        AND (
          a.name % ${q}
          OR similarity(a.name, ${q}) > 0.2
          OR a.name ILIKE ${queryPattern}
        )
      ORDER BY similarity(a.name, ${q}) DESC, a.created_at DESC
      LIMIT 5;
    `;

    const accounts = accountsRaw.map((a) => ({
      id: a.id,
      name: a.name,
      owner: a.owner_id ? { id: a.owner_id, name: a.owner_name } : null,
    }));

    // 2. Search Contacts (top 5)
    const contactsRaw = await prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        email: string;
        designation: string | null;
        account_id: string | null;
        account_name: string | null;
      }>
    >`
      SELECT 
        c.id, 
        c.name, 
        c.email, 
        c.designation, 
        a.id as account_id, 
        a.name as account_name
      FROM contacts c
      LEFT JOIN accounts a ON c.account_id = a.id
      WHERE c.deleted_at IS NULL
        AND (
          c.name % ${q}
          OR similarity(c.name, ${q}) > 0.2
          OR c.name ILIKE ${queryPattern}
          OR c.email ILIKE ${queryPattern}
        )
      ORDER BY similarity(c.name, ${q}) DESC, c.created_at DESC
      LIMIT 5;
    `;

    const contacts = contactsRaw.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      designation: c.designation,
      accountName: c.account_name,
      account: c.account_id ? { id: c.account_id, name: c.account_name } : null,
    }));

    // 3. Search Deals (top 5)
    const dealsRaw = await prisma.$queryRaw<
      Array<{
        id: string;
        title: string;
        amount: number;
        employees: number;
        stage_name: string | null;
        stage_probability: number | null;
      }>
    >`
      SELECT 
        d.id, 
        d.title, 
        d.amount, 
        d.employees,
        ps.name as stage_name, 
        ps.probability as stage_probability
      FROM deals d
      LEFT JOIN pipeline_stages ps ON d.stage_id = ps.id
      WHERE d.deleted_at IS NULL
        AND (
          d.title % ${q}
          OR similarity(d.title, ${q}) > 0.2
          OR d.title ILIKE ${queryPattern}
        )
      ORDER BY similarity(d.title, ${q}) DESC, d.created_at DESC
      LIMIT 5;
    `;

    const deals = dealsRaw.map((d) => ({
      id: d.id,
      title: d.title,
      amount: d.amount,
      employees: d.employees,
      stageName: d.stage_name || 'Active',
      probability: d.stage_probability || 0,
    }));

    // 4. Search Leads (top 5, with RBAC scoping)
    const leadScope = scopeFor(req.user!, 'leads');
    let leads: any[] = [];

    // Support Agent cannot view leads (leadScope === null)
    if (leadScope !== null) {
      if (leadScope.owner_id) {
        // Scoped to specific owner (e.g. Sales Rep)
        const leadsRaw = await prisma.$queryRaw<
          Array<{
            id: string;
            company_name: string;
            contact_name: string;
            status: string;
            source: string;
          }>
        >`
          SELECT 
            l.id, 
            l.company_name, 
            l.contact_name, 
            l.status, 
            l.source
          FROM leads l
          WHERE l.deleted_at IS NULL
            AND l.owner_id = ${leadScope.owner_id}
            AND (
              l.company_name % ${q}
              OR similarity(l.company_name, ${q}) > 0.2
              OR l.company_name ILIKE ${queryPattern}
              OR l.contact_name % ${q}
              OR similarity(l.contact_name, ${q}) > 0.2
              OR l.contact_name ILIKE ${queryPattern}
            )
          ORDER BY similarity(l.company_name, ${q}) DESC, l.created_at DESC
          LIMIT 5;
        `;

        leads = leadsRaw.map((l) => ({
          id: l.id,
          companyName: l.company_name,
          contactName: l.contact_name,
          status: l.status,
          source: l.source,
        }));
      } else {
        // Unrestricted scope (Admin / Manager)
        const leadsRaw = await prisma.$queryRaw<
          Array<{
            id: string;
            company_name: string;
            contact_name: string;
            status: string;
            source: string;
          }>
        >`
          SELECT 
            l.id, 
            l.company_name, 
            l.contact_name, 
            l.status, 
            l.source
          FROM leads l
          WHERE l.deleted_at IS NULL
            AND (
              l.company_name % ${q}
              OR similarity(l.company_name, ${q}) > 0.2
              OR l.company_name ILIKE ${queryPattern}
              OR l.contact_name % ${q}
              OR similarity(l.contact_name, ${q}) > 0.2
              OR l.contact_name ILIKE ${queryPattern}
            )
          ORDER BY similarity(l.company_name, ${q}) DESC, l.created_at DESC
          LIMIT 5;
        `;

        leads = leadsRaw.map((l) => ({
          id: l.id,
          companyName: l.company_name,
          contactName: l.contact_name,
          status: l.status,
          source: l.source,
        }));
      }
    }

    return res.json({
      accounts,
      contacts,
      deals,
      leads,
    });
  } catch (err: any) {
    console.error('Search error:', err);
    return res.status(500).json({ error: 'Search query failed' });
  }
});
