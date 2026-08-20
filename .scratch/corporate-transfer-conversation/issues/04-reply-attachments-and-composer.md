# Add the chat composer and ordinary image replies

Status: completed

Extend ordinary Corporate Transfer ticket replies to support text and private image attachments, while keeping them semantically separate from formal Payment Evidence.

The bottom composer must support up to 5000 characters, click-to-select, clipboard paste, drag-and-drop, removable thumbnails, image-only messages, pending state, failure retention, and success cleanup. Attachment reads must remain authenticated and authorized.

## Acceptance Criteria

- Text-only, image-only, and mixed replies are accepted; empty replies are rejected.
- Text beyond 5000 characters is prevented or rejected with a clear message.
- Valid images can be selected, pasted, or dropped and removed before sending.
- Pending submission prevents accidental duplicate sends.
- A failed send preserves the draft and selected images; a successful send clears them.
- Formal Payment Evidence and ordinary reply attachments use separate actions and cannot be confused by the backend.
- File content, size, count, ownership, and access are validated server-side.
- Original images remain private and are displayed through authorized endpoints.
- API and component tests cover success, failure, invalid input, and unauthorized access.

## Comments
