/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { getLegalDocument, LEGAL_DOCUMENTS } from '../content'

describe('public legal document catalog', () => {
  test('publishes every legal destination with unique stable slugs', () => {
    const slugs = LEGAL_DOCUMENTS.map((document) => document.slug)

    assert.deepEqual(slugs, [
      'terms',
      'acceptable-use',
      'supported-regions',
      'dpa',
      'service-specific',
    ])
    assert.equal(new Set(slugs).size, slugs.length)
  })

  test('keeps effective dates and complete source links on published summaries', () => {
    for (const document of LEGAL_DOCUMENTS) {
      assert.match(document.effectiveDate ?? '', /^\d{4}-\d{2}-\d{2}$/)
      assert.match(
        document.sourceUrl ?? '',
        /^https:\/\/my\.feishu\.cn\/docx\//
      )
      assert.ok(document.sections.length > 0)
    }
  })

  test('returns undefined for an unknown legal route', () => {
    assert.equal(getLegalDocument('missing'), undefined)
  })
})
