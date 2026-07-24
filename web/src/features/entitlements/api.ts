/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import { api } from '@/lib/api'

import type {
  AccessGroupPolicy,
  ApiResponse,
  Entitlement,
  EntitlementType,
  EntitlementTypeChangeLog,
  EpayResponse,
  PageData,
  Product,
  ProductOrder,
  ProductSKU,
  TopupInfo,
  UsageCharge,
  UserEntitlementData,
} from './types'

export async function getStoreProducts(): Promise<ApiResponse<Product[]>> {
  return (await api.get('/api/store/products')).data
}

export async function getStoreOrders(): Promise<ApiResponse<ProductOrder[]>> {
  return (await api.get('/api/store/orders')).data
}

export async function createStoreOrder(data: {
  sku_id: number
  quantity: number
  amount_minor?: number
}): Promise<ApiResponse<ProductOrder>> {
  return (await api.post('/api/store/orders', data)).data
}

export async function payStoreOrderEpay(
  orderNo: string,
  paymentMethod: string
): Promise<EpayResponse> {
  return (
    await api.post(`/api/store/orders/${orderNo}/epay`, {
      payment_method: paymentMethod,
    })
  ).data
}

export async function getTopupInfo(): Promise<ApiResponse<TopupInfo>> {
  return (await api.get('/api/user/topup/info')).data
}

export async function getSelfEntitlements(): Promise<
  ApiResponse<UserEntitlementData>
> {
  return (await api.get('/api/entitlement/self')).data
}

export async function activateEntitlement(id: number): Promise<ApiResponse> {
  return (await api.post(`/api/entitlement/${id}/activate`)).data
}

export async function updateEntitlementPriorities(
  ids: number[]
): Promise<ApiResponse> {
  return (await api.put('/api/entitlement/priorities', { ids })).data
}

export async function getUsageCharges(): Promise<
  ApiResponse<PageData<UsageCharge>>
> {
  return (await api.get('/api/entitlement/usage-charges')).data
}

export async function getGroupPolicies(): Promise<
  ApiResponse<AccessGroupPolicy[]>
> {
  return (await api.get('/api/entitlement/admin/group-policies')).data
}

export async function saveGroupPolicy(data: {
  group_name: string
  funding_source_type: string
}): Promise<ApiResponse<AccessGroupPolicy>> {
  return (await api.post('/api/entitlement/admin/group-policies', data)).data
}

export async function getEntitlementTypes(): Promise<
  ApiResponse<EntitlementType[]>
> {
  return (await api.get('/api/entitlement/admin/types')).data
}

export async function createEntitlementType(
  data: Partial<EntitlementType>
): Promise<ApiResponse<EntitlementType>> {
  return (await api.post('/api/entitlement/admin/types', data)).data
}

export async function replaceTypeGroups(
  id: number,
  groups: string[],
  reason: string
): Promise<ApiResponse> {
  return (
    await api.put(`/api/entitlement/admin/types/${id}/groups`, {
      groups,
      reason,
    })
  ).data
}

export async function getTypeChangeLogs(
  id: number
): Promise<ApiResponse<EntitlementTypeChangeLog[]>> {
  return (await api.get(`/api/entitlement/admin/types/${id}/change-logs`)).data
}

export async function getAdminProducts(): Promise<ApiResponse<Product[]>> {
  return (await api.get('/api/entitlement/admin/products')).data
}

export async function createProduct(
  data: Partial<Product>
): Promise<ApiResponse<Product>> {
  return (await api.post('/api/entitlement/admin/products', data)).data
}

export async function createProductSKU(
  data: Partial<ProductSKU>
): Promise<ApiResponse<ProductSKU>> {
  return (await api.post('/api/entitlement/admin/skus', data)).data
}

export async function getAdminOrders(): Promise<
  ApiResponse<PageData<ProductOrder>>
> {
  return (await api.get('/api/entitlement/admin/orders')).data
}

export async function completeProductOrder(
  orderNo: string
): Promise<ApiResponse> {
  return (
    await api.post(`/api/entitlement/admin/orders/${orderNo}/complete`, {
      provider_trade_no: `manual-${orderNo}`,
      payment_method: 'manual',
    })
  ).data
}

export async function getUserEntitlements(
  userId: number
): Promise<ApiResponse<UserEntitlementData>> {
  return (await api.get(`/api/entitlement/admin/users/${userId}/entitlements`))
    .data
}

export async function grantEntitlement(
  userId: number,
  data: Partial<Entitlement>
): Promise<ApiResponse<Entitlement>> {
  return (
    await api.post(`/api/entitlement/admin/users/${userId}/entitlements`, data)
  ).data
}

export async function adjustEntitlement(
  id: number,
  data: { delta_quota: number; reason: string; idempotency_key: string }
): Promise<ApiResponse> {
  return (
    await api.post(`/api/entitlement/admin/entitlements/${id}/adjust`, data)
  ).data
}

export async function revokeEntitlement(id: number): Promise<ApiResponse> {
  return (await api.post(`/api/entitlement/admin/entitlements/${id}/revoke`))
    .data
}
