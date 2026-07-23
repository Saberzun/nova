/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

export type AssetKind = 'subscription' | 'stored_value' | 'system_wallet'
export type EntityStatus = 'draft' | 'active' | 'paused' | 'archived'

export interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
}

export interface PageData<T> {
  page: number
  page_size: number
  total: number
  items: T[]
}

export interface AccessGroupPolicy {
  id: number
  group_name: string
  funding_source_type: AssetKind
  created_at: number
  updated_at: number
}

export interface EntitlementTypeGroup {
  id: number
  entitlement_type_id: number
  access_group_policy_id: number
  group_name: string
}

export interface EntitlementType {
  id: number
  code: string
  name: string
  description: string
  asset_kind: Exclude<AssetKind, 'system_wallet'>
  meter_type: 'quota'
  status: 'active' | 'disabled' | 'archived'
  revision: number
  groups?: EntitlementTypeGroup[]
}

export interface ProductSKU {
  id: number
  code: string
  product_id: number
  entitlement_type_id: number
  name: string
  price_amount_minor: number
  currency: string
  grant_total_quota: number
  grant_daily_quota: number
  validity_seconds: number
  activation_policy: 'immediate' | 'manual' | 'deferred'
  activation_deadline_seconds: number
  stock: number
  purchase_limit: number
  multi_quantity_enabled: boolean
  status: EntityStatus
  sort_order: number
}

export interface Product {
  id: number
  code: string
  name: string
  description: string
  category: 'subscription' | 'recharge'
  status: EntityStatus
  sort_order: number
  visibility_rule: string
  skus?: ProductSKU[]
}

export interface ProductOrderItem {
  id: number
  product_name: string
  sku_name: string
  quantity: number
  unit_price_amount_minor: number
  grant_total_quota: number
}

export interface ProductOrder {
  id: number
  order_no: string
  user_id: number
  status: 'pending' | 'paid' | 'fulfilled' | 'cancelled' | 'refunded'
  payment_method: string
  payment_provider: string
  total_amount_minor: number
  currency: string
  created_at: number
  fulfilled_at: number
  items?: ProductOrderItem[]
}

export interface Entitlement {
  id: number
  user_id: number
  entitlement_type_id: number
  asset_kind: Exclude<AssetKind, 'system_wallet'>
  product_id: number
  sku_id: number
  state: 'pending' | 'queued' | 'active' | 'depleted' | 'expired' | 'cancelled'
  total_quota: number
  used_quota: number
  reserved_quota: number
  daily_quota: number
  reset_timezone: string
  start_at: number
  expire_at: number
  activation_deadline: number
  sort_order: number
  source_type: string
  created_at: number
}

export interface UserEntitlementData {
  entitlements: Entitlement[]
  types: EntitlementType[]
}

export interface UsageChargeAllocation {
  id: number
  entitlement_id: number
  reserved_quota: number
  settled_quota: number
  refunded_quota: number
  state: string
}

export interface UsageCharge {
  id: number
  request_id: string
  access_group: string
  asset_kind: AssetKind
  model_name: string
  estimated_quota: number
  reserved_quota: number
  settled_quota: number
  uncovered_quota: number
  state: string
  created_at: number
  allocations?: UsageChargeAllocation[]
}

export interface PaymentMethod {
  type: string
  name?: string
}

export interface TopupInfo {
  enable_online_topup: boolean
  pay_methods: PaymentMethod[]
}

export interface EpayResponse {
  message: string
  data?: Record<string, string>
  url?: string
}

export interface EntitlementTypeChangeLog {
  id: number
  revision: number
  action: string
  before_json: string
  after_json: string
  operator_id: number
  reason: string
  created_at: number
}
