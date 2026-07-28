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

import {
  createEntitlementType,
  getEntitlementTypes,
  getGroupPolicies,
  getTypeChangeLogs,
  replaceTypeGroups,
  saveGroupPolicy,
  updateEntitlementType,
} from '../api'
import { AdminFormField } from './admin-form-field'

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
  status: z.enum(['active', 'disabled', 'archived']),
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
  const [editingTypeId, setEditingTypeId] = useState<number | null>(null)
  const [logTypeId, setLogTypeId] = useState(0)
  const policies = useQuery({
    queryKey: ['entitlement-admin', 'policies'],
    queryFn: getGroupPolicies,
  })
  const types = useQuery({
    queryKey: ['entitlement-admin', 'types'],
    queryFn: getEntitlementTypes,
  })
  const changeLogs = useQuery({
    queryKey: ['entitlement-admin', 'type-change-logs', logTypeId],
    queryFn: () => getTypeChangeLogs(logTypeId),
    enabled: logTypeId > 0,
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
      status: 'active',
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
      if (!response.success) {
        toast.error(response.message || t('Save failed'))
        return
      }
      await invalidate()
      policyForm.reset()
      toast.success(t('Group policy saved'))
    },
    onError: () => toast.error(t('Save failed')),
  })
  const saveType = useMutation({
    mutationFn: (input: { id: number | null; values: TypeForm }) => {
      const payload = { ...input.values, meter_type: 'quota' as const }
      return input.id
        ? updateEntitlementType(input.id, payload)
        : createEntitlementType(payload)
    },
    onSuccess: async (response) => {
      if (!response.success) {
        toast.error(response.message || t('Save failed'))
        return
      }
      await invalidate()
      typeForm.reset()
      setEditingTypeId(null)
      toast.success(t('Entitlement type saved'))
    },
    onError: () => toast.error(t('Save failed')),
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
      if (!response.success) {
        toast.error(response.message || t('Save failed'))
        return
      }
      await invalidate()
      toast.success(t('Allowed groups updated'))
    },
    onError: () => toast.error(t('Save failed')),
  })

  return (
    <div className='grid gap-4 xl:grid-cols-2'>
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
            <AdminFormField label={t('Group name')}>
              <Input {...policyForm.register('group_name')} />
            </AdminFormField>
            <AdminFormField label={t('Funding source')}>
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
            </AdminFormField>
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
          <CardTitle>
            {editingTypeId
              ? t('Edit entitlement type')
              : t('Create entitlement type')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className='space-y-3'
            onSubmit={typeForm.handleSubmit((values) =>
              saveType.mutate({ id: editingTypeId, values })
            )}
          >
            <AdminFormField label={t('Type code')}>
              <Input {...typeForm.register('code')} />
            </AdminFormField>
            <AdminFormField label={t('Type name')}>
              <Input {...typeForm.register('name')} />
            </AdminFormField>
            <AdminFormField label={t('Description')}>
              <Input {...typeForm.register('description')} />
            </AdminFormField>
            <AdminFormField label={t('Funding source')}>
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
            </AdminFormField>
            <AdminFormField label={t('Status')}>
              <NativeSelect className='w-full' {...typeForm.register('status')}>
                <NativeSelectOption value='active'>
                  {t('active')}
                </NativeSelectOption>
                <NativeSelectOption value='disabled'>
                  {t('disabled')}
                </NativeSelectOption>
                <NativeSelectOption value='archived'>
                  {t('archived')}
                </NativeSelectOption>
              </NativeSelect>
            </AdminFormField>
            <div className='flex gap-2'>
              <Button type='submit' disabled={saveType.isPending}>
                {editingTypeId ? t('Save') : t('Create')}
              </Button>
              {editingTypeId ? (
                <Button
                  type='button'
                  variant='outline'
                  onClick={() => {
                    setEditingTypeId(null)
                    typeForm.reset()
                  }}
                >
                  {t('Cancel')}
                </Button>
              ) : null}
            </div>
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
            <AdminFormField label={t('Entitlement type')}>
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
            </AdminFormField>
            <AdminFormField label={t('Comma-separated group names')}>
              <Input {...groupsForm.register('groups')} />
            </AdminFormField>
            <AdminFormField label={t('Change reason')}>
              <Input {...groupsForm.register('reason')} />
            </AdminFormField>
            <Button type='submit' disabled={saveGroups.isPending}>
              {t('Replace allowed groups')}
            </Button>
          </form>
          <div className='space-y-3 border-t pt-4'>
            {(types.data?.data ?? []).map((type) => (
              <div key={type.id} className='rounded-lg border p-3'>
                <div className='flex items-center justify-between gap-2'>
                  <strong>{type.name}</strong>
                  <Badge variant='outline'>{t(type.status)}</Badge>
                </div>
                <p className='text-muted-foreground text-xs'>
                  {(type.groups ?? [])
                    .map((group) => group.group_name)
                    .join(', ') || t('No groups')}
                </p>
                <div className='mt-3 flex flex-wrap gap-2'>
                  <Button
                    size='sm'
                    variant='outline'
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
                    {t('Edit groups')}
                  </Button>
                  <Button
                    size='sm'
                    variant='outline'
                    onClick={() => {
                      setEditingTypeId(type.id)
                      typeForm.reset({
                        code: type.code,
                        name: type.name,
                        description: type.description,
                        asset_kind: type.asset_kind,
                        status: type.status,
                      })
                    }}
                  >
                    {t('Edit details')}
                  </Button>
                  <Button
                    size='sm'
                    variant='ghost'
                    onClick={() => setLogTypeId(type.id)}
                  >
                    {t('Change history')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('Type change history')}</CardTitle>
        </CardHeader>
        <CardContent className='space-y-3'>
          {logTypeId === 0 ? (
            <p className='text-muted-foreground text-sm'>
              {t('Select a type to view its change history.')}
            </p>
          ) : null}
          {(changeLogs.data?.data ?? []).map((log) => (
            <div key={log.id} className='rounded-lg border p-3 text-sm'>
              <div className='flex justify-between gap-2'>
                <strong>{t(log.action)}</strong>
                <Badge variant='outline'>v{log.revision}</Badge>
              </div>
              <p className='text-muted-foreground mt-1'>{log.reason}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
