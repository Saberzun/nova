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

const DECIMAL_EPSILON = 1e-8

export function hasAtMostDecimalPlaces(
  value: number,
  decimalPlaces: number
): boolean {
  if (!Number.isFinite(value)) return false
  const factor = 10 ** decimalPlaces
  return Math.abs(value * factor - Math.round(value * factor)) < DECIMAL_EPSILON
}

export function majorAmountToMinorUnits(amount: number): number {
  return Math.round(amount * 100)
}

export function minorUnitsToMajorAmount(amountMinor: number): number {
  return amountMinor / 100
}

export function quotaUnitsToUSD(quota: number, quotaPerUnit: number): number {
  if (!Number.isFinite(quotaPerUnit) || quotaPerUnit <= 0) return 0
  return quota / quotaPerUnit
}

export function usdToQuotaUnits(
  amountUSD: number,
  quotaPerUnit: number
): number {
  if (!Number.isFinite(quotaPerUnit) || quotaPerUnit <= 0) return 0
  return Math.round(amountUSD * quotaPerUnit)
}
