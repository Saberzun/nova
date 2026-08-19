# Corporate Transfer MVP

Status: ready-for-agent

## Goal

Add `对公转账` to the unified product store for subscription SKUs and custom recharge orders. An application creates a product order and a linked ticket, presents the published Enterprise WeChat and corporate-bank collection details, accepts private image evidence, and allows an administrator to settle the order only after recording unique receipt data from the real collection account.

## Invariants

- `ProductOrder` remains the commercial and fulfillment record.
- A one-to-one transfer application owns review state; a ticket owns instructions, evidence, and communication only.
- Ticket replies, closure, and reopening never settle or reverse payment.
- Creation is idempotent per user and idempotency key and atomically creates the order, application, and ticket.
- The order locks product, quota, pricing, gift discount, cash payable, and collection configuration snapshots.
- Users upload images only; they do not declare channel, amount, payer, time, or transaction reference.
- Each active receipt entry records a real channel, amount, receipt time, and globally unique channel/reference pair.
- Approval requires active receipts to total exactly the cash payable amount and is idempotent with entitlement fulfillment.
- Corporate-transfer orders cannot use the generic manual-completion path.
- Expiry, cancellation, and rejection release reserved gift and inventory; a terminated application is never reopened.

## Lifecycle

`awaiting_evidence -> under_review -> needs_more_information -> under_review -> approved -> fulfilled`

Terminal alternatives: `cancelled`, `expired`, `rejected`.

An awaiting-evidence application expires after 24 hours. Once evidence is submitted, it remains open for administrator review. A rejected, cancelled, or expired application requires a new order.

## Evidence

- JPEG, PNG, or WebP after content-signature validation.
- 5 MiB per file, 5 files per submission, 10 files per ticket.
- Original file stored in a private persistent volume and displayed inline at constrained dimensions with click-to-expand.
- Every read is authorized; no static or permanent public URL.
- Submitted messages and attachments are immutable and retained for two years.

## Collection configuration

- Exactly two channel types: Enterprise WeChat and corporate bank.
- At most one published current target per channel; at least one enabled target is required to create an application.
- Administrators edit a draft and explicitly publish a revision.
- Applications keep immutable channel snapshots and are never silently updated.

## User experience

- The store payment selector offers `对公转账` for fixed subscription SKUs and custom recharge.
- Creation redirects to the automatically created ticket, where both enabled channel snapshots are shown.
- The user uploads at least one image to submit for review and may append evidence when more information is requested.
- My Orders exposes review status and links to My Tickets; My Tickets has persistent unread counts.

## Administrator experience

- A dedicated transfer-review workspace lists applications and receipt records.
- An administrator may reply, request more information, reject, add/void receipt records, and approve after a destructive-action confirmation summary.
- Administrators cannot approve their own orders.
- Receipt records are voided with a reason, never overwritten or deleted; approved records are immutable.
- Refund registration records a completed offline refund and never initiates an external refund.

## Scope exclusions

- General user-created support tickets.
- Separate customer-service role.
- OCR or automated collection-account reconciliation.
- Mixed-channel payment for one order.
- Automatic bank or Enterprise WeChat refunds.
- Invoice, tax-profile, contract, and dual-approval workflows.
