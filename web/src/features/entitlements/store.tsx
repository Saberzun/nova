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
import { getUserGroups } from '@/lib/api'

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
import { StoreCheckoutDialog } from './components/store-checkout-dialog'
import { StoreNoticeDialog } from './components/store-notice-dialog'
import { StoreRechargeCard } from './components/store-recharge-card'
import { StoreSubscriptionComparison } from './components/store-subscription-comparison'
import { corporateTransferStatusKey } from './corporate-transfer-status'
import { formatDate, submitEpayForm } from './lib'
import { buildStoreCatalog } from './store-catalog'
import { buildStoreCheckout, type StorePaymentChannel } from './store-checkout'
import type { ProductOrder, ProductSKU } from './types'

interface EntitlementStoreProps {
  initialPaymentResult?: 'success' | 'fail'
}

interface PendingPurchase {
  sku: ProductSKU
  quantity: number
  amountMinor?: number
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
  const [pendingPurchase, setPendingPurchase] =
    useState<PendingPurchase | null>(null)
  const [paymentChannel, setPaymentChannel] =
    useState<StorePaymentChannel>('online')
  const [onlinePaymentMethod, setOnlinePaymentMethod] = useState('')
  const [useGift, setUseGift] = useState(false)
  const [noticeOpen, setNoticeOpen] = useState(false)
  const autoOpenedRevision = useRef<number | null>(null)
  const products = useQuery({
    queryKey: ['entitlement-store', 'products'],
    queryFn: getStoreProducts,
  })
  const groupRatios = useQuery({
    queryKey: ['entitlement-store', 'group-ratios'],
    queryFn: getUserGroups,
    staleTime: 5 * 60 * 1000,
    select: (response) => {
      if (!response.success || !response.data) return {}
      return Object.fromEntries(
        Object.entries(response.data).flatMap(([group, info]) =>
          typeof info.ratio === 'number' ? [[group, info.ratio]] : []
        )
      )
    },
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

  const onlinePaymentMethods = payment.data?.data?.pay_methods ?? []
  const effectiveOnlinePaymentMethod =
    onlinePaymentMethod || onlinePaymentMethods[0]?.type || ''
  const onlinePaymentReady =
    payment.data?.data?.enable_online_topup === true &&
    effectiveOnlinePaymentMethod !== ''
  const corporateTransferAvailable =
    corporateTransferAvailability.data?.data?.available === true
  const paymentChannelReady =
    paymentChannel === 'online'
      ? onlinePaymentReady
      : corporateTransferAvailable
  const pendingOrderAmount = pendingPurchase
    ? (pendingPurchase.amountMinor ??
      pendingPurchase.sku.price_amount_minor * pendingPurchase.quantity)
    : 0
  const checkout = buildStoreCheckout(
    pendingOrderAmount,
    useGift && gift.data?.data?.settings.checkout_enabled === true,
    gift.data?.data?.account.available_cents ?? 0,
    paymentChannelReady
  )
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
      paymentChannel: StorePaymentChannel
      onlinePaymentMethod: string
      useGift: boolean
    }) => {
      const expectedAmount =
        input.amountMinor ?? input.sku.price_amount_minor * input.quantity
      const inputPaymentReady =
        input.paymentChannel === 'online'
          ? payment.data?.data?.enable_online_topup === true &&
            input.onlinePaymentMethod !== ''
          : corporateTransferAvailable
      const purchaseCheckout = buildStoreCheckout(
        expectedAmount,
        input.useGift && gift.data?.data?.settings.checkout_enabled === true,
        gift.data?.data?.account.available_cents ?? 0,
        inputPaymentReady
      )
      const giftDiscountCents = purchaseCheckout.giftDiscountCents
      if (!purchaseCheckout.canConfirm) {
        throw new Error(t('No online payment method is available'))
      }

      if (
        input.paymentChannel === 'corporate_transfer' &&
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
        input.onlinePaymentMethod
      )
      if (epay.message !== 'success' || !epay.url || !epay.data) {
        throw new Error(epay.message || t('Payment request failed'))
      }
      submitEpayForm(epay.url, epay.data)
      return { kind: 'payment' as const }
    },
    onSuccess: async (result) => {
      setPendingPurchase(null)
      setPaymentChannel('online')
      setOnlinePaymentMethod('')
      setUseGift(false)
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
      const resumeOnlinePaymentMethod = onlinePaymentMethods[0]?.type
      if (!onlinePaymentReady || !resumeOnlinePaymentMethod) {
        throw new Error(t('No online payment method is available'))
      }
      const epay = await payStoreOrderEpay(orderNo, resumeOnlinePaymentMethod)
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
                      onPurchase={(sku, amountMinor) => {
                        setPaymentChannel('online')
                        setOnlinePaymentMethod('')
                        setUseGift(false)
                        setPendingPurchase({
                          sku,
                          quantity: 1,
                          amountMinor,
                        })
                      }}
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
                  groupRatios={groupRatios.data ?? {}}
                  onPurchase={(sku, quantity) => {
                    setPaymentChannel('online')
                    setOnlinePaymentMethod('')
                    setUseGift(false)
                    setPendingPurchase({ sku, quantity })
                  }}
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
          <StoreCheckoutDialog
            open={pendingPurchase !== null}
            sku={pendingPurchase?.sku ?? null}
            quantity={pendingPurchase?.quantity ?? 1}
            amountMinor={pendingPurchase?.amountMinor}
            paymentChannel={paymentChannel}
            onlinePaymentMethods={onlinePaymentMethods}
            onlinePaymentMethod={effectiveOnlinePaymentMethod}
            onlinePaymentReady={onlinePaymentReady}
            epayMissingConfiguration={
              payment.data?.data?.epay_missing_configuration ?? []
            }
            corporateTransferAvailable={corporateTransferAvailable}
            availableGiftCents={gift.data?.data?.account.available_cents ?? 0}
            giftCheckoutEnabled={
              gift.data?.data?.settings.checkout_enabled === true
            }
            useGift={useGift}
            checkout={checkout}
            loading={purchase.isPending}
            onOpenChange={(open) => {
              if (!open && !purchase.isPending) {
                setPendingPurchase(null)
                setPaymentChannel('online')
                setOnlinePaymentMethod('')
                setUseGift(false)
              }
            }}
            onPaymentChannelChange={setPaymentChannel}
            onOnlinePaymentMethodChange={setOnlinePaymentMethod}
            onUseGiftChange={setUseGift}
            onConfirm={() => {
              if (!pendingPurchase) return
              purchase.mutate({
                ...pendingPurchase,
                paymentChannel,
                onlinePaymentMethod: effectiveOnlinePaymentMethod,
                useGift,
              })
            }}
          />
        </>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
