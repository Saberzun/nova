/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { buildStoreCatalog } from '../store-catalog'
import type { Product, ProductSKU } from '../types'

function createSKU(id: number, sortOrder: number): ProductSKU {
  return {
    id,
    code: `sku-${id}`,
    product_id: 1,
    entitlement_type_id: 1,
    name: `SKU ${id}`,
    price_amount_minor: 100,
    currency: 'CNY',
    grant_total_quota: 100,
    grant_daily_quota: 0,
    validity_seconds: 0,
    activation_policy: 'immediate',
    activation_deadline_seconds: 0,
    stock: -1,
    purchase_limit: 0,
    multi_quantity_enabled: false,
    status: 'active',
    sort_order: sortOrder,
  }
}

function createProduct(
  id: number,
  category: Product['category'],
  sortOrder: number,
  skus: ProductSKU[]
): Product {
  return {
    id,
    code: `product-${id}`,
    name: `Product ${id}`,
    description: '',
    category,
    status: 'active',
    sort_order: sortOrder,
    visibility_rule: '',
    skus,
  }
}

describe('quota store catalog layout', () => {
  test('separates recharge SKUs from subscriptions regardless of API order', () => {
    const subscription = createProduct(1, 'subscription', 1, [createSKU(11, 1)])
    const recharge = createProduct(2, 'recharge', 2, [createSKU(21, 1)])

    const catalog = buildStoreCatalog([subscription, recharge])

    assert.deepEqual(
      catalog.recharge.map((item) => item.sku.id),
      [21]
    )
    assert.deepEqual(
      catalog.subscription.map((item) => item.sku.id),
      [11]
    )
  })

  test('lays out each subscription SKU independently in configured order', () => {
    const laterProduct = createProduct(2, 'subscription', 20, [
      createSKU(23, 30),
    ])
    const earlierProduct = createProduct(1, 'subscription', 10, [
      createSKU(12, 20),
      createSKU(11, 10),
    ])

    const catalog = buildStoreCatalog([laterProduct, earlierProduct])

    assert.deepEqual(
      catalog.subscription.map((item) => item.sku.id),
      [11, 12, 23]
    )
  })
})
