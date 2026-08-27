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

import { resolveQueryErrorAction } from './query-error-policy'

describe('query error presentation policy', () => {
  test('keeps ordinary server failures on the current page', () => {
    assert.equal(
      resolveQueryErrorAction({ response: { status: 500 } }, undefined),
      'toast'
    )
  })

  test('only critical queries can request the full-page error route', () => {
    assert.equal(
      resolveQueryErrorAction({ response: { status: 500 } }, 'page'),
      'page'
    )
    assert.equal(
      resolveQueryErrorAction({ response: { status: 503 } }, 'page'),
      'page'
    )
  })

  test('supports silent fallback queries', () => {
    assert.equal(
      resolveQueryErrorAction({ response: { status: 500 } }, 'silent'),
      'silent'
    )
  })
})
