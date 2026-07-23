/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'

import {
  createEntitlementType,
  getEntitlementTypes,
  getGroupPolicies,
  replaceTypeGroups,
  saveGroupPolicy,
} from '../api'

const policySchema = z.object({
  group_name: z.string().trim().min(1),
  funding_source_type: z.enum([
    'subscription',
    'stored_value',
    'system_wallet',
  ]),
})

const typeSchema = z.object({
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  description: z.string(),
  asset_kind: z.enum(['subscription', 'stored_value']),
})

const groupsSchema = z.object({
  type_id: z.number().int().positive(),
  groups: z.string(),
  reason: z.string().trim().min(1),
})

type PolicyForm = z.infer<typeof policySchema>
type TypeForm = z.infer<typeof typeSchema>
type GroupsForm = z.infer<typeof groupsSchema>

export function AdminPolicyTypes() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const policies = useQuery({
    queryKey: ['entitlement-admin', 'policies'],
    queryFn: getGroupPolicies,
  })
  const types = useQuery({
    queryKey: ['entitlement-admin', 'types'],
    queryFn: getEntitlementTypes,
  })
  const policyForm = useForm<PolicyForm>({
    resolver: zodResolver(policySchema),
    defaultValues: {
      group_name: '',
      funding_source_type: 'subscription',
    },
  })
  const typeForm = useForm<TypeForm>({
    resolver: zodResolver(typeSchema),
    defaultValues: {
      code: '',
      name: '',
      description: '',
      asset_kind: 'subscription',
    },
  })
  const groupsForm = useForm<GroupsForm>({
    resolver: zodResolver(groupsSchema),
    defaultValues: { type_id: 0, groups: '', reason: '' },
  })
  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['entitlement-admin'] })
  }
  const savePolicy = useMutation({
    mutationFn: saveGroupPolicy,
    onSuccess: async (response) => {
      if (!response.success) throw new Error(response.message)
      await invalidate()
      policyForm.reset()
      toast.success(t('Group policy saved'))
    },
  })
  const saveType = useMutation({
    mutationFn: (values: TypeForm) =>
      createEntitlementType({
        ...values,
        meter_type: 'quota',
        status: 'active',
      }),
    onSuccess: async (response) => {
      if (!response.success) throw new Error(response.message)
      await invalidate()
      typeForm.reset()
      toast.success(t('Entitlement type created'))
    },
  })
  const saveGroups = useMutation({
    mutationFn: (values: GroupsForm) =>
      replaceTypeGroups(
        values.type_id,
        values.groups
          .split(',')
          .map((group) => group.trim())
          .filter(Boolean),
        values.reason
      ),
    onSuccess: async (response) => {
      if (!response.success) throw new Error(response.message)
      await invalidate()
      toast.success(t('Allowed groups updated'))
    },
  })

  return (
    <div className='grid gap-4 xl:grid-cols-3'>
      <Card>
        <CardHeader>
          <CardTitle>{t('Access group funding policy')}</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <form
            className='space-y-3'
            onSubmit={policyForm.handleSubmit((values) =>
              savePolicy.mutate(values)
            )}
          >
            <Input
              placeholder={t('Group name')}
              {...policyForm.register('group_name')}
            />
            <NativeSelect
              className='w-full'
              {...policyForm.register('funding_source_type')}
            >
              <NativeSelectOption value='subscription'>
                {t('Subscription quota')}
              </NativeSelectOption>
              <NativeSelectOption value='stored_value'>
                {t('Recharge quota')}
              </NativeSelectOption>
              <NativeSelectOption value='system_wallet'>
                {t('System wallet')}
              </NativeSelectOption>
            </NativeSelect>
            <Button type='submit' disabled={savePolicy.isPending}>
              {t('Save')}
            </Button>
          </form>
          <div className='space-y-2 border-t pt-4'>
            {(policies.data?.data ?? []).map((policy) => (
              <div
                key={policy.id}
                className='flex items-center justify-between gap-2 text-sm'
              >
                <code>{policy.group_name}</code>
                <Badge variant='secondary'>
                  {t(policy.funding_source_type)}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('Create entitlement type')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className='space-y-3'
            onSubmit={typeForm.handleSubmit((values) =>
              saveType.mutate(values)
            )}
          >
            <Input
              placeholder={t('Type code')}
              {...typeForm.register('code')}
            />
            <Input
              placeholder={t('Type name')}
              {...typeForm.register('name')}
            />
            <Input
              placeholder={t('Description')}
              {...typeForm.register('description')}
            />
            <NativeSelect
              className='w-full'
              {...typeForm.register('asset_kind')}
            >
              <NativeSelectOption value='subscription'>
                {t('Subscription quota')}
              </NativeSelectOption>
              <NativeSelectOption value='stored_value'>
                {t('Recharge quota')}
              </NativeSelectOption>
            </NativeSelect>
            <Button type='submit' disabled={saveType.isPending}>
              {t('Create')}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('Dynamic allowed groups')}</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <form
            className='space-y-3'
            onSubmit={groupsForm.handleSubmit((values) =>
              saveGroups.mutate(values)
            )}
          >
            <NativeSelect
              className='w-full'
              {...groupsForm.register('type_id', { valueAsNumber: true })}
            >
              <NativeSelectOption value={0}>
                {t('Select type')}
              </NativeSelectOption>
              {(types.data?.data ?? []).map((type) => (
                <NativeSelectOption key={type.id} value={type.id}>
                  {type.name} ({type.asset_kind})
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <Input
              placeholder={t('Comma-separated group names')}
              {...groupsForm.register('groups')}
            />
            <Input
              placeholder={t('Change reason')}
              {...groupsForm.register('reason')}
            />
            <Button type='submit' disabled={saveGroups.isPending}>
              {t('Replace allowed groups')}
            </Button>
          </form>
          <div className='space-y-3 border-t pt-4'>
            {(types.data?.data ?? []).map((type) => (
              <button
                type='button'
                key={type.id}
                className='hover:bg-muted w-full rounded-lg p-2 text-left'
                onClick={() =>
                  groupsForm.reset({
                    type_id: type.id,
                    groups: (type.groups ?? [])
                      .map((group) => group.group_name)
                      .join(', '),
                    reason: '',
                  })
                }
              >
                <strong>{type.name}</strong>
                <p className='text-muted-foreground text-xs'>
                  {(type.groups ?? [])
                    .map((group) => group.group_name)
                    .join(', ') || t('No groups')}
                </p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
