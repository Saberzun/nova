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

export function buildStoreCatalog(products: Product[]): StoreCatalog {
  const catalog: StoreCatalog = { recharge: [], subscription: [] }
  const orderedProducts = [...products].sort(
    (left, right) => left.sort_order - right.sort_order || left.id - right.id
  )

  for (const product of orderedProducts) {
    const orderedSKUs = [...(product.skus ?? [])].sort(
      (left, right) => left.sort_order - right.sort_order || left.id - right.id
    )
    const target =
      product.category === 'recharge' ? catalog.recharge : catalog.subscription

    for (const sku of orderedSKUs) {
      target.push({ product, sku })
    }
  }

  return catalog
}
