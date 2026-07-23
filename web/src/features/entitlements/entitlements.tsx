/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { SectionPageLayout } from '@/components/layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { formatQuota } from '@/lib/format'

import {
  activateEntitlement,
  getSelfEntitlements,
  getUsageCharges,
  updateEntitlementPriorities,
} from './api'
import { formatDate } from './lib'

export function MyEntitlements() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const entitlements = useQuery({
    queryKey: ['entitlements', 'self'],
    queryFn: getSelfEntitlements,
  })
  const charges = useQuery({
    queryKey: ['entitlements', 'charges'],
    queryFn: getUsageCharges,
  })
  const ordered = useMemo(
    () =>
      [...(entitlements.data?.data?.entitlements ?? [])].sort(
        (left, right) =>
          left.sort_order - right.sort_order || left.id - right.id
      ),
    [entitlements.data?.data?.entitlements]
  )
  const typeMap = useMemo(
    () =>
      new Map(
        (entitlements.data?.data?.types ?? []).map((type) => [type.id, type])
      ),
    [entitlements.data?.data?.types]
  )
  const activate = useMutation({
    mutationFn: activateEntitlement,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['entitlements'] })
      toast.success(t('Entitlement activated'))
    },
  })
  const reorder = useMutation({
    mutationFn: updateEntitlementPriorities,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['entitlements', 'self'],
      })
    },
  })

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= ordered.length) return
    const ids = ordered.map((item) => item.id)
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    reorder.mutate(ids)
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('My Entitlements')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='space-y-8'>
          <p className='text-muted-foreground'>
            {t(
              'Entitlements of the same type can be combined for one request. Groups listed on one entitlement share the same remaining quota.'
            )}
          </p>
          <div className='grid gap-4 lg:grid-cols-2'>
            {ordered.map((entitlement, index) => {
              const entitlementType = typeMap.get(
                entitlement.entitlement_type_id
              )
              const remaining = Math.max(
                0,
                entitlement.total_quota -
                  entitlement.used_quota -
                  entitlement.reserved_quota
              )
              const percentage = entitlement.total_quota
                ? Math.min(
                    100,
                    (entitlement.used_quota / entitlement.total_quota) * 100
                  )
                : 0
              return (
                <Card key={entitlement.id}>
                  <CardHeader>
                    <div className='flex items-start justify-between gap-3'>
                      <div>
                        <CardTitle>
                          {entitlementType?.name || `#${entitlement.id}`}
                        </CardTitle>
                        <CardDescription>
                          {entitlement.asset_kind === 'subscription'
                            ? t('Subscription quota')
                            : t('Recharge quota')}
                        </CardDescription>
                      </div>
                      <Badge variant='secondary'>{t(entitlement.state)}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className='space-y-4'>
                    <div>
                      <div className='mb-2 flex justify-between text-sm'>
                        <span>{t('Remaining quota')}</span>
                        <strong>{formatQuota(remaining)}</strong>
                      </div>
                      <Progress value={percentage} />
                      <p className='text-muted-foreground mt-2 text-xs'>
                        {t('Used {{used}} of {{total}}', {
                          used: formatQuota(entitlement.used_quota),
                          total: formatQuota(entitlement.total_quota),
                        })}
                      </p>
                    </div>
                    <div className='flex flex-wrap gap-2'>
                      {(entitlementType?.groups ?? []).map((group) => (
                        <Badge key={group.id} variant='outline'>
                          {group.group_name}
                        </Badge>
                      ))}
                    </div>
                    <dl className='grid grid-cols-2 gap-3 text-sm'>
                      <div>
                        <dt className='text-muted-foreground'>
                          {t('Daily quota')}
                        </dt>
                        <dd>
                          {entitlement.daily_quota > 0
                            ? formatQuota(entitlement.daily_quota)
                            : t('Unlimited')}
                        </dd>
                      </div>
                      <div>
                        <dt className='text-muted-foreground'>
                          {t('Expires at')}
                        </dt>
                        <dd>{formatDate(entitlement.expire_at)}</dd>
                      </div>
                    </dl>
                    <div className='flex items-center justify-between gap-2'>
                      <div className='flex gap-2'>
                        <Button
                          size='icon-sm'
                          variant='outline'
                          disabled={index === 0 || reorder.isPending}
                          onClick={() => move(index, -1)}
                          aria-label={t('Move up')}
                        >
                          <ArrowUp aria-hidden='true' />
                        </Button>
                        <Button
                          size='icon-sm'
                          variant='outline'
                          disabled={
                            index === ordered.length - 1 || reorder.isPending
                          }
                          onClick={() => move(index, 1)}
                          aria-label={t('Move down')}
                        >
                          <ArrowDown aria-hidden='true' />
                        </Button>
                      </div>
                      {entitlement.state === 'pending' ? (
                        <Button
                          onClick={() => activate.mutate(entitlement.id)}
                          disabled={activate.isPending}
                        >
                          {t('Activate')}
                        </Button>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
          <section className='space-y-3'>
            <h2 className='text-lg font-semibold'>
              {t('Usage allocation ledger')}
            </h2>
            <div className='space-y-2'>
              {(charges.data?.data?.items ?? []).map((charge) => (
                <details key={charge.id} className='rounded-xl border p-4'>
                  <summary className='cursor-pointer list-none'>
                    <div className='flex flex-wrap items-center justify-between gap-3'>
                      <div>
                        <strong>{charge.model_name || t('API request')}</strong>
                        <p className='text-muted-foreground text-xs'>
                          {charge.access_group} ·{' '}
                          {formatDate(charge.created_at)}
                        </p>
                      </div>
                      <div className='flex items-center gap-3'>
                        <span>{formatQuota(charge.settled_quota)}</span>
                        <Badge variant='secondary'>{t(charge.state)}</Badge>
                      </div>
                    </div>
                  </summary>
                  <div className='mt-4 space-y-2 border-t pt-4'>
                    {(charge.allocations ?? []).map((allocation) => (
                      <div
                        key={allocation.id}
                        className='bg-muted/50 flex justify-between rounded-lg p-3 text-sm'
                      >
                        <span>
                          {t('Entitlement')} #{allocation.entitlement_id}
                        </span>
                        <span>
                          {formatQuota(allocation.settled_quota)} ·{' '}
                          {t('Released')}{' '}
                          {formatQuota(allocation.refunded_quota)}
                        </span>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </section>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
