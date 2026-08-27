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

export type QueryErrorPolicy = 'silent' | 'toast' | 'page'
export type QueryErrorAction = QueryErrorPolicy

function getHttpStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined
  const response = (error as { response?: unknown }).response
  if (!response || typeof response !== 'object') return undefined
  const status = (response as { status?: unknown }).status
  return typeof status === 'number' ? status : undefined
}

export function resolveQueryErrorAction(
  error: unknown,
  policy: unknown
): QueryErrorAction {
  if (policy === 'silent') return 'silent'
  if (policy === 'page') return 'page'

  const status = getHttpStatus(error)
  return status !== undefined && status >= 500 ? 'toast' : 'silent'
}
