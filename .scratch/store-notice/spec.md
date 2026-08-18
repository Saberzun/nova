# Store Notice

Status: ready-for-agent

## Goal

Add a store-wide purchasing and usage notice to the quota store, with Root-managed Markdown content, revision-aware automatic presentation, account-wide dismissal, and immutable publication evidence.

## Shopper experience

- Show a `查看商城须知` action in the store header after the first publication.
- Automatically open the current revision on normal store entry unless the account dismissed that revision.
- `我知道了` and the close icon close only the current presentation.
- `不再弹出` persists an account-wide dismissal for the current revision; manual reopening remains available.
- A later publication invalidates the practical effect of older dismissals because it has a new revision.
- Suppress automatic opening on `?pay=success` and `?pay=fail` return visits.
- Notice fetch failures must not block store browsing or purchasing.
- Dismissal write failures keep the dialog open and report the error.

## Administrator experience

- Root-only configuration under System Settings content settings.
- Fixed title `商城须知`; editable Markdown body only.
- Save draft, preview with the shopper renderer, and publish explicitly.
- Maximum 5,000 characters; non-empty body required for publication.
- After the first publication, no unpublish, disable, or clear-current operation exists.
- Every publication creates a monotonically increasing immutable revision, including small edits.
- Publishing rejects a stale base revision rather than overwriting another administrator's publication.
- The normal UI exposes only the current publication and current draft; no history or restore UI.

## Content safety

- Render sanitized Markdown without raw HTML, scripts, embedded media, or unsafe URL protocols.
- External links open in a new window with safe relationship attributes.
- MVP maintains one default body shared by every UI language.

## Audit and availability

- Retain immutable revision body, digest, publisher, and publication time in the database.
- Keep account/revision dismissal evidence in the database.
- Publication is transactional and supports SQLite, MySQL, and PostgreSQL.
- Store functionality fails open when the notice cannot be read.

## Layout

- Desktop dialog maximum width around 800px with independently scrolling content.
- Mobile dialog approaches full-screen height with visible footer actions.
