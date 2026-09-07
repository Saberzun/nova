/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { formatQuota } from '@/lib/format'

import {
  calculateRechargeQuota,
  formatAccessGroupLabel,
  getSKUAccessGroups,
  isRechargeQuotaValid,
  isSKUAvailable,
} from '../store-catalog'
import type { Product, ProductSKU } from '../types'

const suggestedAmountsMinor = [1_000, 5_000, 10_000, 20_000]
interface StoreRechargeCardProps {
  product: Product
  sku: ProductSKU
  loading: boolean
  onPurchase: (sku: ProductSKU, amountMinor: number) => void
  groupRatios?: Record<string, number>
}

function formatCurrency(amountMinor: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency || 'CNY',
    maximumFractionDigits: 2,
  }).format(amountMinor / 100)
}

export function StoreRechargeCard(props: StoreRechargeCardProps) {
  const { t } = useTranslation()
  const minAmountMinor = props.sku.min_recharge_amount_minor || 100
  const maxAmountMinor = props.sku.max_recharge_amount_minor || 1_000_000
  const [amount, setAmount] = useState(String(minAmountMinor / 100))
  const amountMinor = Math.round(Number(amount) * 100)
  const amountIsInRange =
    Number.isFinite(amountMinor) &&
    amountMinor >= minAmountMinor &&
    amountMinor <= maxAmountMinor
  const estimatedQuota = amountIsInRange
    ? calculateRechargeQuota(props.sku, amountMinor)
    : 0
  const amountIsValid = amountIsInRange && isRechargeQuotaValid(estimatedQuota)
  const soldOut = !isSKUAvailable(props.sku)
  const accessGroups = getSKUAccessGroups(props.sku)
  let actionLabel = t('Recharge now')
  if (props.loading) actionLabel = t('Processing')
  if (soldOut) actionLabel = t('Sold out')
  const suggestions = useMemo(() => {
    const available = suggestedAmountsMinor.filter(
      (value) => value >= minAmountMinor && value <= maxAmountMinor
    )
    if (!available.includes(minAmountMinor)) available.unshift(minAmountMinor)
    return available.slice(0, 4)
  }, [maxAmountMinor, minAmountMinor])

  return (
    <Card className='border-primary/30 from-primary/8 bg-linear-to-br to-transparent shadow-sm'>
      <CardContent className='grid gap-6 p-5 lg:grid-cols-[minmax(180px,0.9fr)_minmax(240px,1.35fr)_minmax(260px,1.35fr)_minmax(140px,0.65fr)_auto] lg:items-start lg:p-6'>
        <div className='min-w-0 space-y-2'>
          <div className='flex items-start justify-between gap-3 lg:block'>
            <div>
              <p className='text-muted-foreground text-xs font-medium'>
                {t('Plan')}
              </p>
              <p className='mt-1 text-lg font-semibold'>{props.product.name}</p>
            </div>
            <Badge className='lg:mt-3'>{t('Recharge quota')}</Badge>
          </div>
          {props.product.description ? (
            <p className='text-muted-foreground text-sm leading-6'>
              {props.product.description}
            </p>
          ) : null}
        </div>

        <div className='min-w-0'>
          <p className='text-muted-foreground mb-2 text-xs font-medium'>
            {t('Available groups')}
          </p>
          <div className='flex flex-wrap gap-1.5'>
            {accessGroups.length > 0 ? (
              accessGroups.map((group) => (
                <Badge key={group} variant='secondary'>
                  {formatAccessGroupLabel(group, props.groupRatios ?? {})}
                </Badge>
              ))
            ) : (
              <span className='text-muted-foreground text-sm'>
                {t('No groups configured')}
              </span>
            )}
          </div>
        </div>

        <div className='min-w-0 space-y-3'>
          <label className='grid gap-2'>
            <span className='text-muted-foreground text-xs font-medium'>
              {t('Recharge amount')}
            </span>
            <Input
              aria-label={t('Recharge amount')}
              inputMode='decimal'
              type='number'
              min={minAmountMinor / 100}
              max={maxAmountMinor / 100}
              step='0.01'
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
            <span className='text-muted-foreground text-xs'>
              {t('Recharge range: {{min}}–{{max}}', {
                min: formatCurrency(minAmountMinor, props.sku.currency),
                max: formatCurrency(maxAmountMinor, props.sku.currency),
              })}
            </span>
          </label>
          <div className='flex flex-wrap gap-2'>
            {suggestions.map((value) => (
              <Button
                key={value}
                type='button'
                size='sm'
                variant={amountMinor === value ? 'default' : 'outline'}
                onClick={() => setAmount(String(value / 100))}
              >
                {formatCurrency(value, props.sku.currency)}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <p className='text-muted-foreground text-xs font-medium'>
            {t('Estimated quota')}
          </p>
          <strong className='mt-2 block text-xl'>
            {estimatedQuota > 0 ? formatQuota(estimatedQuota) : '—'}
          </strong>
        </div>

        <div className='flex items-end justify-between gap-4 border-t pt-5 lg:flex-col lg:items-end lg:border-t-0 lg:pt-0 lg:text-right'>
          <div>
            <p className='text-muted-foreground text-xs'>{t('Amount')}</p>
            <strong className='text-2xl'>
              {amountIsValid
                ? formatCurrency(amountMinor, props.sku.currency)
                : '—'}
            </strong>
          </div>
          <Button
            className='rounded-xl'
            disabled={!amountIsValid || soldOut || props.loading}
            onClick={() => props.onPurchase(props.sku, amountMinor)}
          >
            {actionLabel}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
