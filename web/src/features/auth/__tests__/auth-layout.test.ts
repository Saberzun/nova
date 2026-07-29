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

import { authLayoutClasses } from '../lib/auth-layout'

describe('authentication layout', () => {
  test('keeps the brand showcase hidden on small screens and visible on desktop', () => {
    const classes = authLayoutClasses.showcase.split(' ')

    assert.ok(classes.includes('hidden'))
    assert.ok(classes.includes('lg:flex'))
  })

  test('uses a two-column desktop layout without forcing it on mobile', () => {
    const classes = authLayoutClasses.root.split(' ')

    assert.ok(classes.includes('lg:grid'))
    assert.ok(
      classes.includes('lg:grid-cols-[minmax(0,1.1fr)_minmax(440px,0.9fr)]')
    )
  })

  test('allows long authentication forms to scroll within the form panel', () => {
    const classes = authLayoutClasses.formPanel.split(' ')

    assert.ok(classes.includes('min-h-svh'))
    assert.ok(classes.includes('overflow-y-auto'))
  })
})
