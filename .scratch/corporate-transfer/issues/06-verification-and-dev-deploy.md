# Verification and development deployment

Status: completed

Run targeted backend and frontend tests, cross-database-sensitive model tests, Go test/build, frontend typecheck/lint/build, deploy only to `dev.itokenify.com`, and verify the user and administrator flows without changing production.

## Answer

Local corporate model tests, 13 affected frontend tests, frontend typecheck, changed-file lint, production build and all-package compile-only checks pass. Full repository tests also pass for the changed model package; three pre-existing controller assertions remain unrelated failures. Deployed only to `dev.itokenify.com` with private persistent evidence storage, verified container health, all ten PostgreSQL tables, authenticated API boundaries, the store payment option, My Tickets route, collection configuration UI, and administrator review queue. Production was not changed.
