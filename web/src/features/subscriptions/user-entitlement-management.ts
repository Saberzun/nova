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
import type {
  Entitlement,
  Product,
  ProductSKU,
  UserEntitlementData,
} from "../entitlements/types";

export interface ManagedSubscriptionSKU extends ProductSKU {
  display_name: string;
}

export interface ManagedSubscriptionData {
  entitlements: Entitlement[];
  subscriptionSKUs: ManagedSubscriptionSKU[];
  types: UserEntitlementData["types"];
}

export function buildManagedSubscriptionData(
  products: Product[],
  userData: UserEntitlementData,
): ManagedSubscriptionData {
  const subscriptionSKUs = products
    .filter(
      (product) =>
        product.category === "subscription" && product.status === "active",
    )
    .flatMap((product) =>
      (product.skus ?? [])
        .filter((sku) => sku.status === "active")
        .map((sku) => ({
          ...sku,
          display_name: `${product.name} · ${sku.name}`,
        })),
    );

  return {
    entitlements: userData.entitlements.filter(
      (entitlement) => entitlement.asset_kind === "subscription",
    ),
    subscriptionSKUs,
    types: userData.types,
  };
}
