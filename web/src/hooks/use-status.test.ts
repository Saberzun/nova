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

import { useSystemConfigStore } from '@/stores/system-config-store'

import {
  shouldRetrySystemStatusRequest,
  withSystemConfigLoading,
} from './use-status'

describe('system status request resilience', () => {
  test('retries transient failures at most twice', () => {
    const serverError = { response: { status: 500 } }
    const networkError = { message: 'Network Error' }

    assert.equal(shouldRetrySystemStatusRequest(0, serverError), true)
    assert.equal(shouldRetrySystemStatusRequest(1, networkError), true)
    assert.equal(shouldRetrySystemStatusRequest(2, serverError), false)
  })

  test('does not retry permanent client failures', () => {
    assert.equal(
      shouldRetrySystemStatusRequest(0, { response: { status: 404 } }),
      false
    )
    assert.equal(
      shouldRetrySystemStatusRequest(0, { response: { status: 401 } }),
      false
    )
  })

  test('always clears the shared loading state after a request settles', async () => {
    let resolveRequest: (() => void) | undefined
    const pending = withSystemConfigLoading(
      () =>
        new Promise<void>((resolve) => {
          resolveRequest = resolve
        })
    )

    assert.equal(useSystemConfigStore.getState().loading, true)
    resolveRequest?.()
    await pending
    assert.equal(useSystemConfigStore.getState().loading, false)

    await assert.rejects(
      withSystemConfigLoading(() => Promise.reject(new Error('unavailable')))
    )
    assert.equal(useSystemConfigStore.getState().loading, false)
  })
})
