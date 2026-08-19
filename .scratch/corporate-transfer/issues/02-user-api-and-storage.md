# User APIs and private evidence storage

Status: completed

Implement application creation, ticket list/detail/read/reply, evidence upload and authorized inline delivery. Enforce image signature, count and size limits, immutable evidence, ownership, and private-volume storage.

## Answer

Implemented authenticated application creation, ticket list/detail/read/reply, unread counts, cancellation and replacement-order linking. Evidence accepts original JPEG/PNG/WebP files only, enforces 5 MiB/file, 5/upload and 10/ticket, uses random private storage keys, checks ownership on reads, displays originals inline, and purges files after two years.
