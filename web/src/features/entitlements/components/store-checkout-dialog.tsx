/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'

import type { StoreCheckoutSummary } from '../store-checkout'
import type { PaymentMethod, ProductSKU } from '../types'

interface StoreCheckoutDialogProps {
  open: boolean
  sku: ProductSKU | null
  quantity: number
  amountMinor?: number
  paymentMethods: PaymentMethod[]
  paymentMethod: string
  checkout: StoreCheckoutSummary
  loading: boolean
  onOpenChange: (open: boolean) => void
  onPaymentMethodChange: (paymentMethod: string) => void
  onConfirm: () => void
}

function formatCurrency(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency || 'CNY',
    maximumFractionDigits: 2,
  }).format(amountMinor / 100)
}

export function StoreCheckoutDialog(props: StoreCheckoutDialogProps) {
  const { t } = useTranslation()
  if (!props.sku) return null

  const orderAmount =
    props.amountMinor ?? props.sku.price_amount_minor * props.quantity

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{t('Confirm order')}</DialogTitle>
          <DialogDescription>
            {t(
              'Review the order and choose a payment method before submitting.'
            )}
          </DialogDescription>
        </DialogHeader>

        <dl className='grid gap-3 rounded-xl border p-4'>
          <div className='flex items-start justify-between gap-4'>
            <dt className='text-muted-foreground'>{t('Product')}</dt>
            <dd className='text-right font-medium'>{props.sku.name}</dd>
          </div>
          {props.amountMinor === undefined ? (
            <div className='flex items-center justify-between gap-4'>
              <dt className='text-muted-foreground'>{t('Quantity')}</dt>
              <dd className='font-medium'>{props.quantity}</dd>
            </div>
          ) : (
            <div className='flex items-center justify-between gap-4'>
              <dt className='text-muted-foreground'>{t('Recharge amount')}</dt>
              <dd className='font-medium'>
                {formatCurrency(props.amountMinor, props.sku.currency)}
              </dd>
            </div>
          )}
          <div className='flex items-center justify-between gap-4'>
            <dt className='text-muted-foreground'>{t('Order amount')}</dt>
            <dd className='font-medium'>
              {formatCurrency(orderAmount, props.sku.currency)}
            </dd>
          </div>
          <div className='flex items-center justify-between gap-4'>
            <dt className='text-muted-foreground'>{t('Gift discount')}</dt>
            <dd className='font-medium'>
              −{formatCurrency(props.checkout.giftDiscountCents, 'CNY')}
            </dd>
          </div>
          <div className='flex items-center justify-between gap-4 border-t pt-3'>
            <dt className='font-medium'>{t('Cash payable')}</dt>
            <dd className='text-primary text-lg font-semibold'>
              {formatCurrency(props.checkout.cashPayableCents, 'CNY')}
            </dd>
          </div>
        </dl>

        {props.checkout.cashPayableCents > 0 ? (
          <label className='grid gap-2'>
            <span className='text-sm font-medium'>{t('Payment method')}</span>
            <NativeSelect
              value={props.paymentMethod}
              onChange={(event) =>
                props.onPaymentMethodChange(event.target.value)
              }
              aria-label={t('Payment method')}
            >
              <NativeSelectOption value=''>
                {t('Choose a payment method')}
              </NativeSelectOption>
              {props.paymentMethods.map((method) => (
                <NativeSelectOption key={method.type} value={method.type}>
                  {method.name || method.type}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            {props.paymentMethods.length === 0 ? (
              <span className='text-destructive text-xs'>
                {t('No payment method is currently available')}
              </span>
            ) : null}
          </label>
        ) : (
          <p className='text-muted-foreground text-sm'>
            {t('The order is fully covered by gift balance.')}
          </p>
        )}
        {!props.checkout.giftAmountValid ? (
          <p className='text-destructive text-sm'>{t('Invalid gift amount')}</p>
        ) : null}

        <DialogFooter>
          <Button
            type='button'
            variant='outline'
            disabled={props.loading}
            onClick={() => props.onOpenChange(false)}
          >
            {t('Cancel')}
          </Button>
          <Button
            type='button'
            disabled={!props.checkout.canConfirm || props.loading}
            onClick={props.onConfirm}
          >
            {props.loading ? t('Processing') : t('Confirm purchase')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
