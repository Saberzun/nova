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

import { providerWallLayoutClasses } from '../lib/provider-wall-layout'

describe('provider wall hover layout', () => {
  test('keeps provider cells in place while hovering', () => {
    const classes = providerWallLayoutClasses.item.split(' ')

    assert.equal(
      classes.some((className) => className.includes('translate')),
      false
    )
    assert.ok(classes.includes('transition-colors'))
  })

  test('keeps focus feedback inside the clipped provider grid', () => {
    const classes = providerWallLayoutClasses.item.split(' ')

    assert.ok(classes.includes('focus-visible:ring-inset'))
  })

  test('uses explicit one-pixel separators without exposing hover gaps', () => {
    const classes = providerWallLayoutClasses.grid.split(' ')

    assert.ok(classes.includes('gap-px'))
    assert.ok(classes.includes('overflow-hidden'))
  })
})
