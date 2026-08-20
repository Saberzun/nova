/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import {
  corporateTicketParticipantKey,
  canSendCorporateTicketReply,
  mergeCorporateReplyFiles,
  partitionCorporateTicketAttachments,
} from '../corporate-transfer-conversation'
import type { SupportTicketAttachment, SupportTicketMessage } from '../types'

function message(
  senderRole: SupportTicketMessage['sender_role'],
  internal = false
): SupportTicketMessage {
  return {
    id: 1,
    sender_user_id: 1,
    sender_role: senderRole,
    body: '',
    internal,
    created_at: 1,
  }
}

function attachment(
  id: number,
  kind: SupportTicketAttachment['kind']
): SupportTicketAttachment {
  return {
    id,
    kind,
    original_name: `${id}.png`,
    content_type: 'image/png',
    byte_size: 10,
    sha256: String(id),
    created_at: 1,
  }
}

describe('corporate transfer conversation projection', () => {
  test('presents participant labels relative to the current viewer', () => {
    assert.equal(corporateTicketParticipantKey(message('user'), 'user'), 'Me')
    assert.equal(
      corporateTicketParticipantKey(message('admin'), 'user'),
      'Support'
    )
    assert.equal(
      corporateTicketParticipantKey(message('user'), 'admin'),
      'Shopper'
    )
    assert.equal(
      corporateTicketParticipantKey(message('system'), 'admin'),
      'System'
    )
  })

  test('keeps internal notes distinct from public participant labels', () => {
    assert.equal(
      corporateTicketParticipantKey(message('admin', true), 'admin'),
      'Internal note'
    )
  })

  test('separates formal evidence from ordinary reply images and preserves legacy evidence', () => {
    const result = partitionCorporateTicketAttachments([
      attachment(1, 'payment_evidence'),
      attachment(2, 'reply'),
      attachment(3, ''),
    ])

    assert.deepEqual(
      result.evidence.map((item) => item.id),
      [1, 3]
    )
    assert.deepEqual(
      result.replies.map((item) => item.id),
      [2]
    )
  })

  test('accepts only supported reply images and caps the combined selection at five', () => {
    const files = Array.from(
      { length: 6 },
      (_, index) => new File(['image'], `${index}.png`, { type: 'image/png' })
    )
    const result = mergeCorporateReplyFiles(
      [],
      [...files, new File(['text'], 'note.txt', { type: 'text/plain' })]
    )

    assert.equal(result.length, 5)
    assert.equal(
      result.some((file) => file.name === 'note.txt'),
      false
    )
  })

  test('allows text-only and image-only replies but rejects an empty reply', () => {
    const image = new File(['image'], 'image.png', { type: 'image/png' })
    assert.equal(canSendCorporateTicketReply('hello', []), true)
    assert.equal(canSendCorporateTicketReply('', [image]), true)
    assert.equal(canSendCorporateTicketReply('   ', []), false)
  })
})
