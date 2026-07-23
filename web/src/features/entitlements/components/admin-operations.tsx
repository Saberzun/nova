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
  completeProductOrder,
  getAdminOrders,
  getEntitlementTypes,
  getUserEntitlements,
  grantEntitlement,
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
  const types = useQuery({
    queryKey: ['entitlement-admin', 'types'],
    queryFn: getEntitlementTypes,
  })
  const orders = useQuery({
    queryKey: ['entitlement-admin', 'orders'],
    queryFn: getAdminOrders,
  })
  const userEntitlements = useQuery({
    queryKey: ['entitlement-admin', 'user-entitlements', lookupUserId],
    queryFn: () => getUserEntitlements(lookupUserId),
    enabled: lookupUserId > 0,
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
      if (!response.success) return
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
      if (!response.success) return
      await invalidate()
      toast.success(t('Entitlement adjusted'))
    },
  })
  const revoke = useMutation({
    mutationFn: revokeEntitlement,
    onSuccess: async (response) => {
      if (!response.success) return
      await invalidate()
      toast.success(t('Entitlement revoked'))
    },
  })
  const complete = useMutation({
    mutationFn: completeProductOrder,
    onSuccess: async (response) => {
      if (!response.success) return
      await invalidate()
      toast.success(t('Order fulfilled'))
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

      <Card>
        <CardHeader>
          <CardTitle>{t('Product orders')}</CardTitle>
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
              </div>
              <div className='flex items-center gap-2'>
                <Badge variant='secondary'>{t(order.status)}</Badge>
                {order.status === 'pending' ? (
                  <Button
                    size='sm'
                    disabled={complete.isPending}
                    onClick={() => complete.mutate(order.order_no)}
                  >
                    {t('Manual fulfill')}
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
