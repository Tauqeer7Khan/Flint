import pg from 'pg';
import bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma';
import { PIPELINE_STAGES, MODULES, SLA_TARGETS_MINUTES, ROLES, DEPARTMENTS } from '@flint/shared';

const connectionString = process.env.DATABASE_URL || 'postgresql://flint:flint@localhost:5432/flint?schema=public';
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
  const slaEntries: Array<{ priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'; minutes: number }> = [
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

  const meera = await prisma.user.create({
    data: {
      name: 'Meera Iyer',
      email: 'meera@flint.dev',
      password_hash: passwordHash,
      role: ROLES.MANAGER,
      department: DEPARTMENTS.SALES,
      team_id: salesTeam.id,
    },
  });

  const rahul = await prisma.user.create({
    data: {
      name: 'Rahul Sharma',
      email: 'rahul@flint.dev',
      password_hash: passwordHash,
      role: ROLES.SALES_REP,
      department: DEPARTMENTS.SALES,
      team_id: salesTeam.id,
    },
  });

  await prisma.user.createMany({
    data: [
      {
        name: 'Vikram Seth',
        email: 'vikram@flint.dev',
        password_hash: passwordHash,
        role: ROLES.SALES_REP,
        department: DEPARTMENTS.SALES,
        team_id: salesTeam.id,
      },
      {
        name: 'Ananya Sen',
        email: 'ananya@flint.dev',
        password_hash: passwordHash,
        role: ROLES.SALES_REP,
        department: DEPARTMENTS.SALES,
        team_id: salesTeam.id,
      },
      {
        name: 'Priya Nair',
        email: 'priya@flint.dev',
        password_hash: passwordHash,
        role: ROLES.SUPPORT_AGENT,
        department: DEPARTMENTS.SUPPORT,
        team_id: supportTeam.id,
      },
      {
        name: 'Kavya Reddy',
        email: 'kavya@flint.dev',
        password_hash: passwordHash,
        role: ROLES.SUPPORT_AGENT,
        department: DEPARTMENTS.CUSTOMER_SUCCESS,
        team_id: supportTeam.id,
      },
      {
        name: 'Rohan Gupta',
        email: 'rohan@flint.dev',
        password_hash: passwordHash,
        role: ROLES.SUPPORT_AGENT,
        department: DEPARTMENTS.SUPPORT,
        team_id: supportTeam.id,
      },
      {
        name: 'Admin User',
        email: 'admin@flint.dev',
        password_hash: passwordHash,
        role: ROLES.ADMIN,
        department: DEPARTMENTS.SALES,
        team_id: null,
      },
    ],
  });
  console.log('✅ Seeded 8 demo users.');

  // 6. Seed 5 Leads
  await prisma.lead.createMany({
    data: [
      {
        company_name: 'Zomato',
        contact_name: 'Aditi Rao',
        email: 'aditi.rao@zomato.dummy',
        phone: '+91 98765 43210',
        source: 'Waitlist',
        status: 'NEW',
        owner_id: rahul.id,
        consent: true,
        custom_fields: {
          companySize: 4500,
          currentHrTool: 'Darwinbox',
          interestedModules: ['HR Operations', 'Payroll', 'Attendance', 'Employee Benefits Hub'],
          hrContactDesignation: 'VP People & Culture',
        },
      },
      {
        company_name: 'Swiggy',
        contact_name: 'Kunal Shah',
        email: 'kunal.shah@swiggy.dummy',
        phone: '+91 98765 12345',
        source: 'LinkedIn',
        status: 'CONTACTED',
        owner_id: rahul.id,
        consent: true,
        custom_fields: {
          companySize: 6000,
          currentHrTool: 'Workday',
          interestedModules: ['Attendance', 'Rewards & Recognition', 'Growth OS'],
          hrContactDesignation: 'Head of Operations',
        },
      },
      {
        company_name: 'Razorpay',
        contact_name: 'Neha Singhania',
        email: 'neha.s@razorpay.dummy',
        phone: '+91 98111 22334',
        source: 'Referral',
        status: 'QUALIFIED',
        owner_id: meera.id,
        consent: true,
        custom_fields: {
          companySize: 2200,
          currentHrTool: 'Keka',
          interestedModules: ['Payroll', 'Wellness Hub', 'Performance'],
          hrContactDesignation: 'Director of Talent',
        },
      },
      {
        company_name: 'Unacademy',
        contact_name: 'Arjun Verma',
        email: 'arjun.v@unacademy.dummy',
        phone: '+91 98222 33445',
        source: 'Waitlist',
        status: 'NEW',
        owner_id: rahul.id,
        consent: true,
        custom_fields: {
          companySize: 1800,
          currentHrTool: 'Zoho People',
          interestedModules: ['Growth OS', 'Performance', 'LifeAssist'],
          hrContactDesignation: 'Senior HR Manager',
        },
      },
      {
        company_name: 'Meesho',
        contact_name: 'Tanvi Kapoor',
        email: 'tanvi.k@meesho.dummy',
        phone: '+91 98333 44556',
        source: 'Event',
        status: 'CONTACTED',
        owner_id: meera.id,
        consent: true,
        custom_fields: {
          companySize: 2500,
          currentHrTool: 'GreytHR',
          interestedModules: ['Attendance', 'Payroll', 'Rewards & Recognition'],
          hrContactDesignation: 'Chief People Officer',
        },
      },
    ],
  });
  console.log('✅ Seeded 5 leads.');

  // 7. Seed 4 Accounts
  const reliance = await prisma.account.create({
    data: {
      name: 'Reliance Digital',
      owner_id: rahul.id,
      custom_fields: {
        companySize: 12000,
        currentHrTool: 'SAP SuccessFactors',
        interestedModules: ['HR Operations', 'Attendance', 'Payroll'],
      },
    },
  });

  const infosys = await prisma.account.create({
    data: {
      name: 'Infosys Retail',
      owner_id: meera.id,
      custom_fields: {
        companySize: 8500,
        currentHrTool: 'Oracle HCM',
        interestedModules: ['Employee Benefits Hub', 'Wellness Hub'],
      },
    },
  });

  const dunzo = await prisma.account.create({
    data: {
      name: 'Dunzo',
      owner_id: rahul.id,
      custom_fields: {
        companySize: 950,
        currentHrTool: 'Keka',
        interestedModules: ['Attendance', 'Payroll', 'LifeAssist'],
      },
    },
  });

  const phonepe = await prisma.account.create({
    data: {
      name: 'PhonePe',
      owner_id: meera.id,
      custom_fields: {
        companySize: 3200,
        currentHrTool: 'Darwinbox',
        interestedModules: ['Growth OS', 'Performance', 'Rewards & Recognition'],
      },
    },
  });
  console.log('✅ Seeded 4 accounts.');

  // 8. Seed 6 Contacts
  const contacts = await Promise.all([
    prisma.contact.create({
      data: {
        name: 'Siddharth Jain',
        email: 'siddharth.jain@reliancedigital.dummy',
        phone: '+91 98444 55667',
        designation: 'VP Human Resources',
        account_id: reliance.id,
        owner_id: rahul.id,
        custom_fields: { hrContactDesignation: 'VP Human Resources' },
      },
    }),
    prisma.contact.create({
      data: {
        name: 'Deepa Malhotra',
        email: 'deepa.m@reliancedigital.dummy',
        phone: '+91 98555 66778',
        designation: 'Senior HR Business Partner',
        account_id: reliance.id,
        owner_id: rahul.id,
        custom_fields: { hrContactDesignation: 'Senior HR Business Partner' },
      },
    }),
    prisma.contact.create({
      data: {
        name: 'Rajesh Nambiar',
        email: 'rajesh.n@infosys.dummy',
        phone: '+91 98666 77889',
        designation: 'Head of Talent Management',
        account_id: infosys.id,
        owner_id: meera.id,
        custom_fields: { hrContactDesignation: 'Head of Talent Management' },
      },
    }),
    prisma.contact.create({
      data: {
        name: 'Pooja Batra',
        email: 'pooja.batra@dunzo.dummy',
        phone: '+91 98777 88990',
        designation: 'Head of People Operations',
        account_id: dunzo.id,
        owner_id: rahul.id,
        custom_fields: { hrContactDesignation: 'Head of People Operations' },
      },
    }),
    prisma.contact.create({
      data: {
        name: 'Amitabh Saxena',
        email: 'amitabh.s@phonepe.dummy',
        phone: '+91 98888 99001',
        designation: 'Chief People Officer',
        account_id: phonepe.id,
        owner_id: meera.id,
        custom_fields: { hrContactDesignation: 'Chief People Officer' },
      },
    }),
    prisma.contact.create({
      data: {
        name: 'Sangeeta Roy',
        email: 'sangeeta.roy@phonepe.dummy',
        phone: '+91 98999 00112',
        designation: 'Lead - Employee Experience',
        account_id: phonepe.id,
        owner_id: meera.id,
        custom_fields: { hrContactDesignation: 'Lead - Employee Experience' },
      },
    }),
  ]);
  console.log('✅ Seeded 6 contacts.');

  // Fetch users for deals assignment
  const vikram = await prisma.user.findUniqueOrThrow({ where: { email: 'vikram@flint.dev' } });
  const ananya = await prisma.user.findUniqueOrThrow({ where: { email: 'ananya@flint.dev' } });

  // Fetch stages
  const stages = await prisma.pipelineStage.findMany({ orderBy: { order_index: 'asc' } });
  const sWaitlist = stages.find((s) => s.name === 'Waitlist')!;
  const sDemo = stages.find((s) => s.name === 'Demo Scheduled')!;
  const sProposal = stages.find((s) => s.name === 'Pilot / Proposal')!;
  const sNegotiation = stages.find((s) => s.name === 'Negotiation')!;
  const sWon = stages.find((s) => s.name === 'Closed Won')!;
  const sLost = stages.find((s) => s.name === 'Closed Lost')!;

  // Fetch products
  const products = await prisma.product.findMany();
  const pPayroll = products.find((p) => p.name === 'Payroll')!;
  const pAttendance = products.find((p) => p.name === 'Attendance')!;
  const pOperations = products.find((p) => p.name === 'HR Operations')!;
  const pBenefits = products.find((p) => p.name === 'Employee Benefits Hub')!;
  const pWellness = products.find((p) => p.name === 'Wellness Hub')!;
  const pGrowth = products.find((p) => p.name === 'Growth OS')!;
  const pPerformance = products.find((p) => p.name === 'Performance')!;

  // 9. Seed ~9 Deals across ALL 6 stages
  const deal1 = await prisma.deal.create({
    data: {
      title: 'Reliance - Attendance & Ops Pilot',
      amount: 288000,
      employees: 300,
      stage_id: sWaitlist.id,
      account_id: reliance.id,
      contact_id: contacts[0].id,
      owner_id: rahul.id,
    },
  });

  const deal2 = await prisma.deal.create({
    data: {
      title: 'Dunzo - Benefits & Wellness Launch',
      amount: 480000,
      employees: 500,
      stage_id: sWaitlist.id,
      account_id: dunzo.id,
      contact_id: contacts[3].id,
      owner_id: vikram.id,
    },
  });

  const deal3 = await prisma.deal.create({
    data: {
      title: 'Reliance - Core HR Digital Stack',
      amount: 864000,
      employees: 600,
      stage_id: sDemo.id,
      account_id: reliance.id,
      contact_id: contacts[1].id,
      owner_id: meera.id,
    },
  });

  const deal4 = await prisma.deal.create({
    data: {
      title: 'Dunzo - Shift Management OS',
      amount: 168000,
      employees: 200,
      stage_id: sDemo.id,
      account_id: dunzo.id,
      contact_id: contacts[3].id,
      owner_id: rahul.id,
    },
  });

  const deal5 = await prisma.deal.create({
    data: {
      title: 'PhonePe - Performance & Growth OS',
      amount: 405000,
      employees: 450,
      stage_id: sProposal.id,
      account_id: phonepe.id,
      contact_id: contacts[4].id,
      owner_id: ananya.id,
    },
  });

  const deal6 = await prisma.deal.create({
    data: {
      title: 'Infosys - Rewards & Recognition Hub',
      amount: 480000,
      employees: 800,
      stage_id: sProposal.id,
      account_id: infosys.id,
      contact_id: contacts[2].id,
      owner_id: vikram.id,
    },
  });

  const deal7 = await prisma.deal.create({
    data: {
      title: 'Infosys - Full Enterprise Migration',
      amount: 504000,
      employees: 350,
      stage_id: sNegotiation.id,
      account_id: infosys.id,
      contact_id: contacts[2].id,
      owner_id: rahul.id,
    },
  });

  const deal8 = await prisma.deal.create({
    data: {
      title: 'PhonePe - Complete Employee Experience Suite',
      amount: 720000,
      employees: 500,
      stage_id: sWon.id,
      account_id: phonepe.id,
      contact_id: contacts[5].id,
      owner_id: ananya.id,
    },
  });

  const deal9 = await prisma.deal.create({
    data: {
      title: 'Dunzo - LifeAssist Standalone',
      amount: 180000,
      employees: 600,
      stage_id: sLost.id,
      account_id: dunzo.id,
      contact_id: contacts[3].id,
      owner_id: rahul.id,
    },
  });

  console.log('✅ Seeded 9 deals across all 6 stages.');

  // 10. Seed 3 Deal Stage History records
  await prisma.dealStageHistory.createMany({
    data: [
      {
        deal_id: deal3.id,
        from_stage_id: sWaitlist.id,
        to_stage_id: sDemo.id,
        changed_by: meera.id,
        changed_at: new Date(Date.now() - 48 * 3600 * 1000),
      },
      {
        deal_id: deal5.id,
        from_stage_id: sWaitlist.id,
        to_stage_id: sDemo.id,
        changed_by: ananya.id,
        changed_at: new Date(Date.now() - 72 * 3600 * 1000),
      },
      {
        deal_id: deal5.id,
        from_stage_id: sDemo.id,
        to_stage_id: sProposal.id,
        changed_by: ananya.id,
        changed_at: new Date(Date.now() - 24 * 3600 * 1000),
      },
      {
        deal_id: deal8.id,
        from_stage_id: sNegotiation.id,
        to_stage_id: sWon.id,
        changed_by: ananya.id,
        changed_at: new Date(Date.now() - 12 * 3600 * 1000),
      },
    ],
  });
  console.log('✅ Seeded 4 deal stage history records.');

  // 11. Seed 2 QUOTE documents with items
  const quote1 = await prisma.document.create({
    data: {
      type: 'QUOTE',
      number: 'Q-2026-0001',
      monthly_total: 33750,
      annual_total: 405000,
      account_id: phonepe.id,
      deal_id: deal5.id,
      items: {
        create: [
          {
            product_id: pPerformance.id,
            qty: 450,
            unit_price: pPerformance.price_per_employee_month,
          },
          {
            product_id: pGrowth.id,
            qty: 450,
            unit_price: pGrowth.price_per_employee_month,
          },
        ],
      },
    },
  });

  const quote2 = await prisma.document.create({
    data: {
      type: 'QUOTE',
      number: 'Q-2026-0002',
      monthly_total: 60000,
      annual_total: 720000,
      account_id: phonepe.id,
      deal_id: deal8.id,
      items: {
        create: [
          {
            product_id: pOperations.id,
            qty: 500,
            unit_price: pOperations.price_per_employee_month,
          },
          {
            product_id: pPayroll.id,
            qty: 500,
            unit_price: pPayroll.price_per_employee_month,
          },
          {
            product_id: pAttendance.id,
            qty: 500,
            unit_price: pAttendance.price_per_employee_month,
          },
        ],
      },
    },
  });

  const quote3 = await prisma.document.create({
    data: {
      type: 'QUOTE',
      number: 'Q-2026-0003',
      monthly_total: 42000,
      annual_total: 504000,
      account_id: infosys.id,
      deal_id: deal7.id,
      items: {
        create: [
          {
            product_id: pPayroll.id,
            qty: 350,
            unit_price: pPayroll.price_per_employee_month,
          },
          {
            product_id: pAttendance.id,
            qty: 350,
            unit_price: pAttendance.price_per_employee_month,
          },
          {
            product_id: pBenefits.id,
            qty: 350,
            unit_price: pBenefits.price_per_employee_month,
          },
        ],
      },
    },
  });
  console.log('✅ Seeded 3 QUOTE documents with line items.');

  // Fetch priya, kavya, rohan for assignments
  const priyaUser = await prisma.user.findUniqueOrThrow({ where: { email: 'priya@flint.dev' } });
  const kavyaUser = await prisma.user.findUniqueOrThrow({ where: { email: 'kavya@flint.dev' } });
  const rohanUser = await prisma.user.findUniqueOrThrow({ where: { email: 'rohan@flint.dev' } });

  // 12. Seed 17 Activities across 4 accounts
  const dayMs = 24 * 3600 * 1000;
  await prisma.activity.createMany({
    data: [
      // Reliance Digital
      {
        type: 'SYSTEM',
        body: 'Account Reliance Digital initialized in Flint CRM',
        account_id: reliance.id,
        is_internal: false,
        created_at: new Date(Date.now() - 14 * dayMs),
      },
      {
        type: 'CALL',
        body: 'Introductory discovery call with Siddharth Jain (VP HR). Discussed replacing legacy SAP module for attendance and leave.',
        account_id: reliance.id,
        contact_id: contacts[0].id,
        deal_id: deal1.id,
        author_id: rahul.id,
        is_internal: false,
        created_at: new Date(Date.now() - 13 * dayMs),
      },
      {
        type: 'NOTE',
        body: 'Headcount is 12,000+ across India. Key requirement: geo-fenced mobile punch-in for retail floor staff.',
        account_id: reliance.id,
        deal_id: deal1.id,
        author_id: rahul.id,
        is_internal: false,
        created_at: new Date(Date.now() - 11 * dayMs),
      },
      {
        type: 'INTERNAL_COMMENT',
        body: `@${meera.name} can we approve an on-site pilot in Mumbai for Reliance Digital's retail floor staff?`,
        account_id: reliance.id,
        deal_id: deal1.id,
        author_id: rahul.id,
        is_internal: true,
        mentions: [meera.id],
        created_at: new Date(Date.now() - 10 * dayMs),
      },
      {
        type: 'MEETING',
        body: 'Architecture and security review meeting with Reliance IT team. Reviewed security requirements and SSO integration.',
        account_id: reliance.id,
        contact_id: contacts[1].id,
        deal_id: deal3.id,
        author_id: meera.id,
        is_internal: false,
        created_at: new Date(Date.now() - 8 * dayMs),
      },

      // Dunzo
      {
        type: 'CALL',
        body: 'Called Pooja Batra from HR regarding delivery partner shift rosters and attendance tracking.',
        account_id: dunzo.id,
        contact_id: contacts[3].id,
        deal_id: deal4.id,
        author_id: rahul.id,
        is_internal: false,
        created_at: new Date(Date.now() - 12 * dayMs),
      },
      {
        type: 'NOTE',
        body: 'Dunzo team tested mobile punch-in with geofencing. Feedback is positive, low battery drain noted.',
        account_id: dunzo.id,
        deal_id: deal4.id,
        author_id: rahul.id,
        is_internal: false,
        created_at: new Date(Date.now() - 9 * dayMs),
      },
      {
        type: 'INTERNAL_COMMENT',
        body: `@${priyaUser.name} please verify the attendance webhook sync for Dunzo sandbox before Thursday's demo.`,
        account_id: dunzo.id,
        deal_id: deal4.id,
        author_id: rahul.id,
        is_internal: true,
        mentions: [priyaUser.id],
        created_at: new Date(Date.now() - 6 * dayMs),
      },
      {
        type: 'MEETING',
        body: 'Bi-weekly sync with Pooja and Dunzo Ops leads. Demonstrated LifeAssist wellness integration.',
        account_id: dunzo.id,
        contact_id: contacts[3].id,
        deal_id: deal2.id,
        author_id: rahul.id,
        is_internal: false,
        created_at: new Date(Date.now() - 4 * dayMs),
      },

      // Infosys Retail
      {
        type: 'CALL',
        body: 'Call with Rajesh Nambiar (Head of Talent) discussing annual rewards & recognition program.',
        account_id: infosys.id,
        contact_id: contacts[2].id,
        deal_id: deal6.id,
        author_id: meera.id,
        is_internal: false,
        created_at: new Date(Date.now() - 13 * dayMs),
      },
      {
        type: 'NOTE',
        body: 'Budget allocated for Q3 HR modernization. Exploring Benefits Hub + Wellness module bundle.',
        account_id: infosys.id,
        deal_id: deal6.id,
        author_id: vikram.id,
        is_internal: false,
        created_at: new Date(Date.now() - 10 * dayMs),
      },
      {
        type: 'INTERNAL_COMMENT',
        body: `@${rahul.name} Rajesh mentioned Dunzo's rollout — great reference point to close the proposal.`,
        account_id: infosys.id,
        deal_id: deal7.id,
        author_id: meera.id,
        is_internal: true,
        mentions: [rahul.id],
        created_at: new Date(Date.now() - 7 * dayMs),
      },
      {
        type: 'MEETING',
        body: 'Product demo with Infosys leadership committee. Showcased rewards catalog and gift cards.',
        account_id: infosys.id,
        contact_id: contacts[2].id,
        deal_id: deal7.id,
        author_id: meera.id,
        is_internal: false,
        created_at: new Date(Date.now() - 3 * dayMs),
      },

      // PhonePe
      {
        type: 'SYSTEM',
        body: '🎉 Deal won — PhonePe - Complete Employee Experience Suite (₹7,20,000)',
        account_id: phonepe.id,
        deal_id: deal8.id,
        is_internal: false,
        created_at: new Date(Date.now() - 2 * dayMs),
      },
      {
        type: 'CALL',
        body: 'Kickoff call with Amitabh Saxena (CHRO) and Sangeeta Roy on onboarding timelines.',
        account_id: phonepe.id,
        contact_id: contacts[4].id,
        deal_id: deal8.id,
        author_id: ananya.id,
        is_internal: false,
        created_at: new Date(Date.now() - 2 * dayMs + 3600000),
      },
      {
        type: 'INTERNAL_COMMENT',
        body: `@${priyaUser.name} Sangeeta from PhonePe will be our primary SPOC for employee data migration.`,
        account_id: phonepe.id,
        author_id: ananya.id,
        is_internal: true,
        mentions: [priyaUser.id],
        created_at: new Date(Date.now() - 1 * dayMs),
      },
      {
        type: 'NOTE',
        body: 'Onboarding checklist sent. Goal is to go live with Performance & Growth OS by end of month.',
        account_id: phonepe.id,
        contact_id: contacts[5].id,
        deal_id: deal8.id,
        author_id: ananya.id,
        is_internal: false,
        created_at: new Date(Date.now() - 12 * 3600 * 1000),
      },
    ],
  });
  console.log('✅ Seeded 17 activities across 4 accounts.');

  // 13. Seed 8 Tasks across Rahul, Priya, Kavya, Rohan
  await prisma.task.createMany({
    data: [
      {
        title: 'Prepare custom pitch deck for Retail floor shift attendance',
        description: 'Focus on geo-fenced mobile punch-in and offline sync for 12,000 retail staff.',
        assignee_id: rahul.id,
        created_by: meera.id,
        account_id: reliance.id,
        deal_id: deal1.id,
        priority: 'HIGH',
        status: 'IN_PROGRESS',
        due_at: new Date(Date.now() + 24 * 3600 * 1000),
      },
      {
        title: 'Send updated contract redline to Infosys procurement',
        description: 'Confirm 350-seat tiered pricing and net 30 payment terms.',
        assignee_id: rahul.id,
        created_by: rahul.id,
        account_id: infosys.id,
        deal_id: deal7.id,
        priority: 'URGENT',
        status: 'TODO',
        due_at: new Date(Date.now() - 24 * 3600 * 1000), // Overdue
      },
      {
        title: 'Schedule product deep-dive with Dunzo engineering',
        description: 'Review webhook latency and daily attendance CSV import schema.',
        assignee_id: rahul.id,
        created_by: meera.id,
        account_id: dunzo.id,
        deal_id: deal4.id,
        priority: 'MEDIUM',
        status: 'COMPLETED',
        due_at: new Date(Date.now() - 48 * 3600 * 1000),
      },
      {
        title: 'Verify PhonePe SSO & SAML configuration in staging',
        description: 'Test Okta SSO integration and automatic user provisioning via SCIM.',
        assignee_id: priyaUser.id,
        created_by: ananya.id,
        account_id: phonepe.id,
        priority: 'HIGH',
        status: 'TODO',
        due_at: new Date(Date.now() + 6 * 3600 * 1000),
      },
      {
        title: 'Investigate geofence drift on Android 14 devices',
        description: 'Reproduce GPS jitter on Reliance Digital store pilot tablets.',
        assignee_id: priyaUser.id,
        created_by: priyaUser.id,
        account_id: reliance.id,
        priority: 'URGENT',
        status: 'IN_PROGRESS',
        due_at: new Date(Date.now() - 2 * 3600 * 1000), // Overdue
      },
      {
        title: 'Prepare quarterly onboarding metrics for PhonePe leadership',
        description: 'Compile activation rates across Performance and Growth OS modules.',
        assignee_id: kavyaUser.id,
        created_by: meera.id,
        account_id: phonepe.id,
        priority: 'MEDIUM',
        status: 'TODO',
        due_at: new Date(Date.now() + 72 * 3600 * 1000),
      },
      {
        title: 'Follow up with Pooja on LifeAssist employee pilot feedback',
        description: 'Gather feedback from 50 test users in Dunzo operations.',
        assignee_id: kavyaUser.id,
        created_by: rahul.id,
        account_id: dunzo.id,
        priority: 'LOW',
        status: 'COMPLETED',
        due_at: new Date(Date.now() - 36 * 3600 * 1000),
      },
      {
        title: 'Audit SLA response timestamps for Reliance escalated issues',
        description: 'Verify first response timestamps meet 2-hour VIP threshold.',
        assignee_id: rohanUser.id,
        created_by: priyaUser.id,
        account_id: reliance.id,
        priority: 'MEDIUM',
        status: 'TODO',
        due_at: new Date(Date.now() + 12 * 3600 * 1000),
      },
    ],
  });
  console.log('✅ Seeded 8 tasks across team members.');

  // 14. Seed 6 Tickets across accounts
  const ticket1 = await prisma.ticket.create({
    data: {
      subject: 'Attendance geo-fence not triggering on retail floor tablets',
      description: 'Store staff in Mumbai flagship cannot punch in via Android tablets. Shows out of bounds error.',
      priority: 'URGENT',
      status: 'OPEN',
      account_id: reliance.id,
      contact_id: contacts[0].id,
      assignee_id: priyaUser.id,
      sla_due_at: new Date(Date.now() + 3 * 60 * 1000), // Breaches in 3 minutes!
      sla_breached_at: null,
    },
  });

  const ticket2 = await prisma.ticket.create({
    data: {
      subject: 'Payroll sync failing with Darwinbox webhook timeout',
      description: 'Monthly payroll batch upload triggers 504 Gateway Timeout on Darwinbox connector.',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      account_id: phonepe.id,
      contact_id: contacts[4].id,
      assignee_id: priyaUser.id,
      sla_due_at: new Date(Date.now() - 45 * 60 * 1000), // Breached 45m ago
      sla_breached_at: new Date(Date.now() - 45 * 60 * 1000),
    },
  });

  const ticket3 = await prisma.ticket.create({
    data: {
      subject: 'Benefits enrollment CSV rejected with format error',
      description: 'Header validation fails on row 142 due to special characters in dependent names.',
      priority: 'MEDIUM',
      status: 'OPEN',
      account_id: infosys.id,
      contact_id: contacts[2].id,
      assignee_id: rohanUser.id,
      sla_due_at: new Date(Date.now() + 45 * 60 * 1000), // Future SLA
      sla_breached_at: null,
    },
  });

  const ticket4 = await prisma.ticket.create({
    data: {
      subject: 'Wellness points not crediting after step goal completion',
      description: 'User completed 10k steps 3 days in a row, health points balance did not update in app.',
      priority: 'LOW',
      status: 'RESOLVED',
      account_id: dunzo.id,
      contact_id: contacts[3].id,
      assignee_id: priyaUser.id,
      sla_due_at: new Date(Date.now() - 120 * 60 * 1000),
      first_response_at: new Date(Date.now() - 150 * 60 * 1000),
    },
  });

  const ticket5 = await prisma.ticket.create({
    data: {
      subject: 'Shift roster duplicate check fails during bulk upload',
      description: 'Uploading two shifts for the same employee on overlapping shifts does not trigger error alert.',
      priority: 'MEDIUM',
      status: 'WAITING',
      account_id: reliance.id,
      contact_id: contacts[1].id,
      assignee_id: kavyaUser.id,
      sla_due_at: new Date(Date.now() + 60 * 60 * 1000),
      first_response_at: new Date(Date.now() - 10 * 60 * 1000),
    },
  });

  const ticket6 = await prisma.ticket.create({
    data: {
      subject: 'API webhook signature mismatch on employee update event',
      description: 'HMAC SHA256 header validation intermittent failure on update.employee webhook.',
      priority: 'HIGH',
      status: 'OPEN',
      account_id: phonepe.id,
      contact_id: contacts[5].id,
      assignee_id: priyaUser.id,
      sla_due_at: new Date(Date.now() + 30 * 60 * 1000), // Future SLA
      sla_breached_at: null,
    },
  });

  console.log('✅ Seeded 6 tickets with SLA targets.');

  // 15. Seed 3 Ticket Replies (Activities with ticket_id)
  await prisma.activity.createMany({
    data: [
      {
        type: 'NOTE',
        body: 'Checking Android GPS permissions and accuracy radius settings in the tablet configuration profile.',
        account_id: reliance.id,
        ticket_id: ticket1.id,
        author_id: priyaUser.id,
        is_internal: false,
        created_at: new Date(Date.now() - 1 * 60 * 1000),
      },
      {
        type: 'NOTE',
        body: 'Identified HTTP 504 gateway timeout from Darwinbox endpoint during peak batch run. We are enabling chunked retries.',
        account_id: phonepe.id,
        ticket_id: ticket2.id,
        author_id: priyaUser.id,
        is_internal: false,
        created_at: new Date(Date.now() - 30 * 60 * 1000),
      },
      {
        type: 'INTERNAL_COMMENT',
        body: `@${priyaUser.name} backend retry queue is configured, please verify if token renewal is needed.`,
        account_id: phonepe.id,
        ticket_id: ticket2.id,
        author_id: rohanUser.id,
        is_internal: true,
        mentions: [priyaUser.id],
        created_at: new Date(Date.now() - 20 * 60 * 1000),
      },
    ],
  });
  console.log('✅ Seeded 3 ticket reply activities.');

  // 16. Seed 3 Core Workflows (Phase 6)
  const wfWaitlist = await prisma.workflow.create({
    data: {
      name: 'Waitlist Lead Routing',
      trigger: 'lead.created',
      conditions: { source: 'Waitlist' },
      actions: [
        { type: 'assign_user', target: 'size_threshold' },
        { type: 'notify', template: 'New Waitlist Lead assigned: {{lead.companyName}}' },
      ],
      is_active: true,
    },
  });

  const wfDealWon = await prisma.workflow.create({
    data: {
      name: 'Deal Won CS Handoff',
      trigger: 'deal.won',
      conditions: {},
      actions: [
        { type: 'create_task', forEach: 'purchased_modules', dueDays: 3 },
        { type: 'notify', targetRole: 'SUPPORT_AGENT', template: 'Deal Won: {{deal.title}} — Onboarding tasks created' },
      ],
      is_active: true,
    },
  });

  const wfSlaBreach = await prisma.workflow.create({
    data: {
      name: 'SLA Breach Manager Escalation',
      trigger: 'ticket.sla_breached',
      conditions: {},
      actions: [
        { type: 'assign_user', targetRole: 'MANAGER' },
        { type: 'notify', targetRole: 'MANAGER', template: 'URGENT SLA BREACH: Ticket {{ticket.subject}} escalated' },
      ],
      is_active: true,
    },
  });

  console.log('✅ Seeded 3 core automated workflows.');

  // 17. Seed 4 Historical Workflow Runs
  await prisma.workflowRun.createMany({
    data: [
      {
        workflow_id: wfWaitlist.id,
        trigger_event: {
          leadId: 'seeded-lead-1',
          companyName: 'Zomato',
          source: 'Waitlist',
          companySize: 4500,
        },
        status: 'SUCCESS',
        log: {
          actionsExecuted: [
            {
              type: 'assign_user',
              details: {
                assignedToName: 'Meera Iyer',
                role: 'MANAGER',
                rule: 'size >= 500 (Manager)',
              },
            },
            {
              type: 'notify',
              details: {
                recipient: 'Meera Iyer',
                message: 'New Waitlist Lead assigned: Zomato',
              },
            },
          ],
          completedAt: new Date(Date.now() - 5 * dayMs).toISOString(),
        },
        created_at: new Date(Date.now() - 5 * dayMs),
      },
      {
        workflow_id: wfDealWon.id,
        trigger_event: {
          dealId: deal8.id,
          title: 'PhonePe - Complete Employee Experience Suite',
          amount: 720000,
          employees: 500,
        },
        status: 'SUCCESS',
        log: {
          actionsExecuted: [
            {
              type: 'create_task',
              details: {
                mode: 'forEach:purchased_modules',
                tasksCount: 3,
                tasks: [
                  'Onboarding: HR Operations setup for PhonePe',
                  'Onboarding: Payroll setup for PhonePe',
                  'Onboarding: Attendance setup for PhonePe',
                ],
              },
            },
            {
              type: 'notify',
              details: {
                targetRole: 'SUPPORT_AGENT',
                message: 'Deal Won: PhonePe - Complete Employee Experience Suite — Onboarding tasks created',
              },
            },
          ],
          completedAt: new Date(Date.now() - 2 * dayMs).toISOString(),
        },
        created_at: new Date(Date.now() - 2 * dayMs),
      },
      {
        workflow_id: wfSlaBreach.id,
        trigger_event: {
          ticketId: ticket2.id,
          subject: 'Payroll sync failing with Darwinbox webhook timeout',
          priority: 'HIGH',
        },
        status: 'SUCCESS',
        log: {
          actionsExecuted: [
            {
              type: 'assign_user',
              details: {
                assignedToName: 'Meera Iyer',
                role: 'MANAGER',
                reason: 'SLA breach escalation to management',
              },
            },
            {
              type: 'notify',
              details: {
                targetRole: 'MANAGER',
                message: 'URGENT SLA BREACH: Ticket Payroll sync failing with Darwinbox webhook timeout escalated',
              },
            },
          ],
          completedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        },
        created_at: new Date(Date.now() - 45 * 60 * 1000),
      },
      {
        workflow_id: wfWaitlist.id,
        trigger_event: {
          leadId: 'seeded-lead-2',
          companyName: 'Dunzo Staging',
          source: 'Waitlist',
          companySize: 250,
        },
        status: 'SUCCESS',
        log: {
          actionsExecuted: [
            {
              type: 'assign_user',
              details: {
                assignedToName: 'Rahul Sharma',
                role: 'SALES_REP',
                rule: 'size < 500 (Sales Rep)',
              },
            },
            {
              type: 'notify',
              details: {
                recipient: 'Rahul Sharma',
                message: 'New Waitlist Lead assigned: Dunzo Staging',
              },
            },
          ],
          completedAt: new Date(Date.now() - 1 * dayMs).toISOString(),
        },
        created_at: new Date(Date.now() - 1 * dayMs),
      },
    ],
  });
  console.log('✅ Seeded 4 historical workflow run logs.');

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
