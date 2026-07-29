/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

export function getDiscountLabel(ratio: number): string | null {
  if (!Number.isFinite(ratio) || ratio <= 0 || ratio >= 1) return null
  const tenths = Math.round(ratio * 100)
  const value =
    tenths % 10 === 0 ? String(tenths / 10) : (tenths / 10).toFixed(1)
  return `${value}折`
}

export function getHealthLabelKey(successRate: number): string {
  if (!Number.isFinite(successRate)) return 'No data'
  if (successRate >= 99) return 'Healthy'
  if (successRate >= 95) return 'Degraded'
  return 'Unstable'
}
