import pg from 'pg';
import bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma';
import { PIPELINE_STAGES, MODULES, SLA_TARGETS_MINUTES, ROLES, DEPARTMENTS } from '@flint/shared';
const connectionString = process.env.DATABASE_URL || 'postgresql://flint:flint@localhost:5432/flint?schema=public';

// Safety guard: refuse to wipe/seed a remote database unless ALLOW_REMOTE_RESET=1
try {
  const parsedUrl = new URL(connectionString);
  const hostname = parsedUrl.hostname.toLowerCase();
  const allowedLocalHosts = ['localhost', '127.0.0.1', 'db'];
  const isLocalHost = allowedLocalHosts.includes(hostname);

  if (!isLocalHost && process.env.ALLOW_REMOTE_RESET !== '1') {
    console.error(`\n❌ SAFETY GUARD REFUSAL: Refusing to reset/seed remote database at host "${hostname}".`);
    console.error('Resetting a remote database requires ALLOW_REMOTE_RESET=1.');
    console.error('Usage: ALLOW_REMOTE_RESET=1 DATABASE_URL=<url> pnpm --filter api db:reset\n');
    process.exit(1);
  }
} catch (err) {
  if (process.env.ALLOW_REMOTE_RESET !== '1') {
    console.error(`\n❌ SAFETY GUARD REFUSAL: Could not verify database host as local, and ALLOW_REMOTE_RESET is not set.`);
    process.exit(1);
  }
}

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
async function main() {
    console.log('🌱 Starting database seed...');
    // Truncate tables for idempotence
    await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE 
      "audit_logs",
      "workflow_runs",
      "workflows",
      "activities",
      "notifications",
      "tasks",
      "tickets",
      "document_items",
      "documents",
      "deal_stage_history",
      "deals",
      "contacts",
      "accounts",
      "leads",
      "products",
      "sla_policies",
      "pipeline_stages",
      "users",
      "teams"
    CASCADE;
  `);
    console.log('🧹 Cleaned existing tables.');
    // 1. Seed exactly 6 Pipeline Stages per locked spec
    for (const stage of PIPELINE_STAGES) {
        await prisma.pipelineStage.create({
            data: {
                name: stage.name,
                probability: stage.probability,
                order_index: stage.order_index,
            },
        });
    }
    console.log(`✅ Seeded ${PIPELINE_STAGES.length} pipeline stages.`);
    // 2. Seed 4 SLA Policies (normal targets)
    const slaEntries = [
        { priority: 'LOW', minutes: SLA_TARGETS_MINUTES.normal.LOW },
        { priority: 'MEDIUM', minutes: SLA_TARGETS_MINUTES.normal.MEDIUM },
        { priority: 'HIGH', minutes: SLA_TARGETS_MINUTES.normal.HIGH },
        { priority: 'URGENT', minutes: SLA_TARGETS_MINUTES.normal.URGENT },
    ];
    for (const policy of slaEntries) {
        await prisma.slaPolicy.create({
            data: {
                priority: policy.priority,
                first_response_minutes: policy.minutes,
            },
        });
    }
    console.log(`✅ Seeded ${slaEntries.length} SLA policies.`);
    // 3. Seed 10 Products at README prices
    for (const mod of MODULES) {
        await prisma.product.create({
            data: {
                name: mod.name,
                price_per_employee_month: mod.price_per_employee_month,
                is_active: true,
            },
        });
    }
    console.log(`✅ Seeded ${MODULES.length} products.`);
    // 4. Seed Teams
    const salesTeam = await prisma.team.create({
        data: {
            name: 'Enterprise Sales',
            department: DEPARTMENTS.SALES,
        },
    });
    const supportTeam = await prisma.team.create({
        data: {
            name: 'Support & Success',
            department: DEPARTMENTS.SUPPORT,
        },
    });
    console.log('✅ Seeded teams: Enterprise Sales, Support & Success.');
    // 5. Seed Users (password: flint123)
    const passwordHash = await bcrypt.hash('flint123', 10);
    const demoUsers = [
        // Enterprise Sales
        {
            name: 'Meera Iyer',
            email: 'meera@flint.dev',
            role: ROLES.MANAGER,
            department: DEPARTMENTS.SALES,
            team_id: salesTeam.id,
        },
        {
            name: 'Rahul Sharma',
            email: 'rahul@flint.dev',
            role: ROLES.SALES_REP,
            department: DEPARTMENTS.SALES,
            team_id: salesTeam.id,
        },
        {
            name: 'Vikram Seth',
            email: 'vikram@flint.dev',
            role: ROLES.SALES_REP,
            department: DEPARTMENTS.SALES,
            team_id: salesTeam.id,
        },
        {
            name: 'Ananya Sen',
            email: 'ananya@flint.dev',
            role: ROLES.SALES_REP,
            department: DEPARTMENTS.SALES,
            team_id: salesTeam.id,
        },
        // Support & Success
        {
            name: 'Priya Nair',
            email: 'priya@flint.dev',
            role: ROLES.SUPPORT_AGENT,
            department: DEPARTMENTS.SUPPORT,
            team_id: supportTeam.id,
        },
        {
            name: 'Kavya Reddy',
            email: 'kavya@flint.dev',
            role: ROLES.SUPPORT_AGENT,
            department: DEPARTMENTS.CUSTOMER_SUCCESS,
            team_id: supportTeam.id,
        },
        {
            name: 'Rohan Gupta',
            email: 'rohan@flint.dev',
            role: ROLES.SUPPORT_AGENT,
            department: DEPARTMENTS.SUPPORT,
            team_id: supportTeam.id,
        },
        // Admin
        {
            name: 'Admin User',
            email: 'admin@flint.dev',
            role: ROLES.ADMIN,
            department: DEPARTMENTS.SALES,
            team_id: null,
        },
    ];
    for (const user of demoUsers) {
        await prisma.user.create({
            data: {
                name: user.name,
                email: user.email,
                password_hash: passwordHash,
                role: user.role,
                department: user.department,
                team_id: user.team_id,
            },
        });
    }
    console.log(`✅ Seeded ${demoUsers.length} demo users.`);
    console.log('✨ Seed finished successfully.');
}
main()
    .catch((err) => {
    console.error('❌ Seeding error:', err);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
});
