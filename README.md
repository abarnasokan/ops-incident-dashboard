# Ops Incident Dashboard

An AI-augmented incident response platform, built to shorten the time between "something's wrong" and "here's a working hypothesis" for on-call engineers.

## The Problem

When something breaks in production, the person on call spends most of their time not fixing the issue, but figuring out *what's happening and why* — jumping between dashboards, log search, a tracing tool, and Slack history to piece together context by hand. That triage time is where incidents get expensive: longer time-to-resolution, more customer impact, and on-call burnout from constant context-switching under pressure.

This project automates the first pass of that triage: it captures real telemetry (via OpenTelemetry) and uses an AI layer to read that trace/log data and produce a structured first hypothesis — likely cause, severity, and (via similar-incident retrieval) whether this looks like a past incident with a known fix. It's designed to accelerate the human, not replace them — every AI output shows what it reasoned from, so it stays auditable.

## Tech Stack

- **Backend:** Node.js, Express, PostgreSQL
- **Observability:** OpenTelemetry (traces + logs), Jaeger
- **AI:** Claude API (incident summarization, root-cause hypothesis)
- **Retrieval:** pgvector (similar past incidents)
- **Frontend:** lightweight dashboard (React or plain JS)
- **Infra:** Docker / docker-compose
- **CI:** GitHub Actions (tests on push)

## Current Status

- [x] Incident CRUD API
- [x] User management
- [x] PostgreSQL persistence + schema (users, incidents, comments, status_history)
- [x] Input validation
- [ ] Everything below — in progress, see roadmap

## Roadmap

### Week 1 — Foundation + observability from day one
- [ ] JWT auth (login/signup, protect incident routes)
- [ ] `docker-compose.yml`: API + Postgres + OTel Collector + Jaeger
- [ ] Add `@opentelemetry/auto-instrumentations-node` — auto-instrument Express routes + `pg` queries
- [ ] Seed script with realistic fake incidents (varied services, severities, timestamps)
- [ ] Jest + supertest tests for incident endpoints
- [ ] GitHub Actions CI running tests on push

### Week 2 — Minimal frontend + telemetry-aware AI feature
- [ ] Simple dashboard: list incidents, view detail, update status
- [ ] Trigger real failure scenarios against the API (slow query, forced 500, timeout) to generate real traces/logs
- [ ] AI summary endpoint: pulls trace/span + recent error logs for an incident, calls Claude API, returns structured summary + likely root cause + severity

### Week 3 — Similar-incident retrieval (RAG) — *cut first if time is short*
- [ ] Add pgvector, generate embeddings for past incidents
- [ ] "Find similar past incidents" endpoint, referenced by the AI summary
- [ ] *(stretch)* `runbooks/` markdown folder the AI can search and cite

### Final polish — deploy + tell the story
- [ ] Deploy API + DB (Render/Railway), frontend (Vercel)
- [ ] Architecture diagram in README (request → OTel Collector → Jaeger → AI summary)
- [ ] Screenshot/GIF of the full flow: trigger failure → trace in Jaeger → AI summary
- [ ] Repo description + topics set on GitHub
- [ ] 60-second walkthrough written out for interviews

## Design Principles

- **Show the reasoning, not just the verdict.** AI output always includes the trace/log snippet it's based on.
- **Hypothesis, not resolution.** Language stays first-hypothesis-for-a-human, never "auto-resolved."
- **Real telemetry over fabricated data.** Failure scenarios are triggered against the real API and captured with OpenTelemetry, not hand-written fake logs.

## Future Enhancements

- Slack integration for incident updates
- Jira ticket generation
- Multi-service failure simulation (beyond the single API)
- Metrics dashboards (Prometheus/Grafana)

## API Endpoints

### Incidents
```
GET  /api/incidents
POST /api/incidents
PUT  /api/incidents/:id
```

### Users
```
GET  /api/users
POST /api/users
```

## Database Schema
```
users
incidents
comments
status_history
```
