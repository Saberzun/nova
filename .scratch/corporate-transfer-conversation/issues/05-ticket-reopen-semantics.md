# Implement safe reply-and-reopen semantics

Status: completed

Allow a reply to a closed Corporate Transfer ticket to reopen the ticket atomically, while strictly preventing ticket actions from mutating financial state.

A terminal Transfer Application remains terminal. Reopening its ticket permits communication only, and the UI continues to require a replacement order when the previous application is rejected, cancelled, or expired.

## Acceptance Criteria

- Replying to a closed eligible ticket records the reply and reopens the ticket in one transaction.
- A failed reply does not reopen the ticket.
- Closing, reopening, or replying does not settle, reject, cancel, revive, or fulfill a Transfer Application or Product Order.
- Rejected, cancelled, and expired applications remain terminal after ticket replies and state changes.
- Terminal application views continue to direct the shopper to create a new order.
- Unread state updates consistently after reply and reopen.
- Backend regression tests prove the ticket/financial-state separation required by ADR-0002.

## Comments
