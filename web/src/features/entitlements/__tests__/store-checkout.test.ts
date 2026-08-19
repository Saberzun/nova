/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { buildStoreCheckout } from '../store-checkout'

describe('store checkout confirmation', () => {
  test('requires a payment method when cash remains payable', () => {
    const checkout = buildStoreCheckout(10_000, false, 0, false)

    assert.equal(checkout.cashPayableCents, 10_000)
    assert.equal(checkout.canConfirm, false)
  })

  test('allows confirmation after selecting a payment method', () => {
    const checkout = buildStoreCheckout(10_000, false, 0, true)

    assert.equal(checkout.canConfirm, true)
  })

  test('allows confirmation without a payment method when gift covers the order', () => {
    const checkout = buildStoreCheckout(10_000, true, 10_000, false)

    assert.equal(checkout.giftDiscountCents, 10_000)
    assert.equal(checkout.cashPayableCents, 0)
    assert.equal(checkout.canConfirm, true)
  })

  test('caps gift deduction at the order amount and available balance', () => {
    const checkout = buildStoreCheckout(10_000, true, 5_000, true)

    assert.equal(checkout.giftDiscountCents, 5_000)
    assert.equal(checkout.cashPayableCents, 5_000)
  })

  test('does not deduct gift balance until the shopper selects it', () => {
    const checkout = buildStoreCheckout(10_000, false, 10_000, true)

    assert.equal(checkout.giftDiscountCents, 0)
    assert.equal(checkout.cashPayableCents, 10_000)
  })
})
