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
  corporateTransferIsTerminal,
  corporateTransferStatusKey,
} from '../corporate-transfer-status'

describe('corporate transfer status presentation', () => {
  test('keeps evidence and review states open for user actions', () => {
    assert.equal(corporateTransferIsTerminal('awaiting_evidence'), false)
    assert.equal(corporateTransferIsTerminal('under_review'), false)
    assert.equal(corporateTransferIsTerminal('needs_more_information'), false)
  })

  test('closes replies after fulfillment or an unsuccessful terminal result', () => {
    assert.equal(corporateTransferIsTerminal('fulfilled'), true)
    assert.equal(corporateTransferIsTerminal('cancelled'), true)
    assert.equal(corporateTransferIsTerminal('expired'), true)
    assert.equal(corporateTransferIsTerminal('rejected'), true)
  })

  test('maps each visible workflow state to a stable translation key', () => {
    assert.equal(
      corporateTransferStatusKey('awaiting_evidence'),
      'Awaiting payment evidence'
    )
    assert.equal(
      corporateTransferStatusKey('needs_more_information'),
      'More information required'
    )
    assert.equal(corporateTransferStatusKey('fulfilled'), 'Fulfilled')
  })
})
