/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { SectionPageLayout } from '@/components/layout'
import { Badge } from '@/components/ui/badge'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'

import {
  createStoreOrder,
  getStoreOrders,
  getStoreProducts,
  getTopupInfo,
  payStoreOrderEpay,
} from './api'
import { StoreSKUCard } from './components/store-sku-card'
import { formatDate, submitEpayForm } from './lib'
import { buildStoreCatalog } from './store-catalog'
import type { ProductSKU } from './types'

export function EntitlementStore() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [paymentMethod, setPaymentMethod] = useState('')
  const products = useQuery({
    queryKey: ['entitlement-store', 'products'],
    queryFn: getStoreProducts,
  })
  const orders = useQuery({
    queryKey: ['entitlement-store', 'orders'],
    queryFn: getStoreOrders,
  })
  const payment = useQuery({
    queryKey: ['entitlement-store', 'payment-methods'],
    queryFn: getTopupInfo,
  })
  const catalog = useMemo(
    () => buildStoreCatalog(products.data?.data ?? []),
    [products.data?.data]
  )

  const availableMethods = payment.data?.data?.pay_methods ?? []
  const effectivePaymentMethod =
    paymentMethod || availableMethods[0]?.type || ''
  const purchase = useMutation({
    mutationFn: async (input: { sku: ProductSKU; quantity: number }) => {
      const orderResponse = await createStoreOrder({
        sku_id: input.sku.id,
        quantity: input.quantity,
      })
      if (!orderResponse.success || !orderResponse.data) {
        throw new Error(orderResponse.message || t('Order creation failed'))
      }
      if (orderResponse.data.total_amount_minor === 0) {
        return 'free'
      }
      if (!effectivePaymentMethod) {
        throw new Error(t('No online payment method is available'))
      }
      const epay = await payStoreOrderEpay(
        orderResponse.data.order_no,
        effectivePaymentMethod
      )
      if (epay.message !== 'success' || !epay.url || !epay.data) {
        throw new Error(epay.message || t('Payment request failed'))
      }
      submitEpayForm(epay.url, epay.data)
      return 'payment'
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({
        queryKey: ['entitlement-store', 'orders'],
      })
      toast.success(
        result === 'free' ? t('Entitlement granted') : t('Payment initiated')
      )
    },
    onError: (error) => toast.error(error.message),
  })

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Quota Store')}</SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        {availableMethods.length > 0 ? (
          <NativeSelect
            value={effectivePaymentMethod}
            onChange={(event) => setPaymentMethod(event.target.value)}
            aria-label={t('Payment method')}
          >
            {availableMethods.map((method) => (
              <NativeSelectOption key={method.type} value={method.type}>
                {method.name || method.type}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        ) : null}
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <div className='space-y-8'>
          <section className='space-y-4' aria-labelledby='recharge-heading'>
            <div>
              <h2 id='recharge-heading' className='text-xl font-semibold'>
                {t('Recharge quota')}
              </h2>
              <p className='text-muted-foreground mt-1 text-sm'>
                {t(
                  'Recharge quota is available for pay-as-you-go access after purchase.'
                )}
              </p>
            </div>
            {catalog.recharge.length > 0 ? (
              <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
                {catalog.recharge.map((item) => (
                  <StoreSKUCard
                    key={item.sku.id}
                    product={item.product}
                    sku={item.sku}
                    featured
                    loading={purchase.isPending}
                    onPurchase={(sku, quantity) =>
                      purchase.mutate({ sku, quantity })
                    }
                  />
                ))}
              </div>
            ) : (
              <p className='text-muted-foreground rounded-xl border border-dashed p-6 text-sm'>
                {t('No available SKU')}
              </p>
            )}
          </section>

          <section className='space-y-4' aria-labelledby='subscription-heading'>
            <div>
              <h2 id='subscription-heading' className='text-xl font-semibold'>
                {t('Subscription quota')}
              </h2>
              <p className='text-muted-foreground mt-1 text-sm'>
                {t('Choose a subscription SKU that matches your quota needs.')}
              </p>
            </div>
            {catalog.subscription.length > 0 ? (
              <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
                {catalog.subscription.map((item) => (
                  <StoreSKUCard
                    key={item.sku.id}
                    product={item.product}
                    sku={item.sku}
                    loading={purchase.isPending}
                    onPurchase={(sku, quantity) =>
                      purchase.mutate({ sku, quantity })
                    }
                  />
                ))}
              </div>
            ) : (
              <p className='text-muted-foreground rounded-xl border border-dashed p-6 text-sm'>
                {t('No available SKU')}
              </p>
            )}
          </section>
          <section className='space-y-3'>
            <h2 className='text-lg font-semibold'>{t('Recent orders')}</h2>
            <div className='overflow-x-auto rounded-xl border'>
              <table className='w-full text-sm'>
                <thead className='bg-muted/50 text-left'>
                  <tr>
                    <th className='p-3'>{t('Order number')}</th>
                    <th className='p-3'>{t('Product')}</th>
                    <th className='p-3'>{t('Amount')}</th>
                    <th className='p-3'>{t('Status')}</th>
                    <th className='p-3'>{t('Created at')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(orders.data?.data ?? []).map((order) => (
                    <tr key={order.id} className='border-t'>
                      <td className='p-3 font-mono text-xs'>
                        {order.order_no}
                      </td>
                      <td className='p-3'>
                        {order.items?.map((item) => item.sku_name).join(', ') ||
                          '—'}
                      </td>
                      <td className='p-3'>
                        {new Intl.NumberFormat(undefined, {
                          style: 'currency',
                          currency: order.currency || 'CNY',
                        }).format(order.total_amount_minor / 100)}
                      </td>
                      <td className='p-3'>
                        <Badge variant='secondary'>{t(order.status)}</Badge>
                      </td>
                      <td className='p-3'>{formatDate(order.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
