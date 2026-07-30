/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import {
  hasAtMostDecimalPlaces,
  majorAmountToMinorUnits,
  minorUnitsToMajorAmount,
  quotaUnitsToUSD,
  usdToQuotaUnits,
} from '../form-units'

describe('entitlement admin form unit conversions', () => {
  test('converts major currency amounts to integer minor units', () => {
    assert.equal(majorAmountToMinorUnits(100), 10_000)
    assert.equal(majorAmountToMinorUnits(10.99), 1_099)
    assert.equal(minorUnitsToMajorAmount(1_099), 10.99)
  })

  test('converts USD amounts using the fixed nanoUSD ledger scale', () => {
    assert.equal(usdToQuotaUnits(100, 1_000_000_000), 100_000_000_000)
    assert.equal(usdToQuotaUnits(1.25, 1_000_000_000), 1_250_000_000)
    assert.equal(quotaUnitsToUSD(100_000_000_000, 1_000_000_000), 100)
  })

  test('validates decimal precision without floating-point false positives', () => {
    assert.equal(hasAtMostDecimalPlaces(10.99, 2), true)
    assert.equal(hasAtMostDecimalPlaces(10.999, 2), false)
    assert.equal(hasAtMostDecimalPlaces(0.0001, 4), true)
  })
})
