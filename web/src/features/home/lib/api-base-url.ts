/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])

export function resolveApiBaseUrl(
  configuredAddress: string | undefined,
  browserOrigin: string
): string {
  const configured = configuredAddress?.trim().replace(/\/+$/, '')
  if (!configured) return browserOrigin

  try {
    const configuredUrl = new URL(configured)
    const browserUrl = new URL(browserOrigin)
    const configuredIsLoopback = LOOPBACK_HOSTS.has(configuredUrl.hostname)
    const browserIsLoopback = LOOPBACK_HOSTS.has(browserUrl.hostname)
    if (configuredIsLoopback && !browserIsLoopback) return browserOrigin
    return configured
  } catch {
    return browserOrigin
  }
}
