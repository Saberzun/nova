# Corporate Transfer Conversation Experience

Status: completed

## Problem Statement

The Corporate Transfer workflow already creates a Product Order, Transfer Application, linked support ticket, collection-channel snapshot, Payment Evidence, and Receipt Verification records. However, the current user and administrator interfaces present order data, collection details, evidence upload, review information, and ticket replies as separate page cards. The user must infer the correct sequence, the evidence action is difficult to discover, and the ticket does not read as one continuous conversation.

Users need a focused, CodeZ-style ticket experience in which the system presents the order and collection instructions as a structured message, the user uploads Payment Evidence from that message, and later communication and review results appear in a chronological conversation. Administrators need the same conversation model inside their wider review workspace without weakening the separation between ticket state and financial state.

## Solution

Build one reusable Corporate Transfer conversation experience shared by the user ticket drawer, direct ticket page, and administrator review drawer.

The conversation will render ordinary messages and controlled business-message cards from typed application data rather than stored arbitrary HTML. Its first system message will combine the Product Order snapshot, Transfer Application state, and published collection-channel snapshot. The card will expose Enterprise WeChat and corporate-bank tabs and place the dedicated Payment Evidence action at the point where the user needs it. Submitted evidence will appear as a structured review-summary card, while ordinary text and image replies remain normal chat messages.

The message area will scroll independently, the composer will stay available at the bottom, and the drawer will adapt to desktop and mobile widths. A reply to a closed but non-terminal ticket will reopen only the ticket. It will never revive or settle a rejected, cancelled, expired, or otherwise terminal Transfer Application. Receipt Verification remains the only authority for recording receipt and settling the order.

## User Stories

1. As a shopper, I want a Corporate Transfer ticket to open in a right-side drawer, so that I can inspect it without losing my place in the ticket list.
2. As a shopper, I want the ticket drawer to use a focused desktop width, so that the conversation is easy to read.
3. As a mobile shopper, I want the ticket drawer to occupy the available screen, so that payment instructions and replies remain usable on a small display.
4. As a shopper, I want the drawer header to show the ticket subject and current status, so that I immediately know which case I am viewing.
5. As a shopper, I want the drawer to close with a clear close action and return focus to the invoking control, so that keyboard and screen-reader navigation remains predictable.
6. As a shopper, I want messages to be shown chronologically, so that I can understand the history of the payment application.
7. As a shopper, I want my messages aligned on the right and service messages aligned on the left, so that participants are visually distinguishable.
8. As a shopper, I want participant labels to read “我”, “客服”, and “系统”, so that internal role identifiers are not exposed.
9. As a shopper, I want each message to show its sender and time, so that I can understand who said what and when.
10. As a shopper, I want the first system message to present a structured order summary, so that I do not have to interpret an unformatted block of text.
11. As a shopper, I want the order summary to show the order number, item name, amount due, and Transfer Application status, so that I can verify the request before paying.
12. As a shopper, I want collection instructions to come from the immutable snapshot captured by my Transfer Application, so that later administrator configuration changes do not alter my payment destination.
13. As a shopper, I want enabled Enterprise WeChat and corporate-bank channels displayed as tabs in the system card, so that I can select the available payment method I intend to use.
14. As a shopper, I want the Enterprise WeChat tab to display its instructions and QR code at a readable size, so that I can complete the transfer without downloading the image first.
15. As a shopper, I want the corporate-bank tab to preserve the configured line breaks in the account information, so that account name, bank, and number are unambiguous.
16. As a shopper, I want a clear warning when the captured collection snapshot has no usable channel, so that I do not attempt an unsafe payment.
17. As a shopper, I want a single clearly labelled “上传支付凭证” action inside the payment card, so that I understand the next step without interpreting a file-picker label.
18. As a shopper, I want the evidence control to state accepted image formats and limits, so that I can select a valid screenshot on the first attempt.
19. As a shopper, I want invalid Payment Evidence rejected before submission with a useful message, so that I know how to correct it.
20. As a shopper, I want selected Payment Evidence shown as image previews with removal actions, so that I can verify the material before submitting it.
21. As a shopper, I want the evidence action to show upload progress and prevent duplicate submission while pending, so that I do not accidentally upload the same material twice.
22. As a shopper, I want a successful Payment Evidence submission to refresh the conversation and show that administrator review is pending, so that I know the upload was accepted.
23. As a shopper, I want submitted Payment Evidence represented by a structured summary card, so that formal evidence is distinguishable from ordinary chat images.
24. As a shopper, I want the evidence summary to show its order number, review state, uploader, upload time, and original image previews, so that the formal review record is understandable.
25. As a shopper, I want to open a Payment Evidence preview and inspect the authorized original file, so that text in the screenshot remains readable.
26. As a shopper, I want ordinary replies to support text, so that I can answer administrator questions.
27. As a shopper, I want ordinary replies to support image selection, clipboard paste, and drag-and-drop, so that I can conveniently provide supplemental material.
28. As a shopper, I want selected reply images shown as removable thumbnails, so that I can correct the message before sending.
29. As a shopper, I want to send a reply containing only images, so that unnecessary placeholder text is not required.
30. As a shopper, I want the composer to show a 5000-character counter and reject excess text, so that the reply limit is clear before submission.
31. As a shopper, I want the composer to clear only after a successful send, so that a failed request does not discard my message.
32. As a shopper, I want the message list to scroll independently while the composer stays available, so that I can reply after reading a long history.
33. As a shopper, I want loading, empty, and failed conversation states to be explicit, so that a temporary problem is not mistaken for missing ticket history.
34. As a shopper, I want to close an ongoing ticket after my question is resolved, so that the ticket list reflects its conversational state.
35. As a shopper, I want a closed ticket to explain that a reply will reopen it, so that the result of replying is predictable.
36. As a shopper, I want replying to a closed but non-terminal ticket to reopen the ticket automatically, so that I do not need a separate reopen action.
37. As a shopper, I want a reopened ticket to preserve its full message history, so that context is not lost.
38. As a shopper, I want a terminal Transfer Application to remain terminal even if its ticket is reopened for communication, so that I am not misled into believing an old payment order is valid.
39. As a shopper, I want rejected, cancelled, or expired applications to direct me to create a new order, so that payment and fulfillment remain auditable.
40. As a shopper, I want unread state to refresh after reading, replying, or uploading evidence, so that navigation badges remain accurate.
41. As an administrator, I want the review workspace to open a wider right-side drawer, so that the conversation and receipt-verification controls can coexist.
42. As an administrator, I want the administrator drawer to reuse the same conversation renderer as the shopper view, so that messages and business cards have one consistent meaning.
43. As an administrator, I want shopper messages on the opposite side from my own messages, so that the dialogue remains scannable from my perspective.
44. As an administrator, I want Payment Evidence cards to show authorized original images, so that I can inspect submitted screenshots during Receipt Verification.
45. As an administrator, I want ordinary reply images kept separate from formal Payment Evidence, so that supplemental conversation cannot be mistaken for proof of receipt.
46. As an administrator, I want to reply publicly from the fixed composer, so that the shopper receives an understandable response in the same chronology.
47. As an administrator, I want internal notes to remain visually and semantically distinct from shopper-visible messages, so that private review context is not disclosed.
48. As an administrator, I want closing or reopening a ticket to affect only communication state, so that it cannot settle, reject, cancel, or revive a Transfer Application.
49. As an administrator, I want review results to appear as structured messages, so that the shopper and later auditors can understand the outcome.
50. As an administrator, I want Receipt Verification controls to remain outside ordinary chat actions, so that financial settlement cannot occur through a reply or ticket-state control.
51. As an auditor, I want formal evidence, ordinary attachments, ticket state, Transfer Application state, and Receipt Verification records to remain distinguishable, so that the payment trail can be reconstructed.
52. As an auditor, I want original evidence access to remain authenticated and authorized, so that payment screenshots are not exposed through public URLs.
53. As an operator, I want all new user-facing text localized, so that the feature remains consistent across supported languages.
54. As an operator, I want the new experience to retain direct ticket URLs, so that existing links and order-to-ticket navigation continue to work.
55. As an operator, I want existing Corporate Transfer records to render without a data migration, so that deployment does not interrupt current tickets.

## Implementation Decisions

- Use one typed Corporate Transfer conversation model for the shopper drawer, direct ticket page, and administrator review drawer. Presentation may vary by viewer role, but message classification and business-card rendering must be shared.
- Preserve the established domain boundary from ADR-0002: Product Order is the commercial and fulfillment record; Transfer Application owns manual-payment lifecycle; the ticket owns instructions, evidence, and communication; Receipt Verification is the sole authority for receipt and settlement.
- Derive controlled business messages from existing Product Order, Transfer Application, collection snapshot, Payment Evidence, and Receipt Verification data. Do not store or execute arbitrary HTML or scriptable message payloads.
- Support these presentation kinds: ordinary text message, order-and-payment prompt, Payment Evidence summary, review result, and internal administrator note. The backend may expose a normalized presentation discriminator or the frontend may classify existing typed records, but the resulting contract must be explicit and stable.
- The initial order-and-payment prompt is a system business card. It shows the immutable application snapshot, not the administrator’s current collection configuration.
- Render Enterprise WeChat and corporate-bank collection targets as tabs only when present in the captured snapshot. Show a warning state if no valid target can be rendered.
- Keep the dedicated Payment Evidence submission endpoint and authorization model. Move its primary user control into the order-and-payment business card instead of treating the browser file-input label as the main action.
- Preserve existing Corporate Transfer evidence validation and retention rules unless a separate business decision changes them. This experience change does not silently replace established limits with CodeZ limits.
- Keep Payment Evidence and ordinary reply attachments as separate domain concepts and API actions. Payment Evidence can advance a Transfer Application into review; an ordinary attachment cannot.
- Extend ordinary ticket replies to carry authorized image attachments. Images must use private storage, content-signature validation, authenticated retrieval, constrained previews, and click-to-open original files.
- Ordinary reply text is limited to 5000 characters. A reply is valid with text, one or more valid images, or both. Empty replies remain invalid.
- The composer supports click-to-select, clipboard paste, and drag-and-drop. Selected files appear as removable thumbnails. Text and attachments clear only after a successful reply.
- The conversation uses chronological messages with viewer-relative alignment. Display labels are localized user-facing roles and never raw database role values.
- Use an independently scrolling message region and a bottom composer that remains available within the drawer. Do not depend on the outer page scroll for conversation navigation.
- Use a focused shopper drawer in the approximately 560–640 pixel desktop range and a full-width mobile presentation. Keep the administrator review drawer approximately 900 pixels or wider as needed for existing Receipt Verification controls.
- Preserve the direct ticket detail route as a full-page fallback and deep-link target. It must reuse the same conversation module rather than maintain a separate rendering implementation.
- Closing and reopening are communication actions only. A reply to a closed, non-terminal ticket automatically reopens the ticket in the same transaction that records the reply.
- A reply may reopen the ticket associated with a terminal Transfer Application for communication, but it must not change the terminal application or order state. The UI must continue to require a replacement order where applicable.
- Ticket state changes, replies, and attachments must never call the generic order completion path or Corporate Transfer settlement path.
- Reading the conversation, sending a reply, uploading Payment Evidence, and changing ticket state refresh the relevant detail, list, and unread queries.
- Preserve administrator-only internal messages. They must be excluded from shopper responses and visually distinct in the administrator conversation.
- All image loading continues through authorized application endpoints; do not introduce static public evidence URLs or permanent bearer tokens in URLs.
- All new user-facing strings use the existing internationalization system and include supported locale entries or safe fallbacks.
- Maintain compatibility with existing Corporate Transfer records. Any new attachment metadata must be additive and supported by SQLite, MySQL, and PostgreSQL.
- Do not duplicate financial status into message text as an authority. Structured review cards are projections of authoritative application and verification records.

## Testing Decisions

- Tests protect observable behavior, API contracts, authorization, and financial-state invariants. They must not assert private helper calls, complete Tailwind class strings, or incidental DOM nesting.
- The primary test seam is the shared Corporate Transfer conversation rendered with explicit API fixtures. The same contract is exercised through shopper and administrator viewer roles.
- Page-level component tests cover business-card selection, role-relative alignment, evidence actions, composer behavior, authenticated image presentation, closed-ticket messaging, loading/empty/error states, focus behavior, and responsive drawer contracts.
- Layout tests assert stable contracts such as the focused shopper width range, full-width mobile fallback, wider administrator workspace, independently scrollable message region, and persistent composer. They do not rely on pixel screenshots or browser-specific rendering tolerances.
- Interaction tests query controls through visible labels and accessible roles. They exercise click, keyboard, paste, drag-and-drop, attachment removal, send failure, retry, and success behavior from a user’s perspective.
- Existing Corporate Transfer fixtures and status-formatting tests are reused where possible. New fixtures use minimal meaningful Product Order, Transfer Application, collection snapshot, Payment Evidence, Receipt Verification, and message data.
- Backend tests extend the existing Corporate Transfer behavior seam to cover reply attachments, authorized file reads, ticket auto-reopen, unread updates, and strict independence between ticket state and financial state.
- Backend regression tests explicitly prove that reopening or replying cannot revive rejected, cancelled, or expired applications and cannot fulfill an order.
- Attachment tests cover valid JPEG, PNG, and WebP signatures; extension/content mismatch; oversize input; count limits; unauthorized user access; administrator access; and cleanup on failed message creation.
- API contract tests cover text-only replies, image-only replies, mixed replies, empty replies, excessive text, invalid attachment identifiers, duplicate submissions, and retry-safe outcomes.
- Tests use deterministic fixtures and explicit state. They do not use random inputs, sleeps, timing assertions, external networks, or large snapshots.
- Verification includes affected frontend tests, backend Corporate Transfer tests, frontend type checking, linting of changed files, production frontend build, Go tests for affected packages, and dev-environment browser checks.
- Dev browser verification covers a shopper with an existing ticket, a newly created Corporate Transfer ticket, Enterprise WeChat-only and corporate-bank-only snapshots, both-channel snapshots, formal evidence upload, ordinary image reply, administrator response, close/reply/reopen, terminal application behavior, and mobile layout.

## Out of Scope

- Changing the Product Order, Transfer Application, Payment Evidence, or Receipt Verification financial ownership model.
- Treating a ticket reply, close action, reopen action, or uploaded screenshot as proof of receipt.
- Reviving rejected, cancelled, expired, or otherwise terminal Transfer Applications.
- OCR, automatic receipt recognition, automatic bank reconciliation, or automatic Enterprise WeChat reconciliation.
- Adding a separate customer-service role; administrators continue to handle communication and review.
- General-purpose user-created support tickets unrelated to Corporate Transfer.
- Arbitrary HTML message rendering or administrator-authored executable message templates.
- Public or unauthenticated attachment URLs.
- Changing established evidence retention, file limits, or refund behavior without a separate approved requirement.
- Removing the direct ticket route or existing order-to-ticket links.
- Deploying to the production website as part of implementation; production synchronization requires explicit user acceptance after dev verification.

## Further Notes

- The visual and interaction reference is the CodeZ historical-ticket experience observed through a normal shopper account. Administrator-only CodeZ behavior was not directly accessible from that account; administrator decisions in this spec therefore combine the shared CodeZ conversation pattern with itokenify’s existing wider Receipt Verification workspace.
- The implementation should favor one deep shared conversation module over separate shopper and administrator message components. Viewer role, available actions, and surrounding review controls should be inputs to that module.
- CodeZ allows replies to reopen closed tickets. itokenify must preserve the stricter Corporate Transfer lifecycle: ticket reopening restores communication only and never restores payment validity.
- Existing evidence limits remain authoritative. Matching CodeZ’s exact 7 MiB single-file behavior is not required for this interaction redesign.
- Complete the work in the development environment first. Production deployment remains a separate, explicitly authorized step.
