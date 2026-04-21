# Failure Recovery Engine

**Self-Healing Workflow System** — an application-level resilience platform that detects failures in multi-step workflows and automatically applies recovery strategies (retries, fallbacks, compensation, escalation).

Built to demonstrate production-grade backend engineering patterns: clean architecture, queue-driven workers, recovery policy engines, audit trails, and dead-letter queues.

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Features](#-features)
- [Recovery Strategies](#-recovery-strategies)
- [Getting Started](#-getting-started)
- [Example Workflows](#-example-workflows)
- [API Reference](#-api-reference)
- [Project Structure](#-project-structure)

---

## 🎯 Overview

Distributed systems fail in messy ways: a payment gateway times out, an email service degrades, an external API returns 503. **Failure Recovery Engine** treats recovery as a first-class system concern. Workflows are declared as ordered steps, each attached to a **recovery policy**. When a step fails, the engine:

1. **Classifies** the failure (`TIMEOUT`, `NETWORK_ERROR`, `EXTERNAL_SERVICE_FAILURE`, `VALIDATION_ERROR`, `UNKNOWN`).
2. **Selects** a recovery strategy from the step's policy.
3. **Executes** the strategy (retry with backoff, switch to a fallback provider, skip, compensate, or escalate).
4. **Records** every action in an immutable audit log.

Jobs that exhaust their recovery options land in a **dead-letter queue** where operators can review and manually retry them from the admin dashboard.

---

## 🏗 Architecture

```
┌────────────────┐         ┌────────────────┐         ┌────────────────┐
│  Next.js UI    │ ──────▶ │  NestJS API    │ ──────▶ │   PostgreSQL   │
│  (Dashboard)   │  HTTP   │  (REST / v1)   │ Prisma  │  (jobs, logs)  │
└────────────────┘         └──────┬─────────┘         └────────────────┘
                                  │
                         enqueue  │  BullMQ
                                  ▼
                           ┌──────────────┐          ┌──────────────┐
                           │    Redis     │ ◀─────▶  │   Worker     │
                           │   (queues)   │  consume │  (NestJS)    │
                           └──────────────┘          └──────┬───────┘
                                                            │
                                          ┌─────────────────┼─────────────────┐
                                          ▼                 ▼                 ▼
                                   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
                                   │   Recovery   │  │    Audit     │  │ Dead-Letter  │
                                   │    Engine    │  │    Logger    │  │    Queue     │
                                   └──────────────┘  └──────────────┘  └──────────────┘
```

### Service Responsibilities

| Service     | Role                                                            |
|-------------|-----------------------------------------------------------------|
| **API**     | REST endpoints, workflow/job CRUD, admin actions, Swagger docs  |
| **Worker**  | Consumes BullMQ jobs, executes steps, invokes recovery engine   |
| **Redis**   | Queue + dead-letter backing store                               |
| **Postgres**| Source of truth for workflows, jobs, incidents, audit logs      |
| **Frontend**| Admin dashboard with real-time job/incident/service views       |

---

## 🛠 Tech Stack

### Backend
- **NestJS 10** — modular architecture, DI, validation
- **TypeScript** (strict mode)
- **Prisma 5** ORM + PostgreSQL 16
- **BullMQ 5** + Redis 7 for reliable job processing
- **Swagger** for API documentation
- **class-validator / class-transformer** for DTO validation
- **Helmet + compression + CORS**

### Frontend
- **Next.js 14** (App Router, RSC)
- **TanStack Query v5** for data fetching with auto-refresh
- **Tailwind CSS** with custom design system
- **Axios** HTTP client
- **lucide-react** icons

### DevOps
- **Docker** + **Docker Compose** — five-service orchestration
- **GitHub Actions** CI (lint, type-check, test, build)
- Environment-driven configuration

---

## ✨ Features

### Workflow System
- Declarative workflows with ordered, typed steps
- JSON config per step
- Critical vs. non-critical classification
- Per-step recovery policies

### Job Execution
- Lifecycle states: `PENDING → RUNNING → COMPLETED | FAILED | RETRYING | CANCELLED`
- Step-level tracking with attempt counters, error details, and result payloads
- Bull job ↔ DB job synchronization

### Failure Detection & Classification
- Automatic classification of exceptions by message/name
- Per-failure-type recovery routing

### Recovery Policy Engine
- Configurable strategies per step (see below)
- Exponential backoff with jitter (capped at 60s)
- Fallback provider routing
- Compensation across previously-completed steps
- Escalation for human review

### Queue System
- BullMQ-powered, Redis-backed
- Concurrent workers (default: 5)
- Dedicated dead-letter queue

### Audit Logging
Every action (`JOB_CREATED`, `STEP_FAILED`, `RECOVERY_STARTED`, `ESCALATED`, …) is logged with:
- Timestamp
- Structured metadata
- Job / step references

### Service Health Simulation
Toggle simulated services (`payment`, `email`, `inventory`, `invoice`, `crm`, `webhook`) between `HEALTHY`, `DEGRADED`, `DOWN` to observe how recovery logic responds.

### Dashboard
- **Dashboard** — stats, service health, recovery engine KPIs
- **Workflows** — view templates and policies
- **Jobs** — list + filter + submit new jobs
- **Job detail** — step timeline, recovery attempts, audit log
- **Incidents** — open/resolved/escalated failures
- **Dead Letter** — manual retry
- **Services** — simulate outages

---

## 🔁 Recovery Strategies

| Strategy            | Behavior                                                             |
|---------------------|----------------------------------------------------------------------|
| `RETRY`             | Re-execute the step immediately                                      |
| `RETRY_WITH_DELAY`  | Exponential backoff with jitter (capped at 60s)                      |
| `FALLBACK`          | Switch to alternative service (e.g., `stripe-backup`)                |
| `SKIP`              | Mark non-critical step as `SKIPPED`, continue workflow               |
| `COMPENSATE`        | Roll back previously-completed steps (saga-style)                    |
| `ESCALATE`          | Flag incident for manual review                                      |
| `DEAD_LETTER`       | Move exhausted job to DLQ for operator intervention                  |

Policies are configurable per workflow step with: `strategy`, `maxRetries`, `retryDelayMs`, `backoffMultiplier`, `fallbackService`, `timeoutMs`.

---

## 🚀 Getting Started

### Prerequisites
- Docker + Docker Compose, **or**
- Node.js 20+, PostgreSQL 16, Redis 7

### Option A — One-command setup (Docker)

```bash
# 1. Clone and configure
git clone <this-repo> && cd failure-recovery-engine
cp .env.example .env

# 2. Start everything
docker compose up -d

# 3. Run migrations + seed
docker compose exec backend npx prisma migrate dev --name init
docker compose exec backend npm run db:seed

# 4. Open the dashboard
open http://localhost:3000
```

Services:
- **Dashboard** → http://localhost:3000
- **API** → http://localhost:3001
- **Swagger** → http://localhost:3001/api/docs
- **Postgres** → `localhost:5432`
- **Redis** → `localhost:6379`

### Option B — Local development

```bash
# Postgres + Redis via Docker
docker compose up -d postgres redis

# Backend
cd backend
npm install
cp ../.env.example .env
npm run db:migrate
npm run db:seed
npm run start:dev       # API on :3001

# In a second terminal – start the worker
npm run start:worker:dev

# Frontend
cd ../frontend
npm install
npm run dev             # Dashboard on :3000
```

---

## 📦 Example Workflows

The seed script (`backend/prisma/seed.ts`) creates two ready-to-run workflows.

### 1. Order Processing

| # | Step                  | Critical | Strategy            | Config                                          |
|---|-----------------------|----------|---------------------|-------------------------------------------------|
| 1 | Reserve Inventory     | ✅       | `RETRY_WITH_DELAY`  | 2 retries, 500 ms base, ×2 backoff              |
| 2 | Process Payment       | ✅       | `FALLBACK`          | 3 retries → `stripe-backup`                     |
| 3 | Send Confirmation     | ⬜       | `RETRY_WITH_DELAY`  | 5 retries, skip if all fail (non-critical)      |
| 4 | Generate Invoice      | ✅       | `RETRY_WITH_DELAY`  | 3 retries, 1.5 s base                           |

### 2. Subscription Renewal

| # | Step              | Critical | Strategy            |
|---|-------------------|----------|---------------------|
| 1 | Charge Customer   | ✅       | `FALLBACK` → `paypal-backup` |
| 2 | Sync CRM          | ⬜       | `SKIP`                        |
| 3 | Notify Webhook    | ⬜       | `RETRY_WITH_DELAY`            |

**Simulate a failure scenario:**

1. Open **Service Health** → set `payment` to `DOWN`.
2. Open **Jobs** → click **Run "Order Processing"**.
3. Watch the job detail page: Step 2 fails → retries → falls back to `stripe-backup`.
4. Set `payment` back to `HEALTHY`, set `email` to `DEGRADED`.
5. Submit another job: Step 3 will retry but is non-critical — the workflow still completes.
6. Set *everything* to `DOWN`. Jobs land in the **Dead Letter Queue**; manually retry from the dashboard.

---

## 📡 API Reference

Full OpenAPI/Swagger at `http://localhost:3001/api/docs`.

### Key endpoints

| Method | Path                           | Description                                   |
|--------|--------------------------------|-----------------------------------------------|
| POST   | `/v1/workflows`                | Create a workflow                             |
| GET    | `/v1/workflows`                | List workflows                                |
| POST   | `/v1/jobs`                     | Submit a job for a workflow                   |
| GET    | `/v1/jobs`                     | List jobs (filter: `?status=FAILED`)          |
| GET    | `/v1/jobs/stats`               | Job statistics                                |
| GET    | `/v1/jobs/:id`                 | Job detail (steps, incidents, audit)          |
| PATCH  | `/v1/jobs/:id/cancel`          | Cancel job                                    |
| GET    | `/v1/incidents`                | List incidents                                |
| PATCH  | `/v1/incidents/:id/resolve`    | Resolve incident                              |
| GET    | `/v1/recovery/attempts`        | Recovery attempt history                      |
| GET    | `/v1/audit`                    | Audit logs                                    |
| GET    | `/v1/audit/job/:jobId`         | Audit trail for a job                         |
| GET    | `/v1/health`                   | Service health list                           |
| PATCH  | `/v1/health/:name`             | Update service status                         |
| GET    | `/v1/dlq`                      | Dead-letter queue                             |
| POST   | `/v1/dlq/:bullJobId/retry`     | Manual retry from DLQ                         |

---

## 📁 Project Structure

```
failure-recovery-engine/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma            # Complete DB schema
│   │   ├── seed.ts                  # Demo workflows + services
│   │   └── migrations/
│   ├── src/
│   │   ├── main.ts                  # API entrypoint
│   │   ├── worker.ts                # Worker entrypoint
│   │   ├── app.module.ts            # API composition
│   │   ├── worker.module.ts         # Worker composition
│   │   ├── common/
│   │   │   ├── config/
│   │   │   ├── filters/
│   │   │   └── interceptors/
│   │   ├── prisma/
│   │   └── modules/
│   │       ├── workflows/           # Workflow CRUD
│   │       ├── jobs/                # Job lifecycle
│   │       ├── queue/               # BullMQ wrapper
│   │       ├── workers/             # Worker execution logic
│   │       ├── recovery/            # Recovery engine (THE brain)
│   │       ├── incidents/           # Incident tracking
│   │       ├── audit/               # Audit logging
│   │       ├── service-health/      # Simulated service status
│   │       └── dead-letter/         # DLQ management
│   ├── Dockerfile
│   ├── Dockerfile.worker
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── app/                     # Next.js App Router pages
│   │   │   ├── page.tsx             # Dashboard
│   │   │   ├── workflows/
│   │   │   ├── jobs/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── incidents/
│   │   │   ├── dead-letter/
│   │   │   └── services/
│   │   ├── components/              # Shared UI
│   │   └── lib/                     # API client + types
│   ├── Dockerfile
│   └── package.json
├── .github/workflows/ci.yml
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 🧪 Testing

```bash
cd backend
npm test              # Unit tests (recovery utils, classifiers)
npm run lint
npm run type-check

cd frontend
npm run lint
npm run type-check
npm run build
```

---

## 🧩 Design Decisions

- **Separate worker process.** API and worker share the same codebase but are deployed as independent containers so they scale horizontally and failure is isolated.
- **Recovery logic is declarative.** Strategies live on the `RecoveryPolicy` record, not in step code — policies can change without redeploys.
- **Retries are in-engine, not BullMQ.** BullMQ handles queueing; our `RecoveryService` handles *what recovery means* per failure/step. This keeps the recovery logic observable and testable.
- **Compensation uses saga-style rollback.** When `COMPENSATE` is chosen, previously-completed steps are marked `COMPENSATED` — in a real system this would also enqueue inverse operations.
- **Audit log is append-only.** Every state change emits a log entry — the job detail page reconstructs the full history.

---

## 🗺 Roadmap (Bonus Features)

- [ ] Circuit breaker per external service
- [ ] Webhook notifications on escalation
- [ ] CSV export for audit logs
- [ ] Multi-tenant isolation (tenant-scoped tables)
- [ ] Feature flags module

---

## 📄 License

MIT
