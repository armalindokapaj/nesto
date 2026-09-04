# Nesto

Multi-tenant construction ERP, Project Operating System and controlled professional inter-company
network. Built to `docs/prd/Nesto_Master_Architecture_PRD_v1.0.md`.

## Layout

```
apps/company-web      Next.js — company, project, network and portal surfaces
apps/platform-admin   Next.js — control plane only, separate audience and session
apps/api              NestJS — the authoritative REST API, /api/v1
apps/worker           BullMQ workers — outbox relay, provisioning, lifecycle, files, search
packages/*            Technical primitives shared across apps and domains
domains/*             Bounded contexts: model, services, repositories, permissions, events
docs/                 PRD, engineering response, ADRs, registers, runbooks, threat models
```

## Getting started

```bash
pnpm install
pnpm infra:up          # Postgres, Redis, MinIO, Mailpit
cp .env.example .env
pnpm db:migrate
pnpm db:seed
pnpm dev
```

| Surface | URL |
|---|---|
| Company Web | http://localhost:3000 |
| Platform Admin | http://localhost:3001 |
| API | http://localhost:4000/api/v1 |
| OpenAPI | http://localhost:4000/api/docs |
| MinIO console | http://localhost:9001 |
| Mailpit | http://localhost:8025 |

## Before you write code

Read `AGENTS.md`. It is short, and every rule in it is load-bearing.
