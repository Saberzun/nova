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
export const CHANNEL_CONNECTION_INFO_TYPE = 'newapi_channel_conn'

export type ChannelConnectionInfo = {
  key: string
  url: string
}

type CCSwitchImportOptions = {
  app: string
  name: string
  models: Record<string, string>
  apiKey: string
  status: unknown
  currentOrigin: string
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readStatusUrl(status: unknown, keys: string[]): string | undefined {
  if (!isRecord(status)) return undefined

  const sources = [status]
  if (isRecord(status.data)) sources.push(status.data)

  for (const source of sources) {
    for (const key of keys) {
      const value = source[key]
      if (typeof value === 'string' && value.trim()) return value
    }
  }

  return undefined
}

function resolvePublicUrl(
  configuredAddress: string | undefined,
  fallbackAddress: string
): string {
  const fallback = fallbackAddress.trim().replace(/\/+$/, '')
  const configured = configuredAddress?.trim().replace(/\/+$/, '')
  if (!configured) return fallback

  try {
    const configuredUrl = new URL(configured)
    const fallbackUrl = new URL(fallback)
    if (!['http:', 'https:'].includes(configuredUrl.protocol)) return fallback
    if (
      LOOPBACK_HOSTS.has(configuredUrl.hostname) &&
      !LOOPBACK_HOSTS.has(fallbackUrl.hostname)
    ) {
      return fallback
    }
    return configured
  } catch {
    return fallback
  }
}

export function resolveConnectionAddresses(
  status: unknown,
  currentOrigin: string
): { apiBaseUrl: string; homepage: string } {
  const homepage = resolvePublicUrl(
    readStatusUrl(status, ['server_address', 'serverAddress']),
    currentOrigin
  )
  const apiBaseUrl = resolvePublicUrl(
    readStatusUrl(status, ['api_base_url', 'apiBaseUrl']),
    homepage
  )

  return { apiBaseUrl, homepage }
}

export function encodeChannelConnectionInfo(key: string, url: string): string {
  return JSON.stringify({
    _type: CHANNEL_CONNECTION_INFO_TYPE,
    key,
    url,
  })
}

export function encodeChannelConnectionInfoFromStatus(
  key: string,
  status: unknown,
  currentOrigin: string
): string {
  const { apiBaseUrl } = resolveConnectionAddresses(status, currentOrigin)
  return encodeChannelConnectionInfo(key, apiBaseUrl)
}

export function buildCCSwitchImportUrl(options: CCSwitchImportOptions): string {
  const { apiBaseUrl, homepage } = resolveConnectionAddresses(
    options.status,
    options.currentOrigin
  )
  const endpoint =
    options.app === 'codex' && !apiBaseUrl.endsWith('/v1')
      ? `${apiBaseUrl}/v1`
      : apiBaseUrl
  const params = new URLSearchParams()
  params.set('resource', 'provider')
  params.set('app', options.app)
  params.set('name', options.name)
  params.set('endpoint', endpoint)
  params.set('apiKey', options.apiKey)
  for (const [key, value] of Object.entries(options.models)) {
    if (value) params.set(key, value)
  }
  params.set('homepage', homepage)
  params.set('enabled', 'true')
  return `ccswitch://v1/import?${params.toString()}`
}

export function parseChannelConnectionInfo(
  text: string | null | undefined
): ChannelConnectionInfo | null {
  if (!text || typeof text !== 'string') return null

  try {
    const parsed: unknown = JSON.parse(text.trim())
    if (
      isRecord(parsed) &&
      parsed._type === CHANNEL_CONNECTION_INFO_TYPE &&
      typeof parsed.key === 'string' &&
      typeof parsed.url === 'string'
    ) {
      return { key: parsed.key, url: parsed.url }
    }
  } catch {
    /* not valid connection info JSON */
  }

  return null
}
