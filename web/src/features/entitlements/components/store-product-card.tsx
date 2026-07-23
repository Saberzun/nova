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
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { formatQuota } from '@/lib/format'

import type { Product, ProductSKU } from '../types'

interface StoreProductCardProps {
  product: Product
  loading: boolean
  onPurchase: (sku: ProductSKU, quantity: number) => void
}

export function StoreProductCard(props: StoreProductCardProps) {
  const { t } = useTranslation()
  const skus = props.product.skus ?? []
  const [skuId, setSkuId] = useState(skus[0]?.id ?? 0)
  const [quantity, setQuantity] = useState(1)
  const selectedSKU = skus.find((sku) => sku.id === skuId) ?? skus[0]

  return (
    <Card className='h-full'>
      <CardHeader>
        <div className='flex items-center justify-between gap-3'>
          <CardTitle>{props.product.name}</CardTitle>
          <Badge variant='secondary'>
            {props.product.category === 'subscription'
              ? t('Subscription quota')
              : t('Recharge quota')}
          </Badge>
        </div>
        <CardDescription>{props.product.description}</CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        {skus.length === 0 ? (
          <p className='text-muted-foreground'>{t('No available SKU')}</p>
        ) : (
          <>
            <label className='grid gap-2'>
              <span className='text-sm font-medium'>{t('SKU')}</span>
              <NativeSelect
                className='w-full'
                value={selectedSKU?.id ?? 0}
                onChange={(event) => setSkuId(Number(event.target.value))}
              >
                {skus.map((sku) => (
                  <NativeSelectOption key={sku.id} value={sku.id}>
                    {sku.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </label>
            {selectedSKU ? (
              <div className='bg-muted/50 grid gap-2 rounded-lg p-3 text-sm'>
                <div className='flex justify-between gap-4'>
                  <span className='text-muted-foreground'>
                    {t('Total quota')}
                  </span>
                  <span>{formatQuota(selectedSKU.grant_total_quota)}</span>
                </div>
                <div className='flex justify-between gap-4'>
                  <span className='text-muted-foreground'>
                    {t('Daily quota')}
                  </span>
                  <span>
                    {selectedSKU.grant_daily_quota > 0
                      ? formatQuota(selectedSKU.grant_daily_quota)
                      : t('Unlimited')}
                  </span>
                </div>
                <div className='flex justify-between gap-4'>
                  <span className='text-muted-foreground'>{t('Validity')}</span>
                  <span>
                    {selectedSKU.validity_seconds > 0
                      ? t('{{days}} days', {
                          days: Math.ceil(selectedSKU.validity_seconds / 86400),
                        })
                      : t('Never expires')}
                  </span>
                </div>
              </div>
            ) : null}
            {selectedSKU?.multi_quantity_enabled ? (
              <label className='grid gap-2'>
                <span className='text-sm font-medium'>{t('Quantity')}</span>
                <Input
                  type='number'
                  min={1}
                  max={100}
                  value={quantity}
                  onChange={(event) =>
                    setQuantity(Math.max(1, Number(event.target.value) || 1))
                  }
                />
              </label>
            ) : null}
          </>
        )}
      </CardContent>
      <CardFooter className='mt-auto justify-between gap-3'>
        <strong>
          {selectedSKU
            ? new Intl.NumberFormat(undefined, {
                style: 'currency',
                currency: selectedSKU.currency || 'CNY',
              }).format((selectedSKU.price_amount_minor * quantity) / 100)
            : '—'}
        </strong>
        <Button
          disabled={!selectedSKU || props.loading}
          onClick={() => selectedSKU && props.onPurchase(selectedSKU, quantity)}
        >
          {props.loading ? t('Processing') : t('Buy now')}
        </Button>
      </CardFooter>
    </Card>
  )
}
