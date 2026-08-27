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
import { queryOptions, useQuery } from '@tanstack/react-query'

import type { SystemStatus } from '@/features/auth/types'
import { getStatus } from '@/lib/api'
import { useSystemConfigStore } from '@/stores/system-config-store'

import { mapStatusDataToConfig } from './use-system-config'

// Get initial cache from localStorage
function getInitialStatus(): SystemStatus | undefined {
  try {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('status')
      return saved ? (JSON.parse(saved) as SystemStatus) : undefined
    }
  } catch {
    /* empty */
  }
  return undefined
}

function getHttpStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined
  const response = (error as { response?: unknown }).response
  if (!response || typeof response !== 'object') return undefined
  const status = (response as { status?: unknown }).status
  return typeof status === 'number' ? status : undefined
}

export function shouldRetrySystemStatusRequest(
  failureCount: number,
  error: unknown
): boolean {
  if (failureCount >= 2) return false
  const status = getHttpStatus(error)
  return status === undefined || status === 429 || status >= 500
}

export async function withSystemConfigLoading<T>(
  request: () => Promise<T>
): Promise<T> {
  useSystemConfigStore.getState().setLoading(true)
  try {
    return await request()
  } finally {
    useSystemConfigStore.getState().setLoading(false)
  }
}

export const systemStatusQueryOptions = queryOptions({
  queryKey: ['status'],
  queryFn: () =>
    withSystemConfigLoading(async () => {
      const status = await getStatus()
      try {
        if (status) {
          const { setConfig } = useSystemConfigStore.getState()
          setConfig(mapStatusDataToConfig(status))
        }
      } catch (err) {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.warn(
            '[useStatus] Failed to sync status to system config',
            err
          )
        }
      }
      try {
        if (typeof window !== 'undefined' && status) {
          window.localStorage.setItem('status', JSON.stringify(status))
        }
      } catch {
        /* empty */
      }
      return status as SystemStatus | null
    }),
  placeholderData: getInitialStatus(),
  staleTime: 5 * 60 * 1000,
  gcTime: 30 * 60 * 1000,
  retry: shouldRetrySystemStatusRequest,
  retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 2000),
  meta: { errorPolicy: 'silent' },
})

export function useStatus() {
  const { data, isLoading, error } = useQuery(systemStatusQueryOptions)

  return {
    status: data ?? null,
    loading: isLoading,
    error,
  }
}
