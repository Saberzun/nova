/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { formatQuota } from '@/lib/format'

import {
  adjustEntitlement,
  cancelProductOrder,
  completeProductOrder,
  getAdminOrders,
  getEntitlementAdjustments,
  getEntitlementTypes,
  getUserEntitlements,
  grantEntitlement,
  refundProductOrder,
  resetProductOrderPayment,
  revokeEntitlement,
} from '../api'
import { formatDate } from '../lib'

const grantSchema = z.object({
  user_id: z.number().int().positive(),
  entitlement_type_id: z.number().int().positive(),
  total_quota: z.number().int().positive(),
  daily_quota: z.number().int().min(0),
  validity_days: z.number().int().min(0),
})

const adjustmentSchema = z.object({
  entitlement_id: z.number().int().positive(),
  delta_quota: z
    .number()
    .int()
    .refine((value) => value !== 0),
  reason: z.string().trim().min(1),
})

type GrantForm = z.infer<typeof grantSchema>
type AdjustmentForm = z.infer<typeof adjustmentSchema>

export function AdminOperations() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [lookupUserId, setLookupUserId] = useState(0)
  const [orderPage, setOrderPage] = useState(1)
  const [orderStatus, setOrderStatus] = useState('')
  const [orderKeyword, setOrderKeyword] = useState('')
  const [orderUserId, setOrderUserId] = useState(0)
  const [adjustmentEntitlementId, setAdjustmentEntitlementId] = useState(0)
  const types = useQuery({
    queryKey: ['entitlement-admin', 'types'],
    queryFn: getEntitlementTypes,
  })
  const orders = useQuery({
    queryKey: [
      'entitlement-admin',
      'orders',
      orderPage,
      orderStatus,
      orderKeyword,
      orderUserId,
    ],
    queryFn: () =>
      getAdminOrders({
        page: orderPage,
        page_size: 20,
        status: orderStatus || undefined,
        keyword: orderKeyword || undefined,
        user_id: orderUserId || undefined,
      }),
  })
  const userEntitlements = useQuery({
    queryKey: ['entitlement-admin', 'user-entitlements', lookupUserId],
    queryFn: () => getUserEntitlements(lookupUserId),
    enabled: lookupUserId > 0,
  })
  const adjustments = useQuery({
    queryKey: [
      'entitlement-admin',
      'entitlement-adjustments',
      adjustmentEntitlementId,
    ],
    queryFn: () => getEntitlementAdjustments(adjustmentEntitlementId),
    enabled: adjustmentEntitlementId > 0,
  })
  const grantForm = useForm<GrantForm>({
    resolver: zodResolver(grantSchema),
    defaultValues: {
      user_id: 0,
      entitlement_type_id: 0,
      total_quota: 500000,
      daily_quota: 0,
      validity_days: 30,
    },
  })
  const adjustmentForm = useForm<AdjustmentForm>({
    resolver: zodResolver(adjustmentSchema),
    defaultValues: { entitlement_id: 0, delta_quota: 0, reason: '' },
  })
  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['entitlement-admin'] })
  }
  const grant = useMutation({
    mutationFn: (values: GrantForm) => {
      const type = types.data?.data?.find(
        (item) => item.id === values.entitlement_type_id
      )
      const now = Math.floor(Date.now() / 1000)
      return grantEntitlement(values.user_id, {
        entitlement_type_id: values.entitlement_type_id,
        total_quota: values.total_quota,
        daily_quota: values.daily_quota,
        expire_at:
          values.validity_days > 0 ? now + values.validity_days * 86400 : 0,
        asset_kind: type?.asset_kind ?? 'subscription',
        state: 'active',
        reset_timezone: 'Asia/Shanghai',
      })
    },
    onSuccess: async (response, values) => {
      if (!response.success) {
        toast.error(response.message || t('Operation failed'))
        return
      }
      setLookupUserId(values.user_id)
      await invalidate()
      toast.success(t('Entitlement granted'))
    },
  })
  const adjust = useMutation({
    mutationFn: (values: AdjustmentForm) =>
      adjustEntitlement(values.entitlement_id, {
        delta_quota: values.delta_quota,
        reason: values.reason,
        idempotency_key: `admin-${values.entitlement_id}-${Date.now()}`,
      }),
    onSuccess: async (response) => {
      if (!response.success) {
        toast.error(response.message || t('Operation failed'))
        return
      }
      await invalidate()
      toast.success(t('Entitlement adjusted'))
    },
  })
  const revoke = useMutation({
    mutationFn: revokeEntitlement,
    onSuccess: async (response) => {
      if (!response.success) {
        toast.error(response.message || t('Operation failed'))
        return
      }
      await invalidate()
      toast.success(t('Entitlement revoked'))
    },
  })
  const complete = useMutation({
    mutationFn: completeProductOrder,
    onSuccess: async (response) => {
      if (!response.success) {
        toast.error(response.message || t('Operation failed'))
        return
      }
      await invalidate()
      toast.success(t('Order fulfilled'))
    },
  })
  const cancelOrder = useMutation({
    mutationFn: (input: { orderNo: string; reason: string }) =>
      cancelProductOrder(input.orderNo, input.reason),
    onSuccess: async (response) => {
      if (!response.success) {
        toast.error(response.message || t('Operation failed'))
        return
      }
      await invalidate()
      toast.success(t('Order cancelled'))
    },
  })
  const refundOrder = useMutation({
    mutationFn: (input: { orderNo: string; reason: string }) =>
      refundProductOrder(input.orderNo, input.reason),
    onSuccess: async (response) => {
      if (!response.success) {
        toast.error(response.message || t('Operation failed'))
        return
      }
      await invalidate()
      toast.success(t('Order marked as refunded'))
    },
  })
  const resetPayment = useMutation({
    mutationFn: (input: { orderNo: string; reason: string }) =>
      resetProductOrderPayment(input.orderNo, input.reason),
    onSuccess: async (response) => {
      if (!response.success) {
        toast.error(response.message || t('Operation failed'))
        return
      }
      await invalidate()
      toast.success(t('Payment state reset'))
    },
  })

  return (
    <div className='space-y-4'>
      <div className='grid gap-4 xl:grid-cols-2'>
        <Card>
          <CardHeader>
            <CardTitle>{t('Grant entitlement')}</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className='grid gap-3 sm:grid-cols-2'
              onSubmit={grantForm.handleSubmit((values) =>
                grant.mutate(values)
              )}
            >
              <Input
                type='number'
                placeholder={t('User ID')}
                {...grantForm.register('user_id', { valueAsNumber: true })}
              />
              <NativeSelect
                className='w-full'
                {...grantForm.register('entitlement_type_id', {
                  valueAsNumber: true,
                })}
              >
                <NativeSelectOption value={0}>
                  {t('Select type')}
                </NativeSelectOption>
                {(types.data?.data ?? []).map((type) => (
                  <NativeSelectOption key={type.id} value={type.id}>
                    {type.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <Input
                type='number'
                placeholder={t('Total quota')}
                {...grantForm.register('total_quota', { valueAsNumber: true })}
              />
              <Input
                type='number'
                placeholder={t('Daily quota')}
                {...grantForm.register('daily_quota', { valueAsNumber: true })}
              />
              <Input
                type='number'
                placeholder={t('Validity days, 0 means no expiry')}
                {...grantForm.register('validity_days', {
                  valueAsNumber: true,
                })}
              />
              <Button type='submit' disabled={grant.isPending}>
                {t('Grant')}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('Adjust entitlement quota')}</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className='grid gap-3 sm:grid-cols-2'
              onSubmit={adjustmentForm.handleSubmit((values) =>
                adjust.mutate(values)
              )}
            >
              <Input
                type='number'
                placeholder={t('Entitlement ID')}
                {...adjustmentForm.register('entitlement_id', {
                  valueAsNumber: true,
                })}
              />
              <Input
                type='number'
                placeholder={t('Quota delta')}
                {...adjustmentForm.register('delta_quota', {
                  valueAsNumber: true,
                })}
              />
              <Input
                className='sm:col-span-2'
                placeholder={t('Adjustment reason')}
                {...adjustmentForm.register('reason')}
              />
              <Button type='submit' disabled={adjust.isPending}>
                {t('Adjust')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <CardTitle>{t('User entitlements')}</CardTitle>
            <div className='flex gap-2'>
              <Input
                className='w-36'
                type='number'
                placeholder={t('User ID')}
                onChange={(event) =>
                  setLookupUserId(Number(event.target.value) || 0)
                }
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className='space-y-2'>
          {(userEntitlements.data?.data?.entitlements ?? []).map(
            (entitlement) => (
              <div
                key={entitlement.id}
                className='flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3'
              >
                <div>
                  <strong>#{entitlement.id}</strong>
                  <p className='text-muted-foreground text-xs'>
                    {formatQuota(entitlement.used_quota)} /{' '}
                    {formatQuota(entitlement.total_quota)} ·{' '}
                    {formatDate(entitlement.expire_at)}
                  </p>
                </div>
                <div className='flex items-center gap-2'>
                  <Badge variant='secondary'>{t(entitlement.state)}</Badge>
                  <Button
                    size='sm'
                    variant='outline'
                    onClick={() => setAdjustmentEntitlementId(entitlement.id)}
                  >
                    {t('Adjustment history')}
                  </Button>
                  <Button
                    size='sm'
                    variant='destructive'
                    disabled={revoke.isPending}
                    onClick={() => {
                      if (window.confirm(t('Revoke this entitlement?'))) {
                        revoke.mutate(entitlement.id)
                      }
                    }}
                  >
                    {t('Revoke')}
                  </Button>
                </div>
              </div>
            )
          )}
        </CardContent>
      </Card>

      {adjustmentEntitlementId > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>
              {t('Adjustment history for entitlement #{{id}}', {
                id: adjustmentEntitlementId,
              })}
            </CardTitle>
          </CardHeader>
          <CardContent className='space-y-2'>
            {(adjustments.data?.data ?? []).map((adjustment) => (
              <div
                key={adjustment.id}
                className='rounded-lg border p-3 text-sm'
              >
                <div className='flex justify-between gap-2'>
                  <strong>{formatQuota(adjustment.delta_quota)}</strong>
                  <span className='text-muted-foreground'>
                    {formatDate(adjustment.created_at)}
                  </span>
                </div>
                <p className='text-muted-foreground'>{adjustment.reason}</p>
              </div>
            ))}
            {!adjustments.isPending &&
            (adjustments.data?.data?.length ?? 0) === 0 ? (
              <p className='text-muted-foreground text-sm'>
                {t('No adjustment history')}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <div className='space-y-3'>
            <CardTitle>{t('Product orders')}</CardTitle>
            <div className='grid gap-2 md:grid-cols-4'>
              <Input
                placeholder={t('Order number')}
                value={orderKeyword}
                onChange={(event) => {
                  setOrderKeyword(event.target.value)
                  setOrderPage(1)
                }}
              />
              <Input
                type='number'
                placeholder={t('User ID')}
                onChange={(event) => {
                  setOrderUserId(Number(event.target.value) || 0)
                  setOrderPage(1)
                }}
              />
              <NativeSelect
                value={orderStatus}
                onChange={(event) => {
                  setOrderStatus(event.target.value)
                  setOrderPage(1)
                }}
              >
                <NativeSelectOption value=''>
                  {t('All statuses')}
                </NativeSelectOption>
                <NativeSelectOption value='pending'>
                  {t('pending')}
                </NativeSelectOption>
                <NativeSelectOption value='fulfilled'>
                  {t('fulfilled')}
                </NativeSelectOption>
                <NativeSelectOption value='cancelled'>
                  {t('cancelled')}
                </NativeSelectOption>
                <NativeSelectOption value='refunded'>
                  {t('refunded')}
                </NativeSelectOption>
              </NativeSelect>
            </div>
          </div>
        </CardHeader>
        <CardContent className='space-y-2'>
          {(orders.data?.data?.items ?? []).map((order) => (
            <div
              key={order.id}
              className='flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3'
            >
              <div>
                <strong className='font-mono text-xs'>{order.order_no}</strong>
                <p className='text-muted-foreground text-xs'>
                  {t('User')} #{order.user_id} · {formatDate(order.created_at)}
                </p>
                <p className='text-muted-foreground text-xs'>
                  {order.items?.map((item) => item.sku_name).join(', ') || '—'}{' '}
                  ·{' '}
                  {new Intl.NumberFormat(undefined, {
                    style: 'currency',
                    currency: order.currency || 'CNY',
                  }).format(order.total_amount_minor / 100)}
                </p>
                {order.payment_provider ? (
                  <p className='text-muted-foreground text-xs'>
                    {order.payment_provider} · {order.payment_method}
                  </p>
                ) : null}
                {order.status_reason ? (
                  <p className='text-muted-foreground text-xs'>
                    {t('Reason')}: {order.status_reason}
                  </p>
                ) : null}
              </div>
              <div className='flex flex-wrap items-center gap-2'>
                <Badge variant='secondary'>{t(order.status)}</Badge>
                {order.status === 'pending' ? (
                  <Button
                    size='sm'
                    disabled={complete.isPending}
                    onClick={() => {
                      if (
                        window.confirm(
                          t(
                            'Confirm payment was received before manual fulfillment?'
                          )
                        )
                      ) {
                        complete.mutate(order.order_no)
                      }
                    }}
                  >
                    {t('Manual fulfill')}
                  </Button>
                ) : null}
                {order.status === 'pending' && !order.payment_provider ? (
                  <Button
                    size='sm'
                    variant='outline'
                    disabled={cancelOrder.isPending}
                    onClick={() => {
                      const reason = window
                        .prompt(t('Cancellation reason'))
                        ?.trim()
                      if (reason) {
                        cancelOrder.mutate({ orderNo: order.order_no, reason })
                      }
                    }}
                  >
                    {t('Cancel order')}
                  </Button>
                ) : null}
                {order.status === 'pending' && order.payment_provider ? (
                  <Button
                    size='sm'
                    variant='outline'
                    disabled={resetPayment.isPending}
                    onClick={() => {
                      const reason = window
                        .prompt(
                          t(
                            'Confirm the payment is unpaid, then enter the reset reason'
                          )
                        )
                        ?.trim()
                      if (reason) {
                        resetPayment.mutate({ orderNo: order.order_no, reason })
                      }
                    }}
                  >
                    {t('Reset payment')}
                  </Button>
                ) : null}
                {order.status === 'fulfilled' ? (
                  <Button
                    size='sm'
                    variant='destructive'
                    disabled={refundOrder.isPending}
                    onClick={() => {
                      const reason = window
                        .prompt(
                          t(
                            'Confirm the external refund first, then enter the refund reason'
                          )
                        )
                        ?.trim()
                      if (reason) {
                        refundOrder.mutate({ orderNo: order.order_no, reason })
                      }
                    }}
                  >
                    {t('Mark refunded')}
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
          <div className='flex items-center justify-between pt-3'>
            <Button
              variant='outline'
              disabled={orderPage <= 1}
              onClick={() => setOrderPage((page) => Math.max(1, page - 1))}
            >
              {t('Previous')}
            </Button>
            <span className='text-muted-foreground text-sm'>
              {t('Page {{page}}', { page: orderPage })}
            </span>
            <Button
              variant='outline'
              disabled={orderPage * 20 >= (orders.data?.data?.total ?? 0)}
              onClick={() => setOrderPage((page) => page + 1)}
            >
              {t('Next')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
