# Verify and deploy the conversation experience to dev

Status: completed

Run the agreed behavior tests, quality checks, production build, and development-environment browser verification. Deploy only to dev.itokenify.com and leave the production environment unchanged until the user explicitly accepts the result.

## Acceptance Criteria

- Affected frontend component and page-level tests pass.
- Affected Corporate Transfer backend and API tests pass for all relevant behavior.
- Frontend type checking passes.
- Changed frontend files have no lint errors.
- The production frontend build succeeds.
- Affected Go packages pass their tests.
- Dev verification covers both collection channels, a missing-channel warning, formal Payment Evidence, ordinary image reply, shopper/admin chronology, close/reply/reopen, terminal application behavior, authenticated original images, unread updates, and mobile layout.
- Existing Corporate Transfer purchase, Receipt Verification, fulfillment, and replacement-order flows have no observed regression.
- No production deployment is performed by this issue.

## Comments
