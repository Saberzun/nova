# Render payment and evidence business cards

Status: completed

Render the initial order-and-payment prompt and subsequent Payment Evidence and review-result summaries as controlled business cards inside the chronological conversation.

The payment prompt must show the immutable application snapshot, provide Enterprise WeChat and corporate-bank tabs when present, show authorized QR imagery, preserve bank-information line breaks, surface missing-channel warnings, and host the dedicated Payment Evidence action. Evidence summaries must identify the application/order, state, uploader, time, and authorized original-image previews.

## Acceptance Criteria

- The payment card uses the Transfer Application’s captured collection snapshot.
- Enterprise WeChat and corporate-bank tabs appear only for available captured channels.
- QR imagery loads through authenticated access and bank text preserves configured line breaks.
- Missing or malformed snapshot data produces a clear non-payable warning state.
- The dedicated evidence action is inside the payment card and is not represented by a bare file-input label.
- Submitted evidence renders as a structured summary distinct from ordinary chat images.
- Review results are projections of authoritative state, not free-form financial authority.
- Business-card selection and edge states have component tests.

## Comments
