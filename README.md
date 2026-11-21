# 🔥 FLINT — Collaborative CRM for Empulz

[![Status: Planning Complete v2](https://img.shields.io/badge/Status-Planning_Complete_v2-orange?style=for-the-badge)](#-current-status--build-progress)
[![Type: Concept Project](https://img.shields.io/badge/Type-Concept_Project-7C3AED?style=for-the-badge)](#-project-purpose)

> **"One customer. One view. Every team."**

> ⚠️ **Concept project.** Built by **Tauqeer Khan** to demonstrate engineering and product skills to **Empulz** (a product of Flixverse Holdings Pvt. Ltd.). It is NOT an official Empulz product, and it is **not related to Xoxoday "Empuls"** (a different, established product with a similar name). All data, names and pricing are dummy.

> 🗓️ **Plan version:** v2 (reviewed 20 Nov 2026). v2 = tech versions updated, deploy approach fixed, **scope cut to a lean, demo-critical P0**. See [Scope Changes (v2)](#-scope-changes-v2).

---

## 🎯 Project Purpose

Flint is a **demo-first portfolio project**. The goal is to show Empulz, in a ~6 minute live demo, that I understand their business (B2B employee experience SaaS, pre-launch, waitlist-driven) and can ship a full-stack, real-time, role-aware product in about 24 hours.

**Priority order for every decision:** demo quality > feature depth > production hardening.

**Time budget (v2):** P0 ≈ **19 hours** + **~5 hours buffer** for slippage, then the P1 queue. The demo is run from **localhost**; deployment is an optional bonus.

---

## 🧩 The Problem

In most companies, Sales, Customer Success and Support work in silos:
- Sales pitches an upsell while the customer has an open, angry support ticket.
- Support has no idea what was promised during the sale.
- Handoff after "Deal Won" happens over WhatsApp or email, and context is lost.

Empulz's own philosophy is *"No silos. Every touchpoint connects."* Flint applies that to the **customer-facing side** of Empulz.

---

## 🏢 Target Company Context (Empulz)

| Fact | Impact on Flint |
|---|---|
| Employee Experience Platform (B2B SaaS), pre-launch ("Launching soon") | Internal Sales + CS + Support team is the CRM user base |
| "Join Waitlist" is the main CTA; site shows "100+ HR Leaders Registered" (the waitlist subdomain shows "85+") | Waitlist is the #1 lead source; public waitlist form is a P0 feature. **Don't quote an exact number in the demo without re-checking.** |
| "500+ employees expected at launch", "10+ integrated modules" | Deal value is per-employee pricing |
| 10 modules used as the catalog: HR Operations, Attendance, Payroll, Employee Benefits Hub, Wellness Hub, LifeAssist, Rewards & Recognition, Growth OS, Performance, Reports & Analytics | These ARE the dummy product catalog. ⚠️ Home page lists only HR Ops, Benefits, Wellness, Growth, Recognition, LifeAssist, Pulse AI. Confirm the rest on the Features page; prices are dummy either way |
| Claims SOC 2, RBAC, audit trails (**not re-verified**) | RBAC + Audit Log are justified features; don't repeat the SOC 2 claim in the demo unless confirmed |
| Has "Pulse AI" product | Do NOT reuse the name. Flint's health score is called **Account Pulse** |
| Indian company | Currency is **₹ (INR)**, formatted with `en-IN` (e.g., ₹12,50,000) |

---

## ✨ What Flint Does

Flint is a **hybrid CRM: Operational foundation + Collaborative core**, kept deliberately lean.

- 📇 **Data Hub:** Leads, Contacts, Accounts, Deals (Empulz fields built into forms)
- 📊 **Sales Pipeline:** Drag-and-drop Kanban, weighted revenue, products, quote builder
- 🗂️ **Activities:** Notes, calls, meetings, one unified timeline
- ✅ **Tasks:** Assignments, due dates, "My Tasks" queue
- 🎧 **Helpdesk:** Tickets, status flow, SLA timers + breach, replies
- ⚙️ **Automation Engine:** Trigger → Condition → Action, 3 seeded workflows, run history
- 📈 **Analytics (lite):** 4 stat tiles, 30/60/90 forecast, rep performance
- 🔐 **Admin & Security:** RBAC, audit log
- 🤝 **Collaboration Layer** (the differentiator, see below)

---

## 🤝 Collaboration Layer (Hero Feature)

| # | Feature | Lives in | Phase | Priority |
|---|---|---|---|---|
| 1 | **Customer 360 page**: merged timeline of deals, tickets, tasks, comments | Module 3 | 4 | P0 |
| 2 | **Internal comments + @mentions** (`activities.is_internal = true`) | Module 3 | 4 (UI), 7 (live) | P0 |
| 3 | **Cross-team alert banner** (e.g., "Open high-priority ticket" on Deal page; "Active deals worth ₹X" on Ticket page) | Deal, Ticket, 360 pages | 7 | P0 |
| 4 | **Deal Won → auto handoff** (seeded workflow creating onboarding tasks per purchased module) | Module 6 | 6 | P0 |
| 5 | **Live presence** ("Priya (Support) is viewing"), in-memory | Real-time layer | 7 | P0 |
| 6 | **Follow / Watch** records | `watchers` | Stretch | P2 |
| 7 | **AI summary** on Customer 360 / ticket reply draft | Module 3 / 5 | Buffer | P1 (first item) |

---

## 🧱 Module Scope (P0 = must, P1 = after P0, in the order listed in the P1 Queue, P2 = last / may never happen)

**Module 1: Core Data Hub**
- P0: Leads, Contacts, Accounts, Deals CRUD (generic reusable table + form), lead conversion (Lead → Account + Contact + Deal). The 4 Empulz fields (company size, current HR tool, interested modules, HR contact designation) are normal form fields stored in `custom_fields JSONB`, typed by a shared Zod schema.
- P2: Tags, CSV import, duplicate detection, custom-field admin UI

**Module 2: Sales Pipeline**
- P0: Kanban drag-drop, deal value, weighted revenue, stage probability, Products catalog, Quote builder (employees × selected modules → monthly + annual ₹ total, saved as a QUOTE document)
- P1: GST line (18%) on quote, print-to-PDF (print stylesheet)
- P2: Quote → Invoice, stage config UI, multiple pipelines

**Module 3: Activities & Communication**
- P0: Note, call and meeting log (same form, `type` differs), unified timeline, internal comments + @mentions
- P1: Send email via Resend (logged to timeline), AI summary
- P2: Attachments, call duration / meeting start-end fields, meeting calendar view, "Add to Google Calendar", Gmail/Outlook sync

**Module 4: Tasks**
- P0: Create/assign, due date, priority, My Tasks queue
- P1: In-app reminders and `task.overdue` (in-process scheduler)
- P2: Browser push notifications

**Module 5: Support Helpdesk**
- P0: Tickets, status flow, priority, SLA timer + breach (via in-process scheduler), replies
- P1: AI reply draft
- P2: Knowledge Base, email-to-ticket

**Module 6: Automation Engine**
- P0: Trigger → Conditions → Actions engine, run history, active/inactive toggle. **No create/edit UI**: workflows are seeded and shown read-only.
  - Triggers (P0): `lead.created`, `deal.won`, `ticket.sla_breached`
  - Actions (P0): `assign_user`, `create_task` (supports `forEach` over the deal's purchased modules), `notify`
  - Triggers (P1): `ticket.created`, `deal.stage_changed`, `task.overdue`
  - Actions (P1): `send_email`, `update_field`, `create_ticket`
- Seeded workflows: (1) Deal Won → Handoff, (2) Waitlist lead → Auto-assign by company size, (3) SLA breach → Escalate (`notify` + `assign_user` to manager)
- P2: Workflow builder UI, React Flow (`@xyflow/react`) read-only visual view

**Module 7: Analytics (lite)**
- P0: Revenue this month (₹), conversion rate, avg deal size, open tickets / SLA breaches (4 stat tiles); forecast 30/60/90 (`amount × probability`, no ML); rep performance table
- P1: Generic CSV export
- P2: Date filters, Excel export

**Module 8: Admin & Security**
- P0: RBAC, audit log (before/after JSON) with a simple viewer for Admin
- P2: Custom-field definition UI, Users/Teams management UI

**Extra P0 add-ons (Empulz-specific):**
- Public **Join Waitlist** web-to-lead form (styled like Empulz's site) with Zod validation, honeypot field, rate limit and consent checkbox
- **Account Pulse** health score shown as 🟢🟡🔴 (formula below)
- **Cmd+K** global search ("lite": Accounts, Contacts, Deals, Leads; shadcn Command + pg_trgm)
- **Socket.io** real-time (notifications, presence, live comments)
- Empulz-style theme/branding (ECG animation on login only)

**Account Pulse formula (proposed, tune during build):**
- Start at 100
- −15 per open ticket (cap −45); extra −15 if any open ticket is High/Urgent
- Days since last activity: >30 days → −25; 15–30 days → −10
- Colors: 🟢 ≥ 70, 🟡 40–69, 🔴 < 40. For high-value accounts (open deal ≥ ₹10,00,000) thresholds shift +10 (more sensitive)
- The "↑12% trend" pill is cosmetic/seeded in P0

---

## ✂️ Scope Changes (v2)

| Item | v1 | v2 | Why |
|---|---|---|---|
| Redis + BullMQ | P0 infra (reminders, SLA, workflow delays, email) | **Removed from P0.** In-process scheduler (DB sweep every ~15s) | One less service to run/deploy/pay for; SLA state lives in Postgres anyway. BullMQ+Redis swap is P2 |
| Resend email | P0 | **P1** | Not in the demo path; free plan only delivers to own email |
| Attachments | P0 | **P2** | Not in demo |
| Custom-field definition table + UI | P0 | **P2** (fields hardcoded in forms, stored in JSONB) | Heavy, low demo value |
| Task reminders | P0 | **P1** | Needs scheduler work beyond SLA |
| Workflow triggers/actions | 5 triggers, 6 actions | **3 triggers, 3 actions** (+ the rest as P1) | Covers all 3 seeded workflows |
| Workflow create/edit UI | implied | **P2** | Seeded + read-only + toggle is enough |
| React Flow view | P1 | **P2** | Stretch, last |
| Knowledge Base | P1 | **P2** (tables removed) | Not in demo |
| Follow/Watch | P1 | **P2** (table removed) | Stretch |
| Meeting calendar, call duration fields | P1 | **P2** | Meeting/call kept as simple log types |
| CSV export | P1 | **P1** (kept) | Quick generic endpoint |
| Analytics | 6 metrics + ticket stats | **4 tiles + forecast + rep table** | Trimmed |
| Pipelines table | table | **removed** (single pipeline via `pipeline_stages`) | Multi-pipeline was P2 anyway |
| Redis presence | implied | **in-memory** | Single API instance |
| AI assistant | "last, only if time" | **First P1 item**, small and scoped | Empulz markets Pulse AI; a CRM demo with zero AI looks dated |
| Deploy | Phase 10 (1h, Vercel + Railway/Render + Neon + Upstash) | **Optional P1**; demo from localhost | Free tiers sleep, cookies cross-site, Upstash+BullMQ costly |
| Demo | 8 steps | **6 beats** | ~1 minute per beat |
| Estimated P0 effort | ~22.5h (no buffer) | **~19h + ~5h buffer** | Realistic |

---

## 🏷️ Empulz-Specific Customization

**Pipeline stages:** `Waitlist (10%) → Demo Scheduled (25%) → Pilot / Proposal (50%) → Negotiation (75%) → Closed Won (100%) / Closed Lost (0%)`

**Lead sources:** Waitlist, LinkedIn, Referral, Event

**Lead/Account fields (stored in `custom_fields`):** company size (employees), current HR tool, interested modules, HR contact designation

**Products (DUMMY prices, ₹ per employee per month):**

| Module | ₹/emp/month |
|---|---|
| HR Operations | 40 |
| Attendance | 30 |
| Payroll | 50 |
| Employee Benefits Hub | 45 |
| Wellness Hub | 35 |
| LifeAssist | 25 |
| Rewards & Recognition | 30 |
| Growth OS | 35 |
| Performance | 40 |
| Reports & Analytics | 20 |

**Deal value formula:** `employees × Σ(selected module prices) × 12` (pre-GST). GST 18% line on quotes is P1.

**Deal Won handoff:** one onboarding task auto-created per purchased module (e.g., "Payroll setup", "Attendance geo-fence configuration"), assigned to Customer Success / Support, with an instant notification.

**Ticket examples:** "Payroll sync failing", "Attendance geo-fence not working".

**SLA (first-response targets):** Urgent 1h, High 4h, Medium 8h, Low 24h.
**In `DEMO_MODE`:** compressed for the live demo, Urgent = 2 min, High = 5 min, Medium = 8 min, Low = 24 min, so breach + escalation can be shown live.

---

## 🔐 RBAC Matrix (Final)

| | Admin | Manager | Sales Rep | Support Agent |
|---|---|---|---|---|
| Leads | All | Team's | Own only | ❌ |
| Accounts / Contacts | All | All | Read all, edit own | Read all, no edit |
| Deals | All | Team's | Edit own, read others | Read-only (context) |
| Tickets | All | Team's | Read-only | Edit own + team's |
| Tasks | All | Team's | Own / assigned to me | Own / assigned to me |
| Internal comments | All | Team's | Where parent record is readable | Where parent record is readable (so not on Leads) |
| Settings / Workflows / Audit | ✅ | View only | ❌ | ❌ |

**Roles:** `ADMIN`, `MANAGER`, `SALES_REP`, `SUPPORT_AGENT`.
**Departments:** `SALES`, `CUSTOMER_SUCCESS`, `SUPPORT`.
- **Customer Success has no separate role.** CS users are `SUPPORT_AGENT` (or `MANAGER` for the CS lead) with `department = CUSTOMER_SUCCESS`. Department decides which queue gets work (e.g., onboarding tasks go to CS); role decides permissions.
- **Teams** are reporting groups inside one department. A Manager's "Team's" scope = records owned by users with the same `team_id`.
- **Enforcement:** one central `scopeFor(user, entity)` helper returns the Prisma `where` filter for list/read queries. Route guards alone are not enough.

**Demo users (seeded):** Admin, Manager, Rahul (Sales), Priya (Support), one CS user, plus a few extra reps/agents for realistic rep-performance data.

---

## 🎨 UI & Branding (Locked, mirrors Empulz's website)

- **Primary:** Orange `#EA580C`, used for buttons, highlights, active states (defined as tokens in Tailwind v4 `@theme`)
- **Secondary:** Soft purple/lavender for accents and backgrounds
- **Text:** Near-black navy; bold headings
- **Cards:** White, `rounded-2xl`, thin border, soft shadow
- **Stat tiles:** Pastel colors (green, pink, orange, blue)
- **Account Pulse card:** Dark glass card, big number, "↑12% trend" pill
- **Signature:** ECG heartbeat line SVG animation on login (P0); dashboard header (P1)
- **Fonts (visual guess):** Plus Jakarta Sans (headings), Inter (body), via Google Fonts
- **Dark mode:** Dropped (Empulz's site is light only)
- **Icons:** `lucide-react`
- **Login page:** 4 "Demo as Admin / Manager / Sales / Support" buttons + footer line *"Concept project built by Tauqeer Khan for Empulz"*

---

## 🛠️ Tech Stack (Locked, versions pinned in v2)

| Layer | Technology | Notes |
|---|---|---|
| Runtime | **Node.js 22 or 24 LTS** (`.nvmrc` + `engines`) | Node 20 is end-of-life; Next 16 needs ≥ 20.9, Prisma 7 needs ≥ 20.19 |
| Package manager | **pnpm workspaces** | `apps/web`, `apps/api`, `packages/shared` |
| Frontend | **Next.js 16** (App Router) + React 19 + TypeScript | Turbopack is default; `middleware.ts` is now **`proxy.ts`** |
| UI | **Tailwind CSS v4** + shadcn/ui | CSS-first config (no `tailwind.config.js`); shadcn `Command` powers Cmd+K |
| Data fetching / tables / forms | **TanStack Query**, **TanStack Table**, **react-hook-form + zod resolver** | Powers generic DataTable/Form; socket events invalidate Query cache |
| Drag & drop | `@hello-pangea/dnd` v18 | React 19 compatible; list-based Kanban fits |
| Charts | Recharts | |
| Backend | Node.js + **Express 5** + TypeScript | Separate service (needed for Socket.io + scheduler) |
| ORM | **Prisma 7** (not 8 RC) | `prisma-client` generator with required `output`, **driver adapter** (`@prisma/adapter-pg`), `prisma.config.ts` |
| Validation | **Zod 4** (shared package) | Same schemas used by web forms and API |
| API style | REST + Zod | GraphQL rejected (setup time) |
| Database | PostgreSQL | `pg_trgm` + full-text search (GIN index via **raw SQL migration**) |
| Scheduler | **In-process** (`setInterval` DB sweep ~15s) | SLA breach sweep (P0); task reminders (P1). BullMQ + Redis = P2 swap |
| Real-time | Socket.io | Notifications, presence (in-memory), live comments |
| Email | Resend (**P1**) | Without a verified domain, only delivers to your own account email (403 otherwise); free plan 3,000/mo, 100/day; add a send limiter (~2 req/s, verify) |
| AI (**P1**) | LLM API (provider TBD) | Summaries / reply drafts; rate-limited, labeled "AI-generated" |
| Auth | **Custom JWT** (bcrypt via `bcryptjs` + httpOnly cookie) | Clerk rejected: extra DB sync, no one-click role demo |
| Search | PostgreSQL FTS + pg_trgm | Algolia rejected |
| Workflow visual (P2) | `@xyflow/react` (formerly `reactflow`) | Read-only view |
| Local infra | Docker Compose (**Postgres only**) | |
| Deployment (**optional P1**) | Vercel (web) + **Railway Hobby** (API, always-on) + Neon (DB) | See Deployment notes |

### 🚫 Do NOT use (deprecated / outdated for this repo)
- `middleware.ts` → use `proxy.ts`, exported function `proxy`
- Prisma `prisma-client-js` generator, `import from "@prisma/client"`, or generating into `node_modules` → use `prisma-client` with explicit `output` + `@prisma/adapter-pg`
- `tailwind.config.js` → use Tailwind v4 CSS-first (`@theme`)
- `reactflow` package → `@xyflow/react`
- Express 4 patterns (manual `next(err)` in async handlers, unnamed `*` wildcard routes)
- BullMQ / Redis / Upstash in P0 (deferred to P2)
- Node 18/20

---

## 🔌 Connection & Auth Design

- **REST:** Next.js `rewrites` proxy `/api/*` → Express. The browser only talks to its own origin, so the httpOnly cookie (`SameSite=Lax`) stays first-party and CSRF exposure is low. Also verify `Origin` on mutating routes.
- **Socket.io:** does **not** rely on cookies (cross-site cookies are blocked by Safari and some browsers, so a cookie-based socket would work on localhost and break in production). Flow: client calls `GET /auth/socket-token` (short-lived JWT, ~60s) and connects with `auth: { token }`; server verifies it in the handshake and joins the user to rooms (`user:{id}`, `account:{id}`, `deal:{id}`).
- **Server CORS** for Socket.io: `origin = WEB_ORIGIN`, `credentials` only if needed.
- **Auth routes:** `POST /auth/login`, `/auth/logout`, `GET /auth/me`, `GET /auth/socket-token`, `POST /auth/demo` (guarded by `DEMO_MODE=true`). JWT payload: `{ userId, role, department, teamId }`. `authMiddleware` + `requireRole()` + `scopeFor()`.
- **Page protection:** check `/auth/me` in server layout, or use `proxy.ts` for simple redirects.

---

## 🏗️ Architecture

```
Browser (Next.js 16)
   │  REST (/api/* via rewrite, same-origin cookie)     WebSocket (Socket.io, short-lived token)
   ▼                                                          ▼
Express 5 API ──► Prisma 7 (adapter-pg) ──► PostgreSQL
   │   ├─ middleware: auth → rbac (scopeFor) → zod → audit
   │   ├─ workflow engine (trigger → conditions → actions)
   │   ├─ in-process scheduler (~15s DB sweep): SLA breach  [P1: task reminders]
   │   └─ emits domain events ──► workflow engine + Socket.io rooms
   │
   ├─ presence: in-memory map (single API instance)
   └─ [P1] Resend (allowlisted recipients) · [P1] LLM API (summaries)
```

**Key design rules**
1. **One unified `activities` table** (call, email, meeting, note, internal comment, system event). The timeline is one query.
2. **Every activity stores `account_id`**, so the Customer 360 timeline is one simple query.
3. **Nullable FKs** (`lead_id`, `contact_id`, `deal_id`, `ticket_id`) instead of polymorphic `type + id`, to keep integrity.
4. **Soft delete** (`deleted_at`) on the 4 core entities (leads, accounts, contacts, deals). Custom fields in `JSONB`. Tags: P2.
5. **All state changes emit domain events**, which the workflow engine and Socket.io both consume. Workflows only listen to the P0 triggers listed above.
6. **Scheduler state lives in Postgres** (e.g., `tickets.sla_due_at`, `sla_breached_at`), so a restart loses nothing.

---

## 🗄️ Database Schema (19 tables, down from ~25)

- **Identity:** `users` (role, department, team_id, password_hash), `teams`
- **Core:** `leads`, `accounts`, `contacts`, `deals`, `pipeline_stages` (probability, order_index), `deal_stage_history` (deal_id, from_stage, to_stage, changed_by, changed_at). Core 4 have `custom_fields JSONB` and `deleted_at`
- **Sales:** `products`, `documents` (type QUOTE; INVOICE is P2), `document_items`
- **Collaboration:** `activities` (type, body, is_internal, mentions[], account_id + nullable FKs), `notifications`
- **Tasks:** `tasks` (assignee, due_at, priority, status, related FKs)
- **Support:** `tickets` (priority, status, sla_due_at, `sla_breached_at`, first_response_at), `sla_policies`
- **Automation:** `workflows` (trigger, conditions JSONB, actions JSONB, is_active), `workflow_runs`
- **Admin:** `audit_logs` (entity, action, changes JSONB, user_id)

**Removed from v1 (now P2):** `pipelines`, `attachments`, `watchers`, `kb_categories`, `kb_articles`, `custom_field_defs`.

**Notes:** `pg_trgm` extension, GIN trigram indexes and any partial unique indexes (soft delete) go in raw SQL migrations, since Prisma can't model them.

---

## 📁 Project Structure (Planned)

```
flint/
├── apps/
│   ├── web/                       # Next.js 16
│   │   ├── app/(auth)/            # login, public waitlist form
│   │   ├── app/(app)/             # dashboard, leads, accounts, contacts,
│   │   │                          # deals, tickets, tasks, workflows, settings
│   │   ├── components/ui/         # shadcn
│   │   ├── components/            # data-table, kanban, timeline, command-menu
│   │   ├── proxy.ts               # (only if needed) request interception
│   │   └── lib/                   # api client, socket, format (₹ en-IN)
│   └── api/                       # Express 5 + TypeScript
│       ├── prisma/                # schema.prisma, migrations (incl. raw SQL), seed.ts
│       ├── prisma.config.ts       # Prisma 7 config
│       └── src/
│           ├── modules/           # leads, deals, tickets, workflows, ...
│           ├── middleware/        # auth, rbac (scopeFor), audit
│           ├── workflow/          # engine, triggers, actions
│           ├── scheduler/         # in-process sweeps (SLA breach, [P1] reminders)
│           ├── realtime/          # Socket.io, presence
│           └── index.ts
├── packages/
│   └── shared/                    # Zod schemas, types, constants (roles, stages, modules)
├── docker-compose.yml             # Postgres only
├── pnpm-workspace.yaml
├── .nvmrc
├── STATUS.md
└── README.md
```

---

## 🚀 Setup (Planned, to be finalized after Phase 0)

```bash
nvm use                               # Node 22/24 LTS
pnpm install
docker compose up -d                  # Postgres only
pnpm --filter api exec prisma migrate dev
pnpm --filter api db:seed             # run explicitly (check Prisma 7 seed config in prisma.config.ts)
pnpm dev                              # web + api
```

**Reset for demo:** `pnpm --filter api db:reset` = truncate all tables + reseed (the seed script must be idempotent / truncate first; `db seed` alone does not reset data).

**Env vars (API):** `DATABASE_URL`, `JWT_SECRET`, `DEMO_MODE`, `WEB_ORIGIN`; optional (P1): `RESEND_API_KEY`, `EMAIL_ALLOWLIST`, `AI_API_KEY`
**Env vars (Web):** `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SOCKET_URL`

---

## 🎛️ DEMO_MODE Behavior

- Enables `POST /auth/demo` one-click role login.
- Compresses SLA targets (Urgent 2 min, High 5 min).
- Restricts outgoing email recipients to `EMAIL_ALLOWLIST` (your own address / Resend test addresses) so a public demo can't be abused.
- Rate-limits AI endpoints.
- Seed contact emails are your own email or Resend test addresses.

---

## 🚧 Current Status & Build Progress

**Overall: 📝 PLANNING COMPLETE (v2, lean). Coding NOT started.**

**Timeline:** ~24 hours, single developer, built in vertical slices (DB → API → UI per module), so the app is demo-able after every phase. **P0 ≈ 19h, buffer ≈ 5h.**

| Phase | Hours | Scope | Status |
|---|---|---|---|
| 0. Setup | 0 – 1.5 | pnpm monorepo, Docker (Postgres), Prisma 7 schema + adapter, Express 5 skeleton, Next 16 + shadcn + Tailwind v4 + Empulz theme, `packages/shared` | ✅ |
| 1. Auth + RBAC | 1.5 – 3 | JWT login, role/department middleware, `scopeFor`, demo-login buttons, socket-token endpoint + socket handshake skeleton, app shell | ✅ |
| 2. Core Data Hub | 3 – 5.5 | Generic table/form, Leads/Accounts/Contacts CRUD, conversion, Empulz fields, audit hook | ✅ |
| 3. Sales Pipeline | 5.5 – 7.5 | Stages, Kanban, deals, `deal_stage_history`, products, quote builder | ✅ |
| 4. Activities + Customer 360 | 7.5 – 9.5 | Unified timeline, note/call/meeting log, internal comments + @mentions | ✅ |
| 5. Tasks + Tickets | 9.5 – 11.5 | Tasks, My Tasks, tickets, SLA + in-process scheduler, replies | ✅ |
| 6. Workflow Engine | 11.5 – 13 | Engine, 3 triggers / 3 actions, run history, toggle, 3 seeded workflows | ✅ |
| 7. Real-time + Cmd+K + Alerts | 13 – 15.5 | Socket.io rooms, presence, live comments/notifications, cross-team banner, Cmd+K-lite | ✅ |
| 8. Analytics lite + Waitlist + Pulse | 15.5 – 17 | 4 tiles + forecast + rep table, public waitlist form (honeypot/rate-limit/consent), Account Pulse | ✅ |
| 9. Seed + Polish + Demo prep | 17 – 19 | Indian seed data, DEMO_MODE, empty/loading states, rehearsal, 2-min screen recording | ✅ |
| Buffer | 19 – 24 | Absorb slippage first; then work the P1 Queue below | ⬜ |

### P1 Queue (strict order, only after all P0 are done)
1. AI summary on Customer 360 + ticket reply draft (~1–1.5h)
2. Resend email (logged to timeline, allowlisted)
3. Generic CSV export
4. Quote: GST 18% line + print-to-PDF
5. Task reminders + `task.overdue` trigger
6. ECG animation on dashboard header
7. Extra triggers/actions (`ticket.created`, `deal.stage_changed`; `send_email`, `update_field`, `create_ticket`)
8. **Deploy (optional)**: see notes below

### P2 / Last (may never happen)
Custom-field definition UI · Attachments · Meeting calendar · Follow/Watch · Knowledge Base · Users/Teams UI · Workflow builder / `@xyflow/react` view · BullMQ + Redis swap · Tags · CSV import · Stage config UI · Date filters · Quote → Invoice · Duplicate detection · Multiple pipelines · Email-to-ticket · Gmail sync · Browser push

**Cut order if running late (P0 only):** Cmd+K-lite → Account Pulse trend pill → analytics forecast chart → quote builder polish → ECG animation. **Never cut:** Auth/RBAC, Data Hub + conversion, Kanban + Deal Won handoff, Customer 360 + cross-team banner, presence, workflow run history, SLA breach.

### Deployment notes (optional P1)
- **API must be always-on** (it holds Socket.io + the scheduler). Render free tier spins down after 15 min idle (cold start ≈ 30–60s, WebSocket idle counts too) and free Postgres expires, so avoid it for the API.
- Preferred: **Railway Hobby (~$5/mo)** for the API, **Neon** for Postgres (warm it up before demo), **Vercel** for web. **No Upstash** (not needed in v2).
- Socket auth uses a short-lived token, so cross-domain hosting works; same-site subdomains (`app.` / `api.`) are an optional extra.
- **Localhost stays the primary demo environment.** Keep the 2-min recording as backup.

### Log (update after every session)
- ✅ Planning v1: stack, scope, RBAC, schema, branding, demo script finalized
- ✅ Plan review v2 (20 Nov 2026): versions updated (Next 16, Prisma 7, Express 5, Zod 4, Tailwind v4, Node 22/24), socket auth + deploy approach fixed, BullMQ/Redis deferred, scope cut to lean P0, CS role + stage history + Account Pulse formula defined, AI moved to first P1 item
- ✅ Phase 0 (20 Nov 2026): Runnable pnpm monorepo setup complete. Next.js 16 (App Router, React 19, Tailwind v4, shadcn/ui, Empulz theme), Express 5 API with Prisma 7 (pg adapter), @flint/shared package, PostgreSQL 17 docker container, 17-table schema migrated + pg_trgm trigram indexes applied, idempotent reference seed, and /api rewrite proxy verified.
- ✅ Phase 1 (20 Nov 2026): Fixed pipeline stages to 6 per locked spec. Implemented Auth & RBAC in API (bcrypt, JWT, authMiddleware, exact RBAC matrix with scopeFor & canWrite, origin check, /auth/login, /auth/logout, /auth/me, /auth/socket-token, /auth/demo with DEMO_MODE guard, /users). Seeded 8 demo users across 2 teams. Created Socket.io server with handshake auth. Built Next.js App Shell with sidebar navigation, header with Live status indicator, ECG heartbeat SVG on login page, 1-click demo role login, and module placeholders.
- ✅ Phase 2 (20 Nov 2026): Module 1 (Core Data Hub) complete. Zod 4 schemas in @flint/shared for Empulz custom fields (companySize, currentHrTool, interestedModules, hrContactDesignation), Leads/Accounts/Contacts CRUD, and convertLeadSchema. Central logAudit utility capturing before/after changes. Express 5 routes for leads, accounts, and contacts with scopeFor/canWrite RBAC, soft-delete, and atomic lead conversion (Account + Contact + Deal in single Prisma transaction). Seeded 5 leads, 4 accounts, 6 contacts. Frontend: Reusable TanStack DataTable, Dialogs, Select, Checkbox, Textarea, and full CRUD pages for /leads (with 403 Access Denied banner for Support, and dynamic ACV quote calculator for conversion), /accounts, and /contacts.
- ✅ Phase 3 (20 Nov 2026): Module 2 (Sales Pipeline) complete. Added createDealSchema, updateDealSchema, changeDealStageSchema, and createQuoteSchema in @flint/shared. Built typed domain-event bus in src/lib/events.ts emitting deal.stage_changed, deal.won, deal.created, lead.created, lead.converted with Socket.io real-time bridge. Express 5 routes for deals, stage transitions with deal_stage_history tracking in single transactions, and quotes generator with server-authoritative catalog calculations. Seeded 9 realistic deals across all 6 stages, 4 stage history rows, and 2 official quotes. Frontend: Interactive Kanban board (@hello-pangea/dnd) across 6 stages with optimistic drag-and-drop, role-based permission gating (Support read-only, Sales Rep own cards, Manager team cards, Admin all), weighted revenue calculations, and /deals/[id] deal detail view with live quote builder and stage audit timeline.
- ✅ Phase 4 (20 Nov 2026): Module 3 (Activities, Customer 360, Internal Comments + @Mentions) complete. Added createActivitySchema in @flint/shared. Created Express 5 routes for activities and aggregated Customer 360 (/accounts/:id/360) with strict privacy boundary excluding lead-linked activities from Support Agents. Extended event bus with activity:created, emitting to account room and generating notifications with socket emission for @mentioned users. Automated SYSTEM activities for lead conversion, deal stage transitions, and deal won celebrations. Seeded 17 realistic activities across 4 accounts. Frontend: Reusable Timeline with type badges, relative time, and highlighted @mentions; ActivityComposer with live autocomplete @mention dropdown and internal comment toggle; Customer 360 hero page at /accounts/[id] with profile chips, composer, timeline, and summary cards; embedded activity stream into /deals/[id].
- ✅ Phase 5 (20 Nov 2026): Modules 4 & 5 (Tasks & Support Helpdesk) complete. Added task and ticket Zod schemas in @flint/shared (TASK_PRIORITIES, TASK_STATUSES, TICKET_STATUSES, createTaskSchema, updateTaskSchema, createTicketSchema, updateTicketSchema, replyTicketSchema). Created API sla.ts helper computing SLA resolution targets honoring DEMO_MODE compression (Urgent 2m, High 5m, Medium 8m, Low 24m). Express 5 routes for tasks (scoped /tasks, assignee-scoped /tasks/my with isOverdue) and tickets (scoped /tickets, /tickets/:id with activity thread, status & assignee updates). Built in-process scheduler sweeping every 15s for SLA breaches, auto-recording sla_breached_at, and emitting ticket.sla_breached domain event. Real-time Socket.io bridge for tickets:changed and tasks:changed. Seeded 8 tasks, 6 tickets with SLA targets (including 1 urgent ticket set to breach live in 3m), and 3 ticket replies. Frontend: /tasks page with My Tasks / All Tasks tabs, overdue indicator in red, inline status dropdown, and New Task modal; /tickets page with DataTable, status filter pills, live SLA countdown pill, and New Ticket modal; /tickets/[id] ticket detail view with SLA Compliance card, Timeline conversation thread, reply composer with internal note toggle, and RBAC-guarded status selector (disabled for Sales Reps).
- ✅ Phase 6 (20 Nov 2026): Module 6 (Automation Engine) complete. Added workflow trigger/action constants and workflowToggleSchema in @flint/shared. Built robust engine in src/modules/workflows/engine.ts evaluating conditions and sequentially executing actions (assign_user with size threshold and role targets, create_task supporting forEach over purchased quote products, notify creating DB notifications and Socket.io events). Subscribed engine to domain events (lead.created, deal.won, ticket.sla_breached). Express 5 routes for workflows (GET /workflows with recent run stats, PATCH /workflows/:id/toggle with audit logging, GET /workflows/runs, POST /workflows/:id/test). Seeded 3 core workflows (Waitlist Lead Routing, Deal Won CS Handoff, SLA Breach Manager Escalation) and 4 historical runs. Frontend: /workflows page displaying 3 workflow cards with trigger badges, condition criteria, action pipelines, active/inactive switch toggle, test run execution, and comprehensive execution run history table with modal inspection.
- ✅ Phase 7 (20 Nov 2026): Real-Time Layer, Cross-Team Alert Banners, Live Presence, In-App Notifications, and Cmd+K Global Search complete. Built in-memory presence tracking per room (`page:${pageType}:${pageId}`) with Socket.io (`presence:join`, `presence:leave`, disconnect cleanup) and live viewer deduplication. Implemented `/api/search` with PostgreSQL `pg_trgm` GIN indexes for typo-tolerant fuzzy matching across Accounts, Contacts, Deals, and Leads (enforcing RBAC by blanking leads for Support Agents). Built cross-team alert banner endpoints (`/api/deals/:id/alerts` flagging open High/Urgent tickets on deals with red warning, `/api/tickets/:id/alerts` flagging active deals in Negotiation/Proposal with purple highlight). Built `/api/notifications` system with unread counter, single read, and read-all actions. Frontend: `CommandMenu` modal with ⌘K / Ctrl+K listener, keyboard arrow navigation, and grouped results; `NotificationBell` with live unread badge, click-away popover, and socket real-time listener; `PresencePill` with pulsating live viewer badges on Deal, Ticket, and Customer 360 pages; and cross-team alert banners embedded on `/deals/[id]` and `/tickets/[id]`.
- ✅ Phase 8 (20 Nov 2026): Module 7 (Analytics Dashboard) + Public Waitlist Web-to-Lead Form + Account Pulse complete. Added `waitlistSchema` (honeypot, mandatory consent, custom fields) and response types (`AccountPulse`, `AnalyticsOverview`) to `@flint/shared`. Created Account Pulse calculation engine (`src/lib/pulse.ts`) implementing the exact Empulz specification (-15/open ticket capped at -45, -15 high/urgent penalty, -25/-10 recency decay, +10 high-value threshold shift). Integrated pulse into Customer 360 (`/accounts/[id]`) dark glass card and Accounts DataTable column. Built `GET /analytics/overview` with role-based scoping (`scopeFor`) returning Revenue This Month (₹), Lead Conversion %, Avg Deal Size (₹), Open Tickets & SLA Breaches, 30/60/90-day weighted pipeline forecast, and Rep Performance leaderboard. Built `POST /public/waitlist` with in-memory IP rate limiting (5 req/min), off-screen honeypot silent drop, and `lead.created` domain event emission triggering automated lead routing and owner notification. Replaced dashboard placeholder with Executive Dashboard featuring 4 pastel stat tiles, Recharts BarChart forecast, and rep performance table.
- ✅ Phase 9 (20 Nov 2026): Module 8 (Audit Log Viewer & System Settings) + Lifeline Database Reset + Demo Polish & Verification complete. Implemented `GET /audit-logs` in Express 5 with RBAC enforcement (ADMIN full access, MANAGER read-only, SALES_REP and SUPPORT_AGENT 403 Forbidden), entity and action filtering, pagination, and user metadata. Built `/settings` in Next.js 16 with role-guarded access (Access Restricted card for Sales Reps and Support Agents with link to dashboard; full Audit Viewer for Admins and Managers with timestamp, author, entity, color-coded action badges, entity ID, and side-by-side JSON diff dialog displaying before/after state snapshots). Verified one-command database reset (`pnpm db:reset`) idempotently restores 19 tables and pristine seed counts (5 leads, 4 accounts, 6 contacts, 9 deals, 6 tickets, 8 tasks, 3 workflows). Verified DEMO_MODE=true with compressed SLA timers (urgent attendance ticket breaching ~3m from reset). Created comprehensive automated demo walkthrough script (`scripts/demo-walkthrough.cjs`) asserting all 6 demo beats programmatically with 100% pass rate. All P0 modules complete and verified.
- ✅ Phase 9b (21 Nov 2026): Evidence Pass & Timezone Sanity. Verified pristine db:reset ticket SLA timestamp state (only urgent attendance ticket due in ~2.8m, all other seeded tickets have future SLA targets). Proved live in-process SLA sweep breach detection, domain event emission, and manager escalation to Meera Iyer with notification. Validated programmatic demo walkthrough across all 6 beats.
- ✅ Phase 9c (21 Nov 2026): Full UI Playwright Verification. Automated all 6 real demo beats through real Google Chrome via Playwright with 0 unhandled errors: (1) Waitlist form submission with automated routing, (2) Lead conversion to deal + dynamic quote calculation (₹62,500/mo, ₹7,50,000/yr, no GST), (3) Closed Won deal stage movement generating 3 CS onboarding tasks and notification for Kavya, (4) Cross-team live presence and instant red alert banner + bell notification with 16ms socket latency, (5) Live 2-min SLA breach with in-process sweep, manager escalation to Meera, and workflow run history, (6) Cmd+K typo search (Zomto -> Zomato), non-NaN dashboard analytics, and 403 RBAC card for Support on /leads.
- ✅ Phase 10 (21 Nov 2026): Repository Audit. Comprehensive read-only audit against README.md and STATUS.md. Verified locked stack versions, 19 database tables, RBAC matrix, and 6 demo beats. Identified findings: missing workflowsRouter.use(authMiddleware), workflows RBAC enforcement on runs/toggle/test, hardcoded currency symbol in deals.routes.ts, and socket handshake reconnection token handling.
- ✅ Phase 10b (21 Nov 2026): Fix-and-Prove, Hardening & Production Rehearsal. Fixed and proved all findings: (1) Added explicit `authMiddleware` and RBAC to `workflows.routes.ts` (ADMIN full, MANAGER read-only, SALES_REP/SUPPORT_AGENT 403) with UI Access Restricted card and navigation filtering; (2) Created canonical `formatINR` in `@flint/shared` and removed all hardcoded currency symbols; (3) Proved red cross-team banner on Customer 360 with Playwright; (4) Upgraded `socket.ts` to dynamic `auth: (cb)` token callback, proven via Playwright with Rahul receiving live @mention notification after 68s without page reload; (5) Confirmed 4 demo login button mappings and verified manual login for Kavya and Meera; (6) Production rehearsal: measured cold dev vs prod latency across 7 routes (showing up to 85% latency reduction in prod), passed `demo-walkthrough.cjs` and `verify-demo-ui.cjs` with 100% success in production mode (`next start` + `node apps/api/src/index.ts`); (7) Verified 12 pages in real browser with 0 console/page errors; pristine db:reset.

---

## ⚖️ Accepted Deviations

1. **No `proxy.ts`**: Next.js 16 App Router route protection and authentication are cleanly handled via server-side layout guards (`app/(app)/layout.tsx`) and Next.js rewrites (`/api/:path* -> http://localhost:4000/:path*`), avoiding unnecessary middleware complexity.
2. **Per-page Dialogs instead of Generic Form**: Lead conversion, quote creation, task creation, and ticket reply dialogs use purpose-built, highly-responsive Radix UI modal components tailored to domain requirements rather than an over-abstracted generic Form component.
3. **`DEMO_MODE` SLA Compression**: In `DEMO_MODE=true`, SLA resolution targets are compressed for live presentation: Urgent = 2 min, High = 5 min, Medium = 8 min, Low = 24 min (vs production targets: 1h, 4h, 8h, 24h), allowing real-time breach sweep and manager escalation to be demonstrated live in ~2 minutes.
4. **`next build --webpack`**: Web production builds explicitly use Next.js's stable webpack compiler flag (`next build --webpack`) for rock-solid monorepo bundling with `@flint/shared`.

---

## 🚀 Running the Demo

### Prerequisites
- Node.js >= 22
- pnpm >= 10
- Docker (for PostgreSQL)

### 1. Database Setup & Reset
```bash
docker compose up -d                  # Start PostgreSQL 17 container
pnpm db:reset                         # Idempotently seed 19 tables with demo data
```

### 2. Development Mode (Hot Reload)
```bash
pnpm dev                              # Runs API (:4000) and Web (:3000) concurrently
```

### 3. Production Mode (Optimized Rehearsal)
```bash
# Terminal 1: Build & Start API
pnpm --filter api build
DEMO_MODE=true PORT=4000 pnpm --filter api exec tsx src/index.ts

# Terminal 2: Build & Start Web
pnpm --filter web exec next build --webpack
pnpm --filter web start --port 3000
```

### 4. Automated Verification Passes
```bash
node scripts/demo-walkthrough.cjs     # Programmatic 6-beat API verification
node scripts/verify-demo-ui.cjs       # Full 6-beat real Chrome Playwright rehearsal
node scripts/verify-ui-pages.cjs      # 12-page visual & console error audit
```

> **Demo Notes:**
> - **Beat 4 Note:** In `DEMO_MODE=true`, the HIGH priority ticket created in Beat 4 breaches on its own after ~5 minutes, triggering an automatic in-process sweep escalation to Meera Iyer (Manager).
> - **CS Role Login:** Kavya Reddy (Customer Success / Support Agent) logs in manually via `kavya@flint.dev` / `flint123`. The 4 one-click buttons map to Admin (`admin@flint.dev`), Manager (`meera@flint.dev`), Sales (`rahul@flint.dev`), and Support (`priya@flint.dev`).

---

## 📌 Locked Decisions Log

| Decision | Choice | Reason |
|---|---|---|
| CRM type | Collaborative core + Operational base | Pure collaborative = Slack, not CRM |
| Project name | **Flint** | |
| Auth | Custom JWT | Separate Express backend, one-click demo roles, no third-party dependency |
| Socket auth (v2) | Short-lived token via `auth` handshake, no cookie | Cross-site cookies break in Safari/production |
| API | Express 5 + Prisma 7 + REST + Zod 4 | Dev knows Node; fastest setup; current majors |
| Scheduler (v2) | In-process DB sweep; BullMQ + Redis deferred to P2 | Less infra, state already in Postgres, single instance is enough for demo |
| Search | PostgreSQL pg_trgm | Typo-tolerant, no extra service |
| Email (v2) | Resend, **P1**, allowlisted recipients | 10-min setup; not in demo path; own-email-only limit on free plan |
| Currency | ₹ (en-IN) | Indian company |
| Pricing | Dummy everywhere | Real pricing unknown |
| Dark mode | Dropped | Empulz site is light |
| AI features (v2) | First P1 item, small scope | Empulz markets Pulse AI; keep scoped and labeled |
| Deployment (v2) | Optional P1; Railway Hobby + Neon + Vercel; demo from localhost | Free tiers sleep; Upstash + BullMQ costly; reliability first |
| Monorepo (v2) | pnpm workspaces + `packages/shared` (Zod) | Share schemas between forms and API |
| Scope (v2) | Lean P0 (~19h) + buffer | 24h is tight; heavy items moved to P1/P2 |
| Purpose | Demo for Empulz | Demo quality is the priority |

---

## 🤖 Rules for AI Agents Working on This Repo

1. **Read this file first.** Do not change locked decisions without asking the developer.
2. **Use the pinned versions** in the Tech Stack table and obey the **Do NOT use** list. If unsure about an API, check current docs instead of relying on memory.
3. **Build in vertical slices**, finishing one module end-to-end before the next. Keep the app runnable after every phase.
4. **Priority tags are binding.** Do not start P1/P2 items until all P0 items of the current and prior phases are done. P1 items follow the **P1 Queue order**.
5. **Reuse the generic DataTable + generic Form** for entity CRUD, driven by shared Zod schemas. Do not hand-build a table per entity.
6. **Every mutation** must pass through `auth → rbac (scopeFor) → zod validation → audit log → domain event`.
7. **Never hardcode currency symbols.** Use `formatINR()` from `lib/format` (`en-IN`).
8. **All demo/seed data is dummy** and must look realistic (Indian names, companies and cities). The seed must be idempotent.
9. **`/auth/demo` must be guarded by `DEMO_MODE`.** Outgoing email must respect `EMAIL_ALLOWLIST` in demo mode.
10. **Follow Empulz theme tokens** (orange `#EA580C`, lavender accents, `rounded-2xl` cards). Do not introduce new colors casually.
11. **Update the Progress table and Log** in this file at the end of every session.
12. Do not copy Empulz's branding assets or the "Pulse AI" name. Use "Account Pulse".
13. Do not add features outside this file without asking.

---

## 🎬 Demo Flow (6 beats, ~6 min)

1. **Waitlist form** submission → lead appears live on the Sales screen and is auto-assigned by a workflow.
2. **Convert lead** → Account + Contact + Deal, then **quote** for 500 employees (Payroll + Attendance + Benefits Hub) → total in ₹.
3. **Kanban**: drag the deal to Closed Won → handoff → onboarding tasks auto-created for CS/Support, with instant notification.
4. **Support (Priya)** opens Customer 360 (timeline, Account Pulse, presence), creates a high-priority ticket → **red cross-team banner** appears live on Rahul's deal page. @mention in internal comments triggers a live notification.
5. **Workflows page**: run history, plus the ticket SLA breach firing live (compressed SLA) → escalation.
6. **Cmd+K** typo-tolerant search, **analytics**, **RBAC** restriction as Support, **audit log** as Admin. (If P1 is done: AI summary on Customer 360, CSV export.)

**Close:** *"Built in ~24h with Next.js 16, Express, Prisma 7, PostgreSQL and Socket.io, applying Empulz's 'no silos' philosophy to the customer side."*

**Backup:** 2-minute screen recording + one-command reset (`pnpm --filter api db:reset`).

---

## ✅ Pre-Demo Verification Checklist

- [ ] Re-check Empulz site: waitlist count (100+ vs 85+), module list, launch status
- [ ] Confirm or drop the SOC 2 mention
- [x] README states it is not related to Xoxoday Empuls
- [x] `DEMO_MODE=true`, SLA compression working, seed reset tested (`pnpm db:reset`)
- [x] Socket token flow tested
- [x] All 6 demo beats programmatically verified (`scripts/demo-walkthrough.cjs`)
- [ ] 2-minute backup recording saved

---

## 👤 Author

**Tauqeer Khan**
- [GitHub](https://github.com/Tauqeer7Khan)
- [LinkedIn](https://www.linkedin.com/in/tauqeer7khan)

---

*Concept project for **Empulz**. Built with the belief that connected teams build connected customer experiences.*
