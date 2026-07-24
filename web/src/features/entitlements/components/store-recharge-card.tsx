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
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { formatQuota } from '@/lib/format'

import { calculateRechargeQuota } from '../store-catalog'
import type { Product, ProductSKU } from '../types'

const suggestedAmountsMinor = [1_000, 5_000, 10_000, 20_000]
const maximumGrantQuota = 2_147_483_647

interface StoreRechargeCardProps {
  product: Product
  sku: ProductSKU
  loading: boolean
  onPurchase: (sku: ProductSKU, amountMinor: number) => void
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
  const amountIsValid =
    amountIsInRange && estimatedQuota > 0 && estimatedQuota <= maximumGrantQuota
  const suggestions = useMemo(() => {
    const available = suggestedAmountsMinor.filter(
      (value) => value >= minAmountMinor && value <= maxAmountMinor
    )
    if (!available.includes(minAmountMinor)) available.unshift(minAmountMinor)
    return available.slice(0, 4)
  }, [maxAmountMinor, minAmountMinor])

  return (
    <Card className='border-primary/30 from-primary/8 bg-linear-to-br to-transparent shadow-sm'>
      <CardHeader className='space-y-3'>
        <div className='flex items-start justify-between gap-3'>
          <CardTitle className='text-xl'>{props.product.name}</CardTitle>
          <Badge>{t('Recharge quota')}</Badge>
        </div>
        {props.product.description ? (
          <p className='text-muted-foreground text-sm leading-6'>
            {props.product.description}
          </p>
        ) : null}
      </CardHeader>
      <CardContent className='space-y-5'>
        <label className='grid gap-2'>
          <span className='text-sm font-medium'>{t('Recharge amount')}</span>
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
        <div className='bg-background/70 flex items-center justify-between rounded-xl border p-4'>
          <span className='text-muted-foreground text-sm'>
            {t('Estimated quota')}
          </span>
          <strong className='text-xl'>
            {estimatedQuota > 0 ? formatQuota(estimatedQuota) : '—'}
          </strong>
        </div>
      </CardContent>
      <CardFooter className='bg-background/40 flex items-end justify-between gap-4 border-t pt-5'>
        <div>
          <p className='text-muted-foreground text-xs'>{t('Amount')}</p>
          <strong className='text-2xl'>
            {amountIsValid
              ? formatCurrency(amountMinor, props.sku.currency)
              : '—'}
          </strong>
        </div>
        <Button
          disabled={!amountIsValid || props.loading}
          onClick={() => props.onPurchase(props.sku, amountMinor)}
        >
          {props.loading ? t('Processing') : t('Recharge now')}
        </Button>
      </CardFooter>
    </Card>
  )
}
