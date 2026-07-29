/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { getDiscountLabel, getHealthLabelKey } from '../lib/model-card'

describe('model catalog card presentation', () => {
  test('shows a Chinese-style discount only for ratios below standard price', () => {
    assert.equal(getDiscountLabel(0.25), '2.5折')
    assert.equal(getDiscountLabel(0.8), '8折')
    assert.equal(getDiscountLabel(1), null)
    assert.equal(getDiscountLabel(1.3), null)
  })

  test('maps measured success rates to a user-facing health state', () => {
    assert.equal(getHealthLabelKey(99.9), 'Healthy')
    assert.equal(getHealthLabelKey(97), 'Degraded')
    assert.equal(getHealthLabelKey(80), 'Unstable')
    assert.equal(getHealthLabelKey(0), 'Unstable')
    assert.equal(getHealthLabelKey(Number.NaN), 'No data')
  })
})
