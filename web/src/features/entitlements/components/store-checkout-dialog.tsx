/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import { Building2, CreditCard, Gift } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { cn } from '@/lib/utils'

import type {
  StoreCheckoutSummary,
  StorePaymentChannel,
} from '../store-checkout'
import type {
  EpayMissingConfiguration,
  PaymentMethod,
  ProductSKU,
} from '../types'

interface StoreCheckoutDialogProps {
  open: boolean
  sku: ProductSKU | null
  quantity: number
  amountMinor?: number
  paymentChannel: StorePaymentChannel
  onlinePaymentMethods: PaymentMethod[]
  onlinePaymentMethod: string
  onlinePaymentReady: boolean
  epayMissingConfiguration: EpayMissingConfiguration[]
  corporateTransferAvailable: boolean
  availableGiftCents: number
  giftCheckoutEnabled: boolean
  useGift: boolean
  checkout: StoreCheckoutSummary
  loading: boolean
  onOpenChange: (open: boolean) => void
  onPaymentChannelChange: (channel: StorePaymentChannel) => void
  onOnlinePaymentMethodChange: (paymentMethod: string) => void
  onUseGiftChange: (useGift: boolean) => void
  onConfirm: () => void
}

function formatCurrency(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency || 'CNY',
    maximumFractionDigits: 2,
  }).format(amountMinor / 100)
}

function missingConfigurationLabel(
  t: ReturnType<typeof useTranslation>['t'],
  item: EpayMissingConfiguration
): string {
  if (item === 'payment_compliance') return t('Payment compliance confirmation')
  if (item === 'gateway_address') return t('ZPay gateway address')
  if (item === 'merchant_id') return t('ZPay merchant ID')
  if (item === 'merchant_key') return t('ZPay merchant key')
  return t('Online payment methods')
}

export function StoreCheckoutDialog(props: StoreCheckoutDialogProps) {
  const { t } = useTranslation()
  if (!props.sku) return null

  const orderAmount =
    props.amountMinor ?? props.sku.price_amount_minor * props.quantity
  const giftAvailable =
    props.giftCheckoutEnabled && props.availableGiftCents > 0

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className='max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>{t('Confirm order')}</DialogTitle>
          <DialogDescription>
            {t('Review the order and choose how to pay before submitting.')}
          </DialogDescription>
        </DialogHeader>

        <section className='bg-muted/35 space-y-3 rounded-xl border p-4'>
          <div className='flex items-start justify-between gap-4'>
            <div>
              <p className='text-muted-foreground text-xs'>{t('Product')}</p>
              <p className='mt-1 font-semibold'>{props.sku.name}</p>
            </div>
            <strong className='text-lg'>
              {formatCurrency(orderAmount, props.sku.currency)}
            </strong>
          </div>
          <div className='text-muted-foreground flex flex-wrap gap-x-5 gap-y-1 text-sm'>
            {props.amountMinor === undefined ? (
              <span>
                {t('Quantity')}: {props.quantity}
              </span>
            ) : (
              <span>
                {t('Recharge amount')}:{' '}
                {formatCurrency(props.amountMinor, props.sku.currency)}
              </span>
            )}
          </div>
        </section>

        {props.checkout.cashPayableCents > 0 ? (
          <section className='space-y-3'>
            <h3 className='text-sm font-semibold'>{t('Payment method')}</h3>
            <RadioGroup
              value={props.paymentChannel}
              onValueChange={(value) =>
                props.onPaymentChannelChange(value as StorePaymentChannel)
              }
              className='grid gap-3 sm:grid-cols-2'
            >
              <label
                htmlFor='store-payment-online'
                className={cn(
                  'hover:border-primary/60 flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors',
                  props.paymentChannel === 'online' &&
                    'border-primary bg-primary/5'
                )}
              >
                <RadioGroupItem
                  id='store-payment-online'
                  value='online'
                  className='mt-0.5'
                />
                <CreditCard className='text-primary size-5 shrink-0' />
                <span>
                  <span className='block font-medium'>
                    {t('Online payment')}
                  </span>
                  <span className='text-muted-foreground mt-1 block text-xs'>
                    {props.onlinePaymentMethods.length > 0
                      ? props.onlinePaymentMethods
                          .map((method) => method.name || method.type)
                          .join(' / ')
                      : t('ZPay')}
                  </span>
                </span>
              </label>

              {props.corporateTransferAvailable ? (
                <label
                  htmlFor='store-payment-corporate'
                  className={cn(
                    'hover:border-primary/60 flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors',
                    props.paymentChannel === 'corporate_transfer' &&
                      'border-primary bg-primary/5'
                  )}
                >
                  <RadioGroupItem
                    id='store-payment-corporate'
                    value='corporate_transfer'
                    className='mt-0.5'
                  />
                  <Building2 className='text-primary size-5 shrink-0' />
                  <span>
                    <span className='block font-medium'>
                      {t('Corporate Transfer')}
                    </span>
                    <span className='text-muted-foreground mt-1 block text-xs'>
                      {t('Submit evidence for manual review')}
                    </span>
                  </span>
                </label>
              ) : null}
            </RadioGroup>

            {props.paymentChannel === 'online' ? (
              <div className='space-y-2'>
                {props.onlinePaymentMethods.length > 1 ? (
                  <NativeSelect
                    value={props.onlinePaymentMethod}
                    onChange={(event) =>
                      props.onOnlinePaymentMethodChange(event.target.value)
                    }
                    aria-label={t('Online payment method')}
                  >
                    {props.onlinePaymentMethods.map((method) => (
                      <NativeSelectOption key={method.type} value={method.type}>
                        {method.name || method.type}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                ) : null}
                {!props.onlinePaymentReady ? (
                  <div className='border-destructive/35 bg-destructive/5 text-destructive rounded-xl border p-3 text-sm'>
                    <p className='font-medium'>
                      {t('ZPay configuration is incomplete')}
                    </p>
                    <p className='mt-1 text-xs leading-5'>
                      {t('Missing configuration: {{items}}', {
                        items: props.epayMissingConfiguration
                          .map((item) => missingConfigurationLabel(t, item))
                          .join(', '),
                      })}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}

        <section className='space-y-3 rounded-xl border p-4'>
          <div className='flex items-start gap-3'>
            <Checkbox
              id='store-use-gift'
              checked={props.useGift}
              disabled={!giftAvailable}
              onCheckedChange={(checked) =>
                props.onUseGiftChange(checked === true)
              }
              className='mt-0.5'
            />
            <label
              htmlFor='store-use-gift'
              className={cn(
                'flex flex-1 cursor-pointer items-start justify-between gap-4',
                !giftAvailable && 'cursor-not-allowed opacity-60'
              )}
            >
              <span className='flex items-start gap-2'>
                <Gift className='text-primary size-5 shrink-0' />
                <span>
                  <span className='block font-medium'>
                    {t('Use gift balance')}
                  </span>
                  <span className='text-muted-foreground mt-1 block text-xs'>
                    {t('Available gift balance')}
                  </span>
                </span>
              </span>
              <strong>{formatCurrency(props.availableGiftCents, 'CNY')}</strong>
            </label>
          </div>
          {!props.giftCheckoutEnabled ? (
            <p className='text-muted-foreground text-xs'>
              {t('Gift checkout is currently disabled')}
            </p>
          ) : null}
        </section>

        <section className='bg-muted/35 space-y-3 rounded-xl border p-4'>
          <h3 className='font-semibold'>{t('Order summary')}</h3>
          <dl className='grid gap-2 text-sm'>
            <div className='flex items-center justify-between gap-4'>
              <dt className='text-muted-foreground'>{t('Order amount')}</dt>
              <dd>{formatCurrency(orderAmount, props.sku.currency)}</dd>
            </div>
            <div className='flex items-center justify-between gap-4'>
              <dt className='text-muted-foreground'>{t('Gift discount')}</dt>
              <dd>
                −{formatCurrency(props.checkout.giftDiscountCents, 'CNY')}
              </dd>
            </div>
            <div className='flex items-center justify-between gap-4 border-t pt-3'>
              <dt className='font-medium'>{t('Cash payable')}</dt>
              <dd className='text-primary text-xl font-semibold'>
                {formatCurrency(props.checkout.cashPayableCents, 'CNY')}
              </dd>
            </div>
          </dl>
        </section>

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
