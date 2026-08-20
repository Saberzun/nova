/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'node:test'

import {
  canSendCorporateTicketReply,
  corporateTicketParticipantKey,
  corporateTransferLocalizedText,
  corporateTransferReceiptStatusKey,
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
  test('keeps Chinese corporate transfer interface keys translated', () => {
    const locale = JSON.parse(
      readFileSync(
        new URL('../../../i18n/locales/zh.json', import.meta.url),
        'utf8'
      )
    ).translation as Record<string, string>
    const keys = [
      'Verify receipts against the actual collection account before fulfillment.',
      'User-visible reason for more information or rejection',
      'Applications: {{count}}',
      'Select reply images',
      'Corporate transfer cancelled before payment',
      'Payment evidence deadline expired',
    ]

    for (const key of keys) {
      assert.ok(locale[key], `missing Chinese translation for ${key}`)
      assert.notEqual(locale[key], key, `untranslated Chinese key: ${key}`)
    }
  })

  test('maps stored system messages and receipt states to locale keys', () => {
    assert.deepEqual(
      corporateTransferLocalizedText('cancelled by user before payment'),
      { key: 'Corporate transfer cancelled before payment' }
    )
    assert.deepEqual(
      corporateTransferLocalizedText('payment evidence deadline expired'),
      { key: 'Payment evidence deadline expired' }
    )
    assert.deepEqual(corporateTransferLocalizedText('工单已由管理员关闭。'), {
      key: 'Ticket closed by administrator',
    })
    assert.equal(corporateTransferReceiptStatusKey('active'), 'Valid')
    assert.equal(corporateTransferReceiptStatusKey('voided'), 'Voided')
  })

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
