# Store Notice backend domain and API

Status: resolved

Implement cross-database models, migrations, transactional publication, shopper read/dismiss endpoints, Root draft/publish endpoints, validation, concurrency protection, and behavioral tests described by `../spec.md`.

## Comments

## Answer

Implemented `store_notice_states`, immutable `store_notice_revisions`, and account/revision-scoped `store_notice_dismissals`, including automatic migration registration. Added shopper read/dismiss APIs and Root-only draft/read/publish APIs with Unicode-length validation, optimistic concurrency checks, transactional publication, and targeted model tests.
