# Roadmap

## Completed local MVP

- [x] Validated incident/user APIs, JWT login/signup, password hashing
- [x] SQL migrations and isolated repeatable demo seed
- [x] Ownership, comments, status history, transactional activity audit
- [x] Optimistic concurrency and validated status transitions
- [x] React queue, filters, search, pagination, detail/edit flows, metrics
- [x] Docker Compose: API/UI, PostgreSQL, OTel Collector, Jaeger
- [x] HTTP/database instrumentation and real failure/slow-query scenarios
- [x] Evidence-linked rule summary; optional structured Claude integration
- [x] PostgreSQL integration tests and GitHub Actions
- [x] Browser/mobile checks, Jaeger verification, README screenshots

## Extensions

- [ ] Live Claude verification using account credentials
- [ ] Production telemetry ingestion and selected span/log retrieval
- [ ] pgvector embeddings and similar-incident retrieval
- [ ] Cited runbook search
- [ ] Scoped permissions, shared rate-limit storage, session revocation
- [ ] Persistent trace storage and metrics dashboards
- [ ] Hosted deployment with secrets management, backups, demo controls disabled
- [ ] Slack/Jira integrations and multi-service lab simulations

Current summaries describe deliberately injected lab failures. Similar-incident retrieval, production root-cause analysis, and automatic remediation are not implemented.
