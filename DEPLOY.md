# 🚀 Flint Production Deployment Guide

This guide documents the production deployment architecture, environment configurations, operational procedures, and verification checklists for **Flint** (Collaborative CRM for Empulz).

---

## 🏗️ Architecture Diagram

```text
                                  ┌──────────────────────────────────────────────┐
                                  │            Browser / Client                  │
                                  └───────┬──────────────────────────────┬───────┘
                                          │                              │
                          1. HTTP (Same-Origin)            2. WebSocket (Direct)
                           /api/*, HTML, Assets                     /socket.io/*
                                          │                              │
                                          ▼                              │
┌────────────────────────────────────────────────────────┐               │
│                  Vercel (Web Service)                  │               │
│  • Root Dir: apps/web                                  │               │
│  • Next.js 16 (App Router + React 19)                  │               │
│  • Rewrites: /api/:path* ──(Server-to-Server Proxy)───┼──────────┐    │
│  • Evaluates API_URL at build time                     │          │    │
└────────────────────────────────────────────────────────┘          │    │
                                                                    ▼    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Railway (API Service)                           │
│  • Monorepo Root: / (pnpm --filter api start)                          │
│  • Express 5 + Socket.io Server (Always-On)                            │
│  • Trust Proxy = 1, Binds 0.0.0.0:$PORT                                │
│  • In-Process Scheduler (15s SLA sweep)                                │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                         3. Prisma 7 (pg adapter)
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         Neon (PostgreSQL 17)                           │
│  • Serverless PostgreSQL + pg_trgm extension                           │
│  • 19 Relational Tables + GIN trigram indexes                          │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🔐 Environment Variables by Service

### 1. Neon (PostgreSQL Database)
No custom environment variables. Provision a standard PostgreSQL 17 project and obtain the direct pooled connection string.

### 2. Railway (API Service)
Set in Railway Project Settings → Variables:

| Variable | Example Value | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://user:pass@ep-flint-xxx.us-east-2.aws.neon.tech/flint?sslmode=require` | Connection string to Neon PostgreSQL database. |
| `JWT_SECRET` | `generate-a-secure-random-string-64-chars` | Signing key for session JWT cookies and Socket.io handshake tokens. |
| `WEB_ORIGIN` | `https://flint.vercel.app` (or comma-separated) | Allowed web origins for CORS, origin-check middleware, and cookie secure flag. |
| `PORT` | `4000` | Railway automatically injects `PORT`; the API listens on `0.0.0.0:$PORT`. |
| `DEMO_MODE` | `true` | Enables compressed SLA timers (2m urgent, 5m high) and 1-click demo login buttons. |
| `NODE_ENV` | `production` | Enables Express `trust proxy` and production optimizations. |
| `ALLOW_REMOTE_RESET` | `0` | Default to `0`; set to `1` temporarily when running remote `db:reset`. |

### 3. Vercel (Web Service)
Set in Vercel Project Settings → Environment Variables:

| Variable | Example Value | Description |
|---|---|---|
| `API_URL` | `https://flint-api.up.railway.app` | **Required before build.** Next.js evaluates rewrites and server-component fetches using this URL. |
| `NEXT_PUBLIC_SOCKET_URL` | `https://flint-api.up.railway.app` | Public client endpoint for direct browser-to-Railway WebSocket connections. |
| `NODE_ENV` | `production` | Standard production mode. |

> [!IMPORTANT]
> **Build-Time Rewrites Note:** Next.js compiles `next.config.ts` rewrites at **BUILD TIME**. On Vercel, `API_URL` must be configured in environment variables *before* triggering the deployment build.

---

## ⚙️ Service Build, Start & Root Directory Settings

### Railway (Backend API)
- **Repository:** Monorepo root `/`
- **Install Command:** `pnpm install --frozen-lockfile`
- **Build Command:** `pnpm --filter api build` *(runs `prisma generate && tsc`)*
- **Start Command:** `pnpm --filter api start` *(runs `NODE_ENV=production tsx src/index.ts`)*
- **Health Check Path:** `/health`
- **Restart Policy:** Always on (critical for Socket.io connection state and in-process SLA scheduler)

### Vercel (Frontend Web)
- **Framework Preset:** Next.js
- **Root Directory:** `apps/web` (or monorepo root with project filtering)
- **Build Command:** `pnpm --filter web build` *(uses `next build --webpack`)*
- **Output Directory:** `.next`
- **Install Command:** `pnpm install`

---

## 📋 Order of Operations (Step-by-Step Deploy)

1. **Step 1: Provision Neon PostgreSQL**
   - Create a project on [Neon](https://neon.tech).
   - Copy the connection string (`postgresql://...sslmode=require`).

2. **Step 2: Run Database Migrations & Initial Seed**
   From your local developer terminal:
   ```bash
   ALLOW_REMOTE_RESET=1 DATABASE_URL="<neon-connection-string>" pnpm --filter api db:migrate:deploy
   ALLOW_REMOTE_RESET=1 DATABASE_URL="<neon-connection-string>" pnpm --filter api db:reset
   ```
   *This applies `pg_trgm`, creates all 19 tables, and seeds reference demo records.*

3. **Step 3: Deploy API Service to Railway**
   - Create a new project on [Railway](https://railway.app) from the GitHub repository.
   - Set the Root Directory to `/`.
   - Set Build Command: `pnpm --filter api build`.
   - Set Start Command: `pnpm --filter api start`.
   - Add environment variables: `DATABASE_URL`, `JWT_SECRET`, `DEMO_MODE=true`, `NODE_ENV=production`, and initial `WEB_ORIGIN=http://localhost:3000`.
   - Deploy and verify `/health` returns `{ "ok": true, "database": "healthy" }`.
   - Note the generated Railway public URL (e.g. `https://flint-api.up.railway.app`).

4. **Step 4: Deploy Web Service to Vercel**
   - Import the repository on [Vercel](https://vercel.com).
   - Set Root Directory to `apps/web`.
   - Add Environment Variables:
     - `API_URL=https://flint-api.up.railway.app`
     - `NEXT_PUBLIC_SOCKET_URL=https://flint-api.up.railway.app`
     - `NODE_ENV=production`
   - Trigger deployment. Note the generated Vercel domain (e.g. `https://flint.vercel.app`).

5. **Step 5: Bind Vercel Origin on Railway & Redeploy**
   - In Railway, update `WEB_ORIGIN` to your Vercel domain:
     ```env
     WEB_ORIGIN="https://flint.vercel.app"
     ```
     *(Or comma-separated if supporting localhost alongside production: `https://flint.vercel.app,http://localhost:3000`)*.
   - Railway will automatically redeploy the API with the updated allowed origin and enable cookie `secure=true`.

---

## 🔄 Resetting Demo Data on the Remote Database

Flint includes an automatic safety guard in `prisma/seed.ts` preventing accidental data destruction on remote databases. To reset a remote deployment to a pristine state:

```bash
ALLOW_REMOTE_RESET=1 DATABASE_URL="<neon-connection-string>" pnpm --filter api db:reset
```

Without `ALLOW_REMOTE_RESET=1`, any reset attempt against a non-localhost host will immediately abort without connecting.

---

## ⚡ Operational Notes & Known Behaviors

1. **`DEMO_MODE=true` Note:**
   - In `DEMO_MODE=true`, SLA resolution deadlines are compressed for live presentation: Urgent = 2 minutes, High = 5 minutes.
   - Enables 1-click demo role login buttons on `/login`.
   - Always ensure `DEMO_MODE=true` is set on Railway for live demonstration.

2. **Neon Serverless Cold-Start Warm-Up:**
   - Free/serverless Neon branches scale to zero after 5 minutes of inactivity.
   - The first query after idle can take ~1–2 seconds to wake the compute instance.
   - Before presenting the demo, open `/health` once in the browser to ensure the database compute is warm.

3. **Socket.io Cross-Domain Architecture:**
   - Next.js rewrites proxy HTTP traffic (`/api/*`), while Socket.io client connects **directly** to Railway (`NEXT_PUBLIC_SOCKET_URL`).
   - Authentication for WebSockets uses a dynamic JWT token exchange (`/api/auth/socket-token` → `{ token }` in handshake auth payload).
   - Because cookies are not used for WebSocket transport, cross-domain connection works reliably across distinct origins (Vercel + Railway) without third-party cookie restrictions.

---

## ✅ Post-Deploy Smoke Checklist

After completing deployment, verify each item in Google Chrome:

- [ ] **1. API Health Check:** Navigate to `https://flint-api.up.railway.app/health`. Response is `{ "ok": true, "database": "healthy" }` (HTTP 200).
- [ ] **2. 1-Click Demo Login:** On `https://flint.vercel.app/login`, click **Demo as Admin**. Redirects smoothly to `/dashboard`.
- [ ] **3. Role Switching:** Logout and test 1-click login for **Manager** (`Meera`), **Sales** (`Rahul`), and **Support** (`Priya`).
- [ ] **4. Public Waitlist Web-to-Lead:** Navigate to `/waitlist`. Submit a test lead company. Redirects to `/waitlist/thank-you` and lead appears on `/leads`.
- [ ] **5. Interactive Kanban Drag:** Open `/deals`. Drag deal card from **Negotiation** to **Closed Won**. Card settles, confetti triggers, and 3 onboarding tasks are generated.
- [ ] **6. Cross-Team Alert & Presence:** Open Reliance deal as Rahul. In a separate tab/window, open Customer 360 as Priya. Verify live presence badge appears in real-time. Create High ticket as Priya; verify instant red alert banner on Rahul's deal.
- [ ] **7. Live SLA Sweep Escalation:** Create Urgent ticket as Priya. Observe live SLA countdown. In ~2 minutes, verify scheduler auto-breaches ticket and assigns to Meera Iyer with notification.
- [ ] **8. Cmd+K Typo Search:** Press `Cmd+K`. Type `"Zomto"`. Typo-tolerant trigram search instantly displays `"Zomato"`.
- [ ] **9. Strict RBAC 403 Protection:** Log in as Priya (Support Agent). Navigate to `/leads`. Confirm friendly **Access Restricted** card displays without page crash.
- [ ] **10. Audit Log Diff Inspection:** Log in as Admin. Navigate to `/settings`. Click an audit log row to open the modal and inspect side-by-side JSON before/after state diffs.
