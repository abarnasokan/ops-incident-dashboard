# Verification

## API checks

The PostgreSQL integration suite covers repeatable migrations/seeding, readiness, JWT validation, password hashing, signup/login, validation, parameterized search, ownership, concurrent edit conflicts, status transitions, resolution timestamps, comment identity, archive history, metrics, actual query duration, disabled failure injection, and summary evidence validation.

Run `npm test` after creating the dedicated test database described in the README. CI also builds React and checks formatting. Tests add synthetic records to a database ending in `_test`; the demo database stays separate.

## Browser and observability

`scripts/browser_smoke.py` signs into the Docker demo, creates/assigns an incident, records a status change and note, captures HTTP failure and slow query, generates a summary, confirms the trace arrives through the Collector in Jaeger, resolves the incident, checks search, and tests mobile overflow and JavaScript errors. Screenshots go to `docs/images`.

The slow query really executes PostgreSQL `pg_sleep(0.3)`; the HTTP failure deliberately returns 500. These are local observations, not production incidents. Jaeger's in-memory traces disappear when its container restarts.

## Limits

Live Claude calls are not verified without an API key/model. Structural checks reject unsupported evidence IDs but cannot prove a model's hypothesis correct. Local summaries default to rules. Hosted deployment, legacy database upgrades, multi-tenant authorization, load testing, production log ingestion, and pgvector retrieval remain outside this MVP.
