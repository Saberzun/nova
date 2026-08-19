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
  canConfirm: boolean
}

export type StorePaymentChannel = 'online' | 'corporate_transfer'

export function buildStoreCheckout(
  orderAmountCents: number,
  useGift: boolean,
  availableGiftCents: number,
  paymentChannelReady: boolean
): StoreCheckoutSummary {
  const giftDiscountCents = useGift
    ? Math.min(Math.max(0, availableGiftCents), Math.max(0, orderAmountCents))
    : 0
  const cashPayableCents = Math.max(0, orderAmountCents - giftDiscountCents)

  return {
    giftDiscountCents,
    cashPayableCents,
    canConfirm: cashPayableCents === 0 || paymentChannelReady,
  }
}
