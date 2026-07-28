/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import type { Product, ProductSKU } from './types'

export interface StoreCatalogItem {
  product: Product
  sku: ProductSKU
}

export interface StoreCatalog {
  recharge: StoreCatalogItem[]
  subscription: StoreCatalogItem[]
}

export function calculateRechargeQuota(
  sku: ProductSKU,
  amountMinor: number
): number {
  if (
    amountMinor <= 0 ||
    sku.price_amount_minor <= 0 ||
    sku.grant_total_quota <= 0
  ) {
    return 0
  }
  return Math.round(
    (sku.grant_total_quota * amountMinor) / sku.price_amount_minor
  )
}

export function isSKUAvailable(sku: ProductSKU): boolean {
  return !sku.stock_limited || sku.stock > 0
}

export function maximumSKUQuantity(sku: ProductSKU): number {
  if (!sku.stock_limited) return 100
  return Math.min(100, Math.max(0, sku.stock))
}

export function buildStoreCatalog(products: Product[]): StoreCatalog {
  const catalog: StoreCatalog = { recharge: [], subscription: [] }
  const orderedProducts = [...products].sort(
    (left, right) => left.sort_order - right.sort_order || left.id - right.id
  )

  for (const product of orderedProducts) {
    const orderedSKUs = [...(product.skus ?? [])].sort(
      (left, right) => left.sort_order - right.sort_order || left.id - right.id
    )
    if (product.category === 'recharge') {
      if (orderedSKUs[0]) {
        catalog.recharge.push({ product, sku: orderedSKUs[0] })
      }
      continue
    }

    for (const sku of orderedSKUs) {
      catalog.subscription.push({ product, sku })
    }
  }

  return catalog
}
