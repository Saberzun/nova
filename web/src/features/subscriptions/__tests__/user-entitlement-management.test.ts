/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type {
  Entitlement,
  Product,
  ProductSKU,
} from "../../entitlements/types";
import { buildManagedSubscriptionData } from "../user-entitlement-management.ts";

function createSKU(id: number, status: ProductSKU["status"]): ProductSKU {
  return {
    id,
    code: `sku-${id}`,
    product_id: 1,
    entitlement_type_id: id,
    name: `SKU ${id}`,
    price_amount_minor: 100,
    currency: "CNY",
    grant_total_quota: 100,
    grant_daily_quota: 0,
    min_recharge_amount_minor: 100,
    max_recharge_amount_minor: 1000,
    validity_seconds: 3600,
    activation_policy: "immediate",
    activation_deadline_seconds: 0,
    stock: 0,
    stock_limited: false,
    purchase_limit: 0,
    multi_quantity_enabled: false,
    status,
    sort_order: 0,
  };
}

function createEntitlement(
  id: number,
  assetKind: Entitlement["asset_kind"],
): Entitlement {
  return {
    id,
    user_id: 10,
    entitlement_type_id: id,
    asset_kind: assetKind,
    product_id: 1,
    sku_id: id,
    state: id === 1 ? "paused" : "active",
    total_quota: 100,
    used_quota: 0,
    reserved_quota: 0,
    daily_quota: 0,
    reset_timezone: "Asia/Shanghai",
    start_at: 100,
    expire_at: 200,
    activation_deadline: 0,
    sort_order: 0,
    source_type: "order",
    created_at: 100,
  };
}

describe("user subscription management data", () => {
  test("uses entitlement-center subscriptions and active subscription SKUs", () => {
    const products: Product[] = [
      {
        id: 1,
        code: "subscription",
        name: "GPT Pro",
        description: "",
        category: "subscription",
        status: "active",
        sort_order: 0,
        visibility_rule: "",
        skus: [createSKU(1, "active"), createSKU(2, "archived")],
      },
      {
        id: 2,
        code: "recharge",
        name: "PAYGO",
        description: "",
        category: "recharge",
        status: "active",
        sort_order: 0,
        visibility_rule: "",
        skus: [createSKU(3, "active")],
      },
    ];

    const result = buildManagedSubscriptionData(products, {
      entitlements: [
        createEntitlement(1, "subscription"),
        createEntitlement(3, "stored_value"),
      ],
      types: [],
    });

    assert.deepEqual(
      result.entitlements.map((entitlement) => [
        entitlement.id,
        entitlement.state,
      ]),
      [[1, "paused"]],
    );
    assert.deepEqual(
      result.subscriptionSKUs.map((sku) => [sku.id, sku.display_name]),
      [[1, "GPT Pro · SKU 1"]],
    );
  });
});
