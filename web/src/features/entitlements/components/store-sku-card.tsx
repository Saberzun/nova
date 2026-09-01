/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import { useState } from 'react'
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

import {
  formatAccessGroupLabel,
  getSKUAccessGroups,
  isSKUAvailable,
  maximumSKUQuantity,
} from '../store-catalog'
import type { Product, ProductSKU } from '../types'

interface StoreSKUCardProps {
  product: Product
  sku: ProductSKU
  loading: boolean
  onPurchase: (sku: ProductSKU, quantity: number) => void
  groupRatios?: Record<string, number>
}

function getActivationLabelKey(policy: ProductSKU['activation_policy']) {
  if (policy === 'immediate') return 'Immediate'
  if (policy === 'manual') return 'Manual activation'
  return 'Deferred'
}

export function StoreSKUCard(props: StoreSKUCardProps) {
  const { t } = useTranslation()
  const [quantity, setQuantity] = useState(1)
  const totalAmount = props.sku.price_amount_minor * quantity
  const soldOut = !isSKUAvailable(props.sku)
  const maximumQuantity = Math.max(1, maximumSKUQuantity(props.sku))
  const accessGroups = getSKUAccessGroups(props.sku)
  let actionLabel = t('Buy now')
  if (props.loading) actionLabel = t('Processing')
  if (soldOut) actionLabel = t('Sold out')

  return (
    <Card className='flex h-full flex-col overflow-hidden'>
      <CardHeader className='space-y-3'>
        <div className='flex items-start justify-between gap-3'>
          <div className='min-w-0'>
            <p className='text-muted-foreground mb-1 truncate text-sm'>
              {props.product.name}
            </p>
            <CardTitle className='text-xl'>{props.sku.name}</CardTitle>
          </div>
          <Badge variant='secondary'>{t('Subscription quota')}</Badge>
        </div>
        {props.product.description ? (
          <p className='text-muted-foreground text-sm leading-6'>
            {props.product.description}
          </p>
        ) : null}
      </CardHeader>
      <CardContent className='flex-1 space-y-4'>
        <div>
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
        <div className='bg-background/70 grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border p-4 text-sm'>
          <div>
            <p className='text-muted-foreground'>{t('Total quota')}</p>
            <p className='mt-1 font-semibold'>
              {formatQuota(props.sku.grant_total_quota)}
            </p>
          </div>
          <div>
            <p className='text-muted-foreground'>{t('Daily quota')}</p>
            <p className='mt-1 font-semibold'>
              {props.sku.grant_daily_quota > 0
                ? formatQuota(props.sku.grant_daily_quota)
                : t('Unlimited')}
            </p>
          </div>
          <div>
            <p className='text-muted-foreground'>{t('Validity')}</p>
            <p className='mt-1 font-semibold'>
              {props.sku.validity_seconds > 0
                ? t('{{days}} days', {
                    days: Math.ceil(props.sku.validity_seconds / 86400),
                  })
                : t('Never expires')}
            </p>
          </div>
          <div>
            <p className='text-muted-foreground'>{t('Activation policy')}</p>
            <p className='mt-1 font-semibold'>
              {t(getActivationLabelKey(props.sku.activation_policy))}
            </p>
          </div>
        </div>
        {props.sku.multi_quantity_enabled ? (
          <label className='flex items-center justify-between gap-4'>
            <span className='text-sm font-medium'>{t('Quantity')}</span>
            <Input
              className='w-24'
              type='number'
              min={1}
              max={maximumQuantity}
              value={quantity}
              onChange={(event) =>
                setQuantity(
                  Math.min(
                    maximumQuantity,
                    Math.max(1, Number(event.target.value) || 1)
                  )
                )
              }
            />
          </label>
        ) : null}
      </CardContent>
      <CardFooter className='bg-background/40 flex items-end justify-between gap-4 border-t pt-5'>
        <div>
          <p className='text-muted-foreground text-xs'>{t('Amount')}</p>
          <strong className='text-2xl'>
            {new Intl.NumberFormat(undefined, {
              style: 'currency',
              currency: props.sku.currency || 'CNY',
            }).format(totalAmount / 100)}
          </strong>
        </div>
        <Button
          disabled={soldOut || props.loading}
          onClick={() => props.onPurchase(props.sku, quantity)}
        >
          {actionLabel}
        </Button>
      </CardFooter>
    </Card>
  )
}
