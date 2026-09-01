/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import { CheckCircle2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatQuota } from '@/lib/format'

import {
  formatAccessGroupLabel,
  getSKUAccessGroups,
  isSKUAvailable,
  maximumSKUQuantity,
  type StoreCatalogItem,
} from '../store-catalog'
import type { ProductSKU } from '../types'
import { StoreSKUCard } from './store-sku-card'

interface StoreSubscriptionComparisonProps {
  items: StoreCatalogItem[]
  loading: boolean
  onPurchase: (sku: ProductSKU, quantity: number) => void
  groupRatios?: Record<string, number>
}

function formatValidity(
  t: ReturnType<typeof useTranslation>['t'],
  seconds: number
): string {
  if (seconds <= 0) return t('Never expires')
  return t('{{days}} days', { days: Math.ceil(seconds / 86400) })
}

function getActivationLabelKey(
  activationPolicy: ProductSKU['activation_policy']
): string {
  if (activationPolicy === 'manual') return 'Manual activation'
  if (activationPolicy === 'deferred') return 'Deferred'
  return 'Immediate'
}

export function StoreSubscriptionComparison(
  props: StoreSubscriptionComparisonProps
) {
  const { t } = useTranslation()
  const [quantities, setQuantities] = useState<Record<number, number>>({})

  return (
    <>
      <div className='space-y-3 md:hidden'>
        {props.items.map((item) => (
          <StoreSKUCard
            key={item.sku.id}
            product={item.product}
            sku={item.sku}
            loading={props.loading}
            onPurchase={props.onPurchase}
            groupRatios={props.groupRatios}
          />
        ))}
      </div>

      <div className='hidden overflow-x-auto rounded-2xl border md:block'>
        <table className='w-full min-w-[980px] text-sm'>
          <thead className='bg-muted/50 text-left'>
            <tr className='border-b'>
              <th className='px-5 py-4 font-semibold'>{t('Plan')}</th>
              <th className='px-4 py-4 font-semibold'>
                {t('Available groups')}
              </th>
              <th className='px-4 py-4 font-semibold'>{t('Quota')}</th>
              <th className='px-4 py-4 font-semibold'>{t('Cycle')}</th>
              <th className='px-4 py-4 font-semibold'>{t('Price')}</th>
              <th className='px-4 py-4 font-semibold'>{t('Quantity')}</th>
              <th className='px-5 py-4 text-right font-semibold'>
                {t('Actions')}
              </th>
            </tr>
          </thead>
          <tbody>
            {props.items.map((item) => {
              const groups = getSKUAccessGroups(item.sku)
              const soldOut = !isSKUAvailable(item.sku)
              const maximumQuantity = Math.max(1, maximumSKUQuantity(item.sku))
              const quantity = quantities[item.sku.id] ?? 1
              const totalAmount = item.sku.price_amount_minor * quantity
              let actionLabel = t('Select plan')
              if (props.loading) actionLabel = t('Processing')
              if (soldOut) actionLabel = t('Sold out')

              return (
                <tr
                  key={item.sku.id}
                  className='hover:bg-muted/25 border-b transition-colors last:border-b-0'
                >
                  <td className='max-w-72 px-5 py-5 align-top'>
                    <div className='flex items-start gap-3'>
                      <span className='mt-1 flex size-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-300'>
                        <CheckCircle2 className='size-4' />
                      </span>
                      <div>
                        <p className='text-muted-foreground text-xs font-medium'>
                          {item.product.name}
                        </p>
                        <p className='mt-1 text-base font-semibold'>
                          {item.sku.name}
                        </p>
                        {item.product.description ? (
                          <p className='text-muted-foreground mt-1 line-clamp-2 text-xs leading-5'>
                            {item.product.description}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className='max-w-56 px-4 py-5 align-top'>
                    <div className='flex flex-wrap gap-1.5'>
                      {groups.length > 0 ? (
                        groups.map((group) => (
                          <Badge key={group} variant='secondary'>
                            {formatAccessGroupLabel(
                              group,
                              props.groupRatios ?? {}
                            )}
                          </Badge>
                        ))
                      ) : (
                        <span className='text-muted-foreground'>
                          {t('No groups configured')}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className='px-4 py-5 align-top'>
                    <p className='font-semibold'>
                      {formatQuota(item.sku.grant_total_quota)}
                    </p>
                    <p className='text-muted-foreground mt-1 text-xs'>
                      {item.sku.grant_daily_quota > 0
                        ? t('{{quota}} per day', {
                            quota: formatQuota(item.sku.grant_daily_quota),
                          })
                        : t('No daily limit')}
                    </p>
                  </td>
                  <td className='px-4 py-5 align-top'>
                    <p className='font-medium'>
                      {formatValidity(t, item.sku.validity_seconds)}
                    </p>
                    <p className='text-muted-foreground mt-1 text-xs'>
                      {t(getActivationLabelKey(item.sku.activation_policy))}
                    </p>
                  </td>
                  <td className='px-4 py-5 align-top'>
                    <p className='text-lg font-semibold'>
                      {new Intl.NumberFormat(undefined, {
                        style: 'currency',
                        currency: item.sku.currency || 'CNY',
                      }).format(totalAmount / 100)}
                    </p>
                  </td>
                  <td className='px-4 py-5 align-top'>
                    {item.sku.multi_quantity_enabled ? (
                      <Input
                        className='h-9 w-20'
                        aria-label={t('Quantity for {{name}}', {
                          name: item.sku.name,
                        })}
                        type='number'
                        min={1}
                        max={maximumQuantity}
                        value={quantity}
                        onChange={(event) => {
                          const nextQuantity = Math.min(
                            maximumQuantity,
                            Math.max(1, Number(event.target.value) || 1)
                          )
                          setQuantities((current) => ({
                            ...current,
                            [item.sku.id]: nextQuantity,
                          }))
                        }}
                      />
                    ) : (
                      <span className='text-muted-foreground'>1</span>
                    )}
                  </td>
                  <td className='px-5 py-5 text-right align-top'>
                    <Button
                      className='rounded-xl'
                      disabled={soldOut || props.loading}
                      onClick={() => props.onPurchase(item.sku, quantity)}
                    >
                      {actionLabel}
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
