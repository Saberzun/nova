/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { AdminGift } from './components/admin-gift'
import { AdminOperations } from './components/admin-operations'
import { AdminPolicyTypes } from './components/admin-policy-types'
import { AdminProducts } from './components/admin-products'

export function EntitlementAdmin() {
  const { t } = useTranslation()
  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>
        {t('Product and Entitlement Center')}
      </SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <Tabs defaultValue='policy'>
          <TabsList>
            <TabsTrigger value='policy'>{t('Policies and Types')}</TabsTrigger>
            <TabsTrigger value='products'>{t('Products and SKUs')}</TabsTrigger>
            <TabsTrigger value='operations'>{t('Operations')}</TabsTrigger>
            <TabsTrigger value='gift'>{t('Gift and Referrals')}</TabsTrigger>
          </TabsList>
          <TabsContent value='policy' className='pt-4'>
            <AdminPolicyTypes />
          </TabsContent>
          <TabsContent value='products' className='pt-4'>
            <AdminProducts />
          </TabsContent>
          <TabsContent value='operations' className='pt-4'>
            <AdminOperations />
          </TabsContent>
          <TabsContent value='gift' className='pt-4'>
            <AdminGift />
          </TabsContent>
        </Tabs>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
