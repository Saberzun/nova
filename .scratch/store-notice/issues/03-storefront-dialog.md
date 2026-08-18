# Store Notice storefront dialog

Status: resolved
Blocked by: 01

Add the store header action, revision-aware automatic dialog, account-wide dismissal, payment-return suppression, responsive layout, and failure behavior described by `../spec.md`.

## Comments

- 2026-08-18 follow-up: removed the notice-specific fixed/full-height constraints. Short notices now size to their content, while the shared dialog maximum height keeps long content scrollable and the footer visible. Verified on dev at 1280×720 and 800×360.

## Answer

Added the storefront header action and revision-aware dialog. Normal visits auto-open the latest revision; payment return visits do not. “我知道了” closes only the current display, while “不再弹出” persists for the signed-in account and revision across devices. A newly published revision appears again, manual viewing remains available, and notice API failures do not block the store.
