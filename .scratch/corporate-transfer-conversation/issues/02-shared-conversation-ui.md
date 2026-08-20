# Build the shared conversation and drawer UI

Status: completed

Build the reusable conversation surface shared by shopper tickets, the direct ticket route, and the administrator review workspace.

It must provide viewer-relative message alignment, localized participant labels, sender timestamps, authenticated image previews, loading/empty/error states, an independently scrolling message region, and a persistent bottom action area. The shopper drawer uses a focused desktop width and a full-width mobile fallback; the administrator retains a wider review drawer.

## Acceptance Criteria

- Shopper and administrator views reuse one message renderer.
- Shopper messages render as “我”; the counterparty renders as “客服”; system messages render as “系统”.
- Raw sender-role identifiers never appear in the UI.
- The shopper drawer is approximately 560–640 pixels on desktop and full width on mobile.
- The administrator drawer remains wide enough for existing Receipt Verification controls.
- The direct route reuses the same conversation module.
- Focus, keyboard operation, scrolling, loading, empty, and failure behavior have page-level regression tests.

## Comments
