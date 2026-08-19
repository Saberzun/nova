/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { buildStorePaymentMethods } from '../store-payment-methods'

describe('store payment method availability', () => {
  test('does not offer corporate transfer before collection information is published', () => {
    const methods = buildStorePaymentMethods([], false, '对公转账')

    assert.deepEqual(methods, [])
  })

  test('offers corporate transfer after collection information is published', () => {
    const methods = buildStorePaymentMethods([], true, '对公转账')

    assert.deepEqual(methods, [
      { type: 'corporate_transfer', name: '对公转账' },
    ])
  })
})
