# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tulip is a multi-tenant SaaS platform for NGO financial transparency. It provides immutable audit trails anchored to the Polygon blockchain, RFC 3161 timestamping, document management with S3, and GDPR compliance tools. The system targets donors and NGOs who need verifiable proof of fund usage.

## Architecture

**Monorepo with two independent apps** (no workspace manager — each has its own `node_modules`):

- **`backend/`** — Express 5 API server (CommonJS, port 5050)
- **`frontend/`** — Next.js 16 app (TypeScript, port 3000)

### Backend (Express + Prisma + Polygon)

- **`app.js`** — Entry point. Mounts all routes with middleware chains (rate limiting → auth → tenant scope → route).
- **`prisma/schema.prisma`** — Single schema, all models scoped by `tenantId`. Key models: Tenant, User, Role, Permission, Project, FundingSource, Expense, Document, AuditLog, Webhook, ApiKey.
- **`lib/tenantClient.js`** — Wraps Prisma with automatic tenant filtering. All DB operations in routes/services go through `tenantClient(req.user.tenantId)`.
- **`middleware/`** — `authenticate.js` (dual auth: JWT Bearer + API Key `tl_live_*`), `tenantScope.js` (extracts tenantId from JWT), `permission.js` (RBAC via `can()`, `canAny()`, `canAll()`).
- **`services/`** — Core business logic:
  - `auditService.js` — Creates SHA-256 hashed audit log entries, fires webhooks
  - `batchAnchorService.js` — Batches ≤20 audit logs → Merkle root → Polygon tx → S3 archive
  - `timestampService.js` — RFC 3161 via FreeTSA (Apple fallback)
  - `webhookService.js` — HMAC-SHA256 signed delivery with 3-retry exponential backoff
  - `gdprService.js` — Data export, soft-delete/anonymize, consent logging
  - `anchorScheduler.js` — Cron: anchor every 5min, timestamp every 10min, cleanup daily 3am
- **`controllers/`** — Request handling, always uses `tenantClient(req.user.tenantId)` for DB access.
- **`lib/merkle.js`** — keccak256 Merkle tree construction and proof generation.
- **`lib/s3Upload.js`** — S3 upload, SHA-256 integrity, presigned URL generation.

### Frontend (Next.js 16 + Tailwind v4 + shadcn)

- **App Router** with mostly `'use client'` pages.
- **`src/lib/api.ts`** — `apiFetch()` wrapper that auto-injects Bearer token from localStorage, redirects to `/login` on 401.
- **Auth** — Custom JWT stored in localStorage (`tulip_token`, `tulip_refresh`, `tulip_user`). Not using next-auth despite it being in dependencies.
- **UI** — shadcn/ui (new-york style), Syne + DM Sans fonts, dark theme with tulip-gradient (#0c7aed → #004ea8).
- **Key pages**: `/dashboard` (overview stats), `/dashboard/projects`, `/dashboard/documents`, `/dashboard/expenses`, `/dashboard/audit`, `/verify` (public hash verification), `/donors` (NGO integrity scores).
- **Path alias**: `@/*` → `./src/*`

## Development Commands

```bash
# Backend
cd backend
npm install
npx prisma generate          # Generate Prisma client (required after schema changes)
npx prisma db push            # Push schema to database
npx prisma db seed            # Seed RBAC roles + test data
npm run dev                   # Start backend on port 5050

# Frontend
cd frontend
npm install
npm run dev                   # Start Next.js dev server on port 3000
npm run build                 # Production build
npm run lint                  # ESLint

# API docs available at http://localhost:5050/api/docs
```

## Environment Variables

- **`backend/.env`** — DATABASE_URL (PostgreSQL), JWT_SECRET, AWS credentials (S3), POLYGON_RPC_URL, POLYGON_PRIVATE_KEY, SIEM config
- **`frontend/.env.local`** — NEXT_PUBLIC_API_URL (default http://localhost:5050), NEXT_PUBLIC_APP_URL

## Key Patterns

- **Every DB query must be tenant-scoped** via `tenantClient(tenantId)` — never use the raw Prisma client for tenant data.
- **Permission middleware** uses string-based permissions like `projects:read`, `expenses:write`, `system:admin`. Applied via `can('projects:read')` in route definitions.
- **Audit logs are immutable** — they are SHA-256 hashed, Merkle-tree batched, and anchored to Polygon. Never delete or modify audit entries (GDPR erasure anonymizes the userId but preserves the record).
- **API keys** use Stripe-style format: `tl_live_` prefix + random bytes. The full key is shown once; only the bcrypt hash is stored.
- **The `/api/verify` route is public** (no auth) — it's the external verification endpoint for donors.

## Database Safety Rules

**NEVER drop, delete, or truncate any database tables or data under any circumstances.**
- Never use `prisma migrate reset`, `pg_restore --clean`, or any destructive database commands.
- If schema changes are needed, only use `prisma db push` to add new tables/columns.
- Always take a backup before any database operation.
- Never run `DROP TABLE`, `TRUNCATE`, `DELETE FROM` without an explicit WHERE clause, or any command that removes data in bulk.
