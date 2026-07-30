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
  buildDirectPriceExpression,
  parseDirectPriceExpression,
  type LaneKey,
} from './model-pricing-core'

describe('direct upstream model prices', () => {
  test('round-trips input, output and cache prices as a billing expression', () => {
    const prices: Record<LaneKey, string> = {
      completion: '15',
      cache: '0.3',
      createCache: '3.75',
      image: '',
      audioInput: '',
      audioOutput: '',
    }
    const enabled: Record<LaneKey, boolean> = {
      completion: true,
      cache: true,
      createCache: true,
      image: false,
      audioInput: false,
      audioOutput: false,
    }

    const expression = buildDirectPriceExpression('3', prices, enabled)
    assert.equal(
      expression,
      'tier("direct-price", p * 3 + c * 15 + cr * 0.3 + cc * 3.75)'
    )
    assert.deepEqual(parseDirectPriceExpression(expression), {
      promptPrice: '3',
      prices,
      enabled,
    })
  })

  test('does not reinterpret arbitrary tier expressions as a flat rate card', () => {
    assert.equal(
      parseDirectPriceExpression('tier("long-context", p * 6 + c * 18)'),
      null
    )
  })
})
