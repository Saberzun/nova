/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

export interface StoreCheckoutSummary {
  giftDiscountCents: number
  cashPayableCents: number
  giftAmountValid: boolean
  canConfirm: boolean
}

export function buildStoreCheckout(
  orderAmountCents: number,
  requestedGiftYuan: string,
  availableGiftCents: number,
  paymentMethod: string
): StoreCheckoutSummary {
  const requestedGiftCents = Math.round(Number(requestedGiftYuan || '0') * 100)
  const giftAmountValid =
    Number.isFinite(requestedGiftCents) && requestedGiftCents >= 0
  const validRequestedGiftCents = giftAmountValid ? requestedGiftCents : 0
  const giftDiscountCents = Math.min(
    validRequestedGiftCents,
    Math.max(0, availableGiftCents),
    Math.max(0, orderAmountCents)
  )
  const cashPayableCents = Math.max(0, orderAmountCents - giftDiscountCents)

  return {
    giftDiscountCents,
    cashPayableCents,
    giftAmountValid,
    canConfirm:
      giftAmountValid && (cashPayableCents === 0 || paymentMethod !== ''),
  }
}
