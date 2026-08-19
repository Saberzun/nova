/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { CircleAlert } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { SectionPageLayout } from '@/components/layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'

import {
  cancelStoreOrder,
  createCorporateTransferOrder,
  createStoreOrder,
  dismissStoreNotice,
  getStoreNotice,
  getStoreOrders,
  getStoreProducts,
  getTopupInfo,
  getGiftSelf,
  getCorporateTransferAvailability,
  payStoreOrderEpay,
} from './api'
import { StoreNoticeDialog } from './components/store-notice-dialog'
import { StoreRechargeCard } from './components/store-recharge-card'
import { StoreSubscriptionComparison } from './components/store-subscription-comparison'
import { corporateTransferStatusKey } from './corporate-transfer-status'
import { formatDate, submitEpayForm } from './lib'
import { buildStoreCatalog } from './store-catalog'
import { buildStorePaymentMethods } from './store-payment-methods'
import type { ProductOrder, ProductSKU } from './types'

interface EntitlementStoreProps {
  initialPaymentResult?: 'success' | 'fail'
}

function storeOrderStatusKey(order: ProductOrder): string {
  if (order.corporate_transfer_status) {
    return corporateTransferStatusKey(order.corporate_transfer_status)
  }
  if (order.status === 'pending') {
    return 'Pending payment'
  }
  return order.status
}

export function EntitlementStore(props: EntitlementStoreProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [paymentMethod, setPaymentMethod] = useState('')
  const [giftAmountYuan, setGiftAmountYuan] = useState('0.00')
  const [noticeOpen, setNoticeOpen] = useState(false)
  const autoOpenedRevision = useRef<number | null>(null)
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
  const corporateTransferAvailability = useQuery({
    queryKey: ['entitlement-store', 'corporate-transfer-availability'],
    queryFn: getCorporateTransferAvailability,
  })
  const gift = useQuery({
    queryKey: ['entitlement-store', 'gift'],
    queryFn: getGiftSelf,
  })
  const storeNotice = useQuery({
    queryKey: ['entitlement-store', 'notice'],
    queryFn: getStoreNotice,
    retry: 1,
  })
  const catalog = useMemo(
    () => buildStoreCatalog(products.data?.data ?? []),
    [products.data?.data]
  )

  const availableMethods = buildStorePaymentMethods(
    payment.data?.data?.pay_methods ?? [],
    corporateTransferAvailability.data?.data?.available === true,
    t('Corporate Transfer')
  )
  const effectivePaymentMethod =
    paymentMethod || availableMethods[0]?.type || ''
  let catalogEmptyMessage = t('No available SKU')
  if (products.isPending) catalogEmptyMessage = t('Loading products...')
  if (products.isError) catalogEmptyMessage = t('Failed to load products')
  useEffect(() => {
    if (props.initialPaymentResult === 'success') {
      toast.success(t('Payment succeeded and quota has been granted'))
      void queryClient.invalidateQueries({ queryKey: ['entitlement-store'] })
    } else if (props.initialPaymentResult === 'fail') {
      toast.error(t('Payment was not completed'))
    }
  }, [props.initialPaymentResult, queryClient, t])
  useEffect(() => {
    const notice = storeNotice.data?.data
    if (
      props.initialPaymentResult ||
      !notice?.published ||
      notice.dismissed ||
      autoOpenedRevision.current === notice.revision
    ) {
      return
    }
    autoOpenedRevision.current = notice.revision
    setNoticeOpen(true)
  }, [props.initialPaymentResult, storeNotice.data?.data])
  const dismissNotice = useMutation({
    mutationFn: async () => {
      const notice = storeNotice.data?.data
      if (!notice?.published) {
        throw new Error(t('Store notice is not available'))
      }
      const response = await dismissStoreNotice(notice.revision)
      if (!response.success) {
        throw new Error(response.message || t('Failed to save your preference'))
      }
    },
    onSuccess: async () => {
      setNoticeOpen(false)
      await queryClient.invalidateQueries({
        queryKey: ['entitlement-store', 'notice'],
      })
    },
    onError: (error) => toast.error(error.message),
  })
  const purchase = useMutation({
    mutationFn: async (input: {
      sku: ProductSKU
      quantity: number
      amountMinor?: number
    }) => {
      const expectedAmount =
        input.amountMinor ?? input.sku.price_amount_minor * input.quantity
      const requestedGiftCents = Math.round(Number(giftAmountYuan || '0') * 100)
      if (!Number.isFinite(requestedGiftCents) || requestedGiftCents < 0) {
        throw new Error(t('Invalid gift amount'))
      }
      const giftDiscountCents = Math.max(
        0,
        Math.min(
          requestedGiftCents,
          gift.data?.data?.account.available_cents ?? 0,
          expectedAmount
        )
      )
      if (expectedAmount - giftDiscountCents > 0 && !effectivePaymentMethod) {
        throw new Error(t('No online payment method is available'))
      }

      if (
        effectivePaymentMethod === 'corporate_transfer' &&
        expectedAmount - giftDiscountCents > 0
      ) {
        const priorOrderNo = sessionStorage.getItem(
          'corporate-transfer-prior-order'
        )
        const transferResponse = await createCorporateTransferOrder(
          {
            sku_id: input.sku.id,
            quantity: input.quantity,
            amount_minor: input.amountMinor,
            gift_discount_cents: giftDiscountCents,
            prior_order_no: priorOrderNo || undefined,
          },
          crypto.randomUUID()
        )
        if (!transferResponse.success || !transferResponse.data) {
          throw new Error(
            transferResponse.message || t('Order creation failed')
          )
        }
        sessionStorage.removeItem('corporate-transfer-prior-order')
        return {
          kind: 'corporate' as const,
          ticketNo: transferResponse.data.ticket.ticket_no,
        }
      }
      const orderResponse = await createStoreOrder({
        sku_id: input.sku.id,
        quantity: input.quantity,
        amount_minor: input.amountMinor,
        gift_discount_cents: giftDiscountCents,
      })
      if (!orderResponse.success || !orderResponse.data) {
        throw new Error(orderResponse.message || t('Order creation failed'))
      }
      if (orderResponse.data.cash_payable_cents === 0) {
        return {
          kind:
            orderResponse.data.gift_discount_cents > 0
              ? ('gift' as const)
              : ('free' as const),
        }
      }
      const epay = await payStoreOrderEpay(
        orderResponse.data.order_no,
        effectivePaymentMethod
      )
      if (epay.message !== 'success' || !epay.url || !epay.data) {
        throw new Error(epay.message || t('Payment request failed'))
      }
      submitEpayForm(epay.url, epay.data)
      return { kind: 'payment' as const }
    },
    onSuccess: async (result) => {
      setGiftAmountYuan('0.00')
      await queryClient.invalidateQueries({
        queryKey: ['entitlement-store', 'orders'],
      })
      await queryClient.invalidateQueries({
        queryKey: ['entitlement-store', 'gift'],
      })
      if (result.kind === 'corporate') {
        toast.success(t('Corporate transfer application created'))
        await navigate({
          to: '/tickets/$ticketNo',
          params: { ticketNo: result.ticketNo },
        })
        return
      }
      toast.success(
        result.kind === 'free' || result.kind === 'gift'
          ? t('Entitlement granted')
          : t('Payment initiated')
      )
    },
    onError: (error) => toast.error(error.message),
  })
  const resumePayment = useMutation({
    mutationFn: async (orderNo: string) => {
      if (!effectivePaymentMethod) {
        throw new Error(t('No online payment method is available'))
      }
      const epay = await payStoreOrderEpay(orderNo, effectivePaymentMethod)
      if (epay.message !== 'success' || !epay.url || !epay.data) {
        throw new Error(epay.message || t('Payment request failed'))
      }
      submitEpayForm(epay.url, epay.data)
    },
    onError: (error) => toast.error(error.message),
  })
  const cancelOrder = useMutation({
    mutationFn: cancelStoreOrder,
    onSuccess: async (response) => {
      if (!response.success) {
        toast.error(response.message || t('Operation failed'))
        return
      }
      await queryClient.invalidateQueries({
        queryKey: ['entitlement-store', 'orders'],
      })
      toast.success(t('Order cancelled'))
    },
  })

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Quota Store')}</SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        {storeNotice.data?.data?.published ? (
          <Button
            type='button'
            variant='outline'
            onClick={() => setNoticeOpen(true)}
          >
            <CircleAlert className='mr-2 size-4' />
            {t('View Store Notice')}
          </Button>
        ) : null}
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
        <>
          <div className='space-y-8'>
            {!corporateTransferAvailability.isPending &&
            !corporateTransferAvailability.data?.data?.available ? (
              <p className='rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-300'>
                {t(
                  'Corporate transfer is temporarily unavailable because collection information has not been published.'
                )}
              </p>
            ) : null}
            <Card>
              <CardContent className='grid gap-4 pt-6 md:grid-cols-[1fr_220px] md:items-end'>
                <div>
                  <p className='text-sm font-medium'>{t('Gift balance')}</p>
                  <p className='mt-1 text-2xl font-semibold'>
                    {new Intl.NumberFormat(undefined, {
                      style: 'currency',
                      currency: 'CNY',
                    }).format(
                      (gift.data?.data?.account.available_cents ?? 0) / 100
                    )}
                  </p>
                  <p className='text-muted-foreground mt-1 text-sm'>
                    {t(
                      'Gift balance can offset subscription and recharge purchases, but cannot be used directly for API calls.'
                    )}
                  </p>
                </div>
                <label className='grid gap-2 text-sm'>
                  <span>{t('Gift amount for next purchase')}</span>
                  <Input
                    type='number'
                    min='0'
                    max={(gift.data?.data?.account.available_cents ?? 0) / 100}
                    step='0.01'
                    value={giftAmountYuan}
                    disabled={!gift.data?.data?.settings.checkout_enabled}
                    onChange={(event) => setGiftAmountYuan(event.target.value)}
                    onBlur={(event) => {
                      const requestedYuan = Number(event.target.value)
                      const availableCents =
                        gift.data?.data?.account.available_cents ?? 0
                      const normalizedCents = Number.isFinite(requestedYuan)
                        ? Math.max(
                            0,
                            Math.min(
                              Math.round(requestedYuan * 100),
                              availableCents
                            )
                          )
                        : 0
                      setGiftAmountYuan((normalizedCents / 100).toFixed(2))
                    }}
                  />
                </label>
              </CardContent>
            </Card>
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
                <div className='grid gap-4 lg:grid-cols-2'>
                  {catalog.recharge.map((item) => (
                    <StoreRechargeCard
                      key={item.sku.id}
                      product={item.product}
                      sku={item.sku}
                      loading={purchase.isPending}
                      onPurchase={(sku, amountMinor) =>
                        purchase.mutate({
                          sku,
                          quantity: 1,
                          amountMinor,
                        })
                      }
                    />
                  ))}
                </div>
              ) : (
                <p className='text-muted-foreground rounded-xl border border-dashed p-6 text-sm'>
                  {catalogEmptyMessage}
                </p>
              )}
            </section>

            <section
              className='space-y-4'
              aria-labelledby='subscription-heading'
            >
              <div>
                <h2 id='subscription-heading' className='text-xl font-semibold'>
                  {t('Subscription quota')}
                </h2>
                <p className='text-muted-foreground mt-1 text-sm'>
                  {t(
                    'Choose a subscription SKU that matches your quota needs.'
                  )}
                </p>
              </div>
              {catalog.subscription.length > 0 ? (
                <StoreSubscriptionComparison
                  items={catalog.subscription}
                  loading={purchase.isPending}
                  onPurchase={(sku, quantity) =>
                    purchase.mutate({ sku, quantity })
                  }
                />
              ) : (
                <p className='text-muted-foreground rounded-xl border border-dashed p-6 text-sm'>
                  {catalogEmptyMessage}
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
                      <th className='p-3'>{t('Actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(orders.data?.data ?? []).map((order) => (
                      <tr key={order.id} className='border-t'>
                        <td className='p-3 font-mono text-xs'>
                          {order.order_no}
                        </td>
                        <td className='p-3'>
                          {order.items
                            ?.map((item) => item.sku_name)
                            .join(', ') || '—'}
                        </td>
                        <td className='p-3'>
                          <div>
                            {new Intl.NumberFormat(undefined, {
                              style: 'currency',
                              currency: order.currency || 'CNY',
                            }).format(
                              (order.cash_payable_cents ||
                                order.total_amount_minor) / 100
                            )}
                            {order.gift_discount_cents > 0 ? (
                              <p className='text-muted-foreground text-xs'>
                                {t('Gift discount')}{' '}
                                {new Intl.NumberFormat(undefined, {
                                  style: 'currency',
                                  currency: 'CNY',
                                }).format(order.gift_discount_cents / 100)}
                              </p>
                            ) : null}
                          </div>
                        </td>
                        <td className='p-3'>
                          <Badge variant='secondary'>
                            {t(storeOrderStatusKey(order))}
                          </Badge>
                        </td>
                        <td className='p-3'>{formatDate(order.created_at)}</td>
                        <td className='p-3'>
                          {order.status === 'pending' ? (
                            <div className='flex gap-2'>
                              {order.payment_provider !==
                              'corporate_transfer' ? (
                                <Button
                                  size='sm'
                                  disabled={resumePayment.isPending}
                                  onClick={() =>
                                    resumePayment.mutate(order.order_no)
                                  }
                                >
                                  {t('Pay now')}
                                </Button>
                              ) : (
                                <Button
                                  size='sm'
                                  variant='outline'
                                  onClick={() =>
                                    order.corporate_ticket_no
                                      ? navigate({
                                          to: '/tickets/$ticketNo',
                                          params: {
                                            ticketNo: order.corporate_ticket_no,
                                          },
                                        })
                                      : navigate({ to: '/tickets' })
                                  }
                                >
                                  {t('View ticket')}
                                </Button>
                              )}
                              {!order.payment_provider ? (
                                <Button
                                  size='sm'
                                  variant='outline'
                                  disabled={cancelOrder.isPending}
                                  onClick={() =>
                                    cancelOrder.mutate(order.order_no)
                                  }
                                >
                                  {t('Cancel')}
                                </Button>
                              ) : null}
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
          {storeNotice.data?.data?.published ? (
            <StoreNoticeDialog
              open={noticeOpen}
              onOpenChange={setNoticeOpen}
              content={storeNotice.data.data.content}
              dismissing={dismissNotice.isPending}
              onDismissRevision={() => dismissNotice.mutate()}
            />
          ) : null}
        </>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
