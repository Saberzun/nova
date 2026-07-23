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
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { formatQuota } from '@/lib/format'

import {
  createProduct,
  createProductSKU,
  getAdminProducts,
  getEntitlementTypes,
} from '../api'

const productSchema = z.object({
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  description: z.string(),
  category: z.enum(['subscription', 'recharge']),
  sort_order: z.number().int(),
})

const skuSchema = z.object({
  product_id: z.number().int().positive(),
  entitlement_type_id: z.number().int().positive(),
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  price_amount_minor: z.number().int().min(0),
  grant_total_quota: z.number().int().positive(),
  grant_daily_quota: z.number().int().min(0),
  validity_seconds: z.number().int().min(0),
  activation_policy: z.enum(['immediate', 'manual', 'deferred']),
  activation_deadline_seconds: z.number().int().min(0),
  stock: z.number().int().min(0),
  purchase_limit: z.number().int().min(0),
  multi_quantity_enabled: z.boolean(),
})

type ProductForm = z.infer<typeof productSchema>
type SKUForm = z.infer<typeof skuSchema>

export function AdminProducts() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const products = useQuery({
    queryKey: ['entitlement-admin', 'products'],
    queryFn: getAdminProducts,
  })
  const types = useQuery({
    queryKey: ['entitlement-admin', 'types'],
    queryFn: getEntitlementTypes,
  })
  const productForm = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      code: '',
      name: '',
      description: '',
      category: 'subscription',
      sort_order: 0,
    },
  })
  const skuForm = useForm<SKUForm>({
    resolver: zodResolver(skuSchema),
    defaultValues: {
      product_id: 0,
      entitlement_type_id: 0,
      code: '',
      name: '',
      price_amount_minor: 0,
      grant_total_quota: 500000,
      grant_daily_quota: 0,
      validity_seconds: 2592000,
      activation_policy: 'immediate',
      activation_deadline_seconds: 0,
      stock: 0,
      purchase_limit: 0,
      multi_quantity_enabled: false,
    },
  })
  const invalidate = async () => {
    await queryClient.invalidateQueries({
      queryKey: ['entitlement-admin', 'products'],
    })
  }
  const saveProduct = useMutation({
    mutationFn: (values: ProductForm) =>
      createProduct({ ...values, status: 'active', visibility_rule: '' }),
    onSuccess: async (response) => {
      if (!response.success) return
      await invalidate()
      productForm.reset()
      toast.success(t('Product created'))
    },
  })
  const saveSKU = useMutation({
    mutationFn: (values: SKUForm) =>
      createProductSKU({
        ...values,
        currency: 'CNY',
        status: 'active',
        sort_order: 0,
      }),
    onSuccess: async (response) => {
      if (!response.success) return
      await invalidate()
      toast.success(t('SKU created'))
    },
  })

  return (
    <div className='space-y-4'>
      <div className='grid gap-4 xl:grid-cols-2'>
        <Card>
          <CardHeader>
            <CardTitle>{t('Create product')}</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className='grid gap-3 sm:grid-cols-2'
              onSubmit={productForm.handleSubmit((values) =>
                saveProduct.mutate(values)
              )}
            >
              <Input
                placeholder={t('Product code')}
                {...productForm.register('code')}
              />
              <Input
                placeholder={t('Product name')}
                {...productForm.register('name')}
              />
              <Input
                className='sm:col-span-2'
                placeholder={t('Description')}
                {...productForm.register('description')}
              />
              <NativeSelect
                className='w-full'
                {...productForm.register('category')}
              >
                <NativeSelectOption value='subscription'>
                  {t('Subscription')}
                </NativeSelectOption>
                <NativeSelectOption value='recharge'>
                  {t('Recharge')}
                </NativeSelectOption>
              </NativeSelect>
              <Input
                type='number'
                placeholder={t('Sort order')}
                {...productForm.register('sort_order', { valueAsNumber: true })}
              />
              <Button type='submit' disabled={saveProduct.isPending}>
                {t('Create')}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('Create SKU')}</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className='grid gap-3 sm:grid-cols-2'
              onSubmit={skuForm.handleSubmit((values) =>
                saveSKU.mutate(values)
              )}
            >
              <NativeSelect
                className='w-full'
                {...skuForm.register('product_id', { valueAsNumber: true })}
              >
                <NativeSelectOption value={0}>
                  {t('Select product')}
                </NativeSelectOption>
                {(products.data?.data ?? []).map((product) => (
                  <NativeSelectOption key={product.id} value={product.id}>
                    {product.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <NativeSelect
                className='w-full'
                {...skuForm.register('entitlement_type_id', {
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
                placeholder={t('SKU code')}
                {...skuForm.register('code')}
              />
              <Input
                placeholder={t('SKU name')}
                {...skuForm.register('name')}
              />
              <Input
                type='number'
                placeholder={t('Price in cents')}
                {...skuForm.register('price_amount_minor', {
                  valueAsNumber: true,
                })}
              />
              <Input
                type='number'
                placeholder={t('Grant total quota')}
                {...skuForm.register('grant_total_quota', {
                  valueAsNumber: true,
                })}
              />
              <Input
                type='number'
                placeholder={t('Grant daily quota')}
                {...skuForm.register('grant_daily_quota', {
                  valueAsNumber: true,
                })}
              />
              <Input
                type='number'
                placeholder={t('Validity seconds')}
                {...skuForm.register('validity_seconds', {
                  valueAsNumber: true,
                })}
              />
              <NativeSelect
                className='w-full'
                {...skuForm.register('activation_policy')}
              >
                <NativeSelectOption value='immediate'>
                  {t('Immediate')}
                </NativeSelectOption>
                <NativeSelectOption value='manual'>
                  {t('Manual activation')}
                </NativeSelectOption>
                <NativeSelectOption value='deferred'>
                  {t('Deferred')}
                </NativeSelectOption>
              </NativeSelect>
              <Input
                type='number'
                placeholder={t('Activation deadline seconds')}
                {...skuForm.register('activation_deadline_seconds', {
                  valueAsNumber: true,
                })}
              />
              <Input
                type='number'
                placeholder={t('Stock, 0 means unlimited')}
                {...skuForm.register('stock', { valueAsNumber: true })}
              />
              <Input
                type='number'
                placeholder={t('Purchase limit, 0 means unlimited')}
                {...skuForm.register('purchase_limit', { valueAsNumber: true })}
              />
              <label className='flex items-center gap-2 text-sm'>
                <Checkbox
                  checked={skuForm.watch('multi_quantity_enabled')}
                  onCheckedChange={(checked) =>
                    skuForm.setValue('multi_quantity_enabled', checked === true)
                  }
                />
                {t('Allow multiple quantities')}
              </label>
              <Button type='submit' disabled={saveSKU.isPending}>
                {t('Create')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
        {(products.data?.data ?? []).map((product) => (
          <Card key={product.id}>
            <CardHeader>
              <div className='flex items-center justify-between gap-2'>
                <CardTitle>{product.name}</CardTitle>
                <Badge variant='secondary'>{t(product.category)}</Badge>
              </div>
            </CardHeader>
            <CardContent className='space-y-2'>
              {(product.skus ?? []).map((sku) => (
                <div
                  key={sku.id}
                  className='bg-muted/50 rounded-lg p-3 text-sm'
                >
                  <div className='flex justify-between gap-2'>
                    <strong>{sku.name}</strong>
                    <span>¥{(sku.price_amount_minor / 100).toFixed(2)}</span>
                  </div>
                  <p className='text-muted-foreground'>
                    {formatQuota(sku.grant_total_quota)} ·{' '}
                    {sku.activation_policy}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
