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
import { Ban, Pause, Play, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  DataTableRowActionMenu,
  StaticDataTable,
} from "@/components/data-table";
import {
  sideDrawerContentClassName,
  sideDrawerFormClassName,
  sideDrawerHeaderClassName,
} from "@/components/drawer-layout";
import { StatusBadge } from "@/components/status-badge";
import { TableId } from "@/components/table-id";
import { Button } from "@/components/ui/button";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  getAdminProducts,
  getUserEntitlements,
  grantProductSKUEntitlement,
  pauseEntitlement,
  resumeEntitlement,
  revokeEntitlement,
} from "@/features/entitlements/api";
import { formatDate } from "@/features/entitlements/lib";
import type {
  Entitlement,
  EntitlementType,
} from "@/features/entitlements/types";
import { formatQuota } from "@/lib/format";

import {
  buildManagedSubscriptionData,
  type ManagedSubscriptionSKU,
} from "../../user-entitlement-management";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: { id: number; username?: string } | null;
  onSuccess?: () => void;
}

type EntitlementAction = "pause" | "resume" | "revoke";

export function UserSubscriptionsDialog(props: Props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [entitlements, setEntitlements] = useState<Entitlement[]>([]);
  const [types, setTypes] = useState<EntitlementType[]>([]);
  const [subscriptionSKUs, setSubscriptionSKUs] = useState<
    ManagedSubscriptionSKU[]
  >([]);
  const [selectedSKUId, setSelectedSKUId] = useState("");
  const [pendingAction, setPendingAction] = useState<{
    type: EntitlementAction;
    entitlementId: number;
  } | null>(null);

  const typeMap = useMemo(
    () => new Map(types.map((type) => [type.id, type])),
    [types],
  );
  const skuMap = useMemo(
    () => new Map(subscriptionSKUs.map((sku) => [sku.id, sku])),
    [subscriptionSKUs],
  );

  const loadData = useCallback(async () => {
    if (!props.user?.id) return;
    setLoading(true);
    try {
      const [productsResponse, entitlementsResponse] = await Promise.all([
        getAdminProducts(),
        getUserEntitlements(props.user.id),
      ]);
      if (!productsResponse.success || !entitlementsResponse.success) {
        throw new Error(t("Loading failed"));
      }
      const managedData = buildManagedSubscriptionData(
        productsResponse.data ?? [],
        entitlementsResponse.data ?? { entitlements: [], types: [] },
      );
      setSubscriptionSKUs(managedData.subscriptionSKUs);
      setEntitlements(managedData.entitlements);
      setTypes(managedData.types);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Loading failed"));
    } finally {
      setLoading(false);
    }
  }, [props.user?.id, t]);

  useEffect(() => {
    if (!props.open || !props.user?.id) return;
    setSelectedSKUId("");
    void loadData();
  }, [props.open, props.user?.id, loadData]);

  const handleCreate = async () => {
    if (!props.user?.id || !selectedSKUId) {
      toast.error(t("Please select a subscription SKU"));
      return;
    }
    setCreating(true);
    try {
      const response = await grantProductSKUEntitlement(
        props.user.id,
        Number(selectedSKUId),
      );
      if (!response.success) {
        throw new Error(response.message || t("Operation failed"));
      }
      toast.success(t("Entitlement granted"));
      setSelectedSKUId("");
      await loadData();
      props.onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("Operation failed"),
      );
    } finally {
      setCreating(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!pendingAction) return;
    try {
      let response;
      if (pendingAction.type === "pause") {
        response = await pauseEntitlement(pendingAction.entitlementId);
      } else if (pendingAction.type === "resume") {
        response = await resumeEntitlement(pendingAction.entitlementId);
      } else {
        response = await revokeEntitlement(pendingAction.entitlementId);
      }
      if (!response.success) {
        throw new Error(response.message || t("Operation failed"));
      }
      let successMessage = t("Entitlement revoked");
      if (pendingAction.type === "pause") {
        successMessage = t("Entitlement paused");
      } else if (pendingAction.type === "resume") {
        successMessage = t("Entitlement resumed");
      }
      toast.success(successMessage);
      await loadData();
      props.onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("Operation failed"),
      );
    } finally {
      setPendingAction(null);
    }
  };

  let actionTitle = t("Revoke subscription");
  let actionDescription = t(
    "Revoking immediately disables this subscription and cannot be undone. Continue?",
  );
  let actionConfirmText = t("Revoke");
  if (pendingAction?.type === "pause") {
    actionTitle = t("Pause subscription");
    actionDescription = t(
      "Pausing stops quota usage, but the subscription expiry time will continue to count down. Continue?",
    );
    actionConfirmText = t("Pause");
  } else if (pendingAction?.type === "resume") {
    actionTitle = t("Resume subscription");
    actionDescription = t("Resume quota usage for this subscription?");
    actionConfirmText = t("Resume");
  }

  return (
    <>
      <Sheet open={props.open} onOpenChange={props.onOpenChange}>
        <SheetContent className={sideDrawerContentClassName("sm:max-w-3xl")}>
          <SheetHeader className={sideDrawerHeaderClassName()}>
            <SheetTitle>{t("User Subscription Management")}</SheetTitle>
            <SheetDescription>
              {props.user?.username || "-"} (ID: {props.user?.id || "-"})
            </SheetDescription>
          </SheetHeader>

          <div className={sideDrawerFormClassName()}>
            <div className="flex gap-2">
              <Select
                items={subscriptionSKUs.map((sku) => ({
                  value: String(sku.id),
                  label: `${sku.display_name} (¥${(sku.price_amount_minor / 100).toFixed(2)})`,
                }))}
                value={selectedSKUId}
                onValueChange={(value) =>
                  value !== null && setSelectedSKUId(value)
                }
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder={t("Select subscription SKU")} />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectGroup>
                    {subscriptionSKUs.map((sku) => (
                      <SelectItem key={sku.id} value={String(sku.id)}>
                        {sku.display_name} (¥
                        {(sku.price_amount_minor / 100).toFixed(2)})
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Button
                onClick={handleCreate}
                disabled={creating || !selectedSKUId}
              >
                <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
                {t("Add subscription")}
              </Button>
            </div>

            <StaticDataTable
              data={loading ? [] : entitlements}
              getRowKey={(entitlement) => entitlement.id}
              emptyClassName={loading ? "py-8" : "text-muted-foreground py-8"}
              emptyContent={
                loading ? t("Loading...") : t("No subscription records")
              }
              columns={[
                {
                  id: "id",
                  header: t("ID"),
                  cell: (entitlement) => <TableId value={entitlement.id} />,
                },
                {
                  id: "subscription",
                  header: t("Subscription"),
                  cell: (entitlement) => (
                    <div>
                      <div className="font-medium">
                        {skuMap.get(entitlement.sku_id)?.display_name ||
                          typeMap.get(entitlement.entitlement_type_id)?.name ||
                          `#${entitlement.id}`}
                      </div>
                      <div className="text-muted-foreground text-sm">
                        {t("Source")}: {entitlement.source_type || "-"}
                      </div>
                    </div>
                  ),
                },
                {
                  id: "status",
                  header: t("Status"),
                  cell: (entitlement) => (
                    <StatusBadge
                      label={t(entitlement.state)}
                      variant={
                        entitlement.state === "active" ? "success" : "neutral"
                      }
                      copyable={false}
                    />
                  ),
                },
                {
                  id: "validity",
                  header: t("Validity"),
                  cell: (entitlement) => (
                    <div className="text-sm">
                      <div>
                        {t("Start")}: {formatDate(entitlement.start_at)}
                      </div>
                      <div>
                        {t("End")}: {formatDate(entitlement.expire_at)}
                      </div>
                    </div>
                  ),
                },
                {
                  id: "quota",
                  header: t("Remaining quota"),
                  cell: (entitlement) => (
                    <div className="text-sm">
                      <div>
                        {formatQuota(
                          Math.max(
                            0,
                            entitlement.total_quota -
                              entitlement.used_quota -
                              entitlement.reserved_quota,
                          ),
                        )}
                      </div>
                      <div className="text-muted-foreground">
                        {formatQuota(entitlement.used_quota)} /{" "}
                        {formatQuota(entitlement.total_quota)}
                      </div>
                      <div className="text-muted-foreground">
                        {t("Daily quota")}:{" "}
                        {entitlement.daily_quota > 0
                          ? formatQuota(entitlement.daily_quota)
                          : t("Unlimited")}
                      </div>
                    </div>
                  ),
                },
                {
                  id: "actions",
                  header: t("Actions"),
                  className: "text-right",
                  cellClassName: "text-right",
                  cell: (entitlement) => (
                    <DataTableRowActionMenu ariaLabel={t("Actions")}>
                      {entitlement.state === "active" ? (
                        <DropdownMenuItem
                          onClick={() =>
                            setPendingAction({
                              type: "pause",
                              entitlementId: entitlement.id,
                            })
                          }
                        >
                          {t("Pause")}
                          <DropdownMenuShortcut>
                            <Pause size={16} />
                          </DropdownMenuShortcut>
                        </DropdownMenuItem>
                      ) : null}
                      {entitlement.state === "paused" ? (
                        <DropdownMenuItem
                          onClick={() =>
                            setPendingAction({
                              type: "resume",
                              entitlementId: entitlement.id,
                            })
                          }
                        >
                          {t("Resume")}
                          <DropdownMenuShortcut>
                            <Play size={16} />
                          </DropdownMenuShortcut>
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        disabled={entitlement.state === "cancelled"}
                        onClick={() =>
                          setPendingAction({
                            type: "revoke",
                            entitlementId: entitlement.id,
                          })
                        }
                      >
                        {t("Revoke")}
                        <DropdownMenuShortcut>
                          <Ban size={16} />
                        </DropdownMenuShortcut>
                      </DropdownMenuItem>
                    </DataTableRowActionMenu>
                  ),
                },
              ]}
            />
          </div>
        </SheetContent>
      </Sheet>

      {pendingAction ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setPendingAction(null)}
          title={actionTitle}
          desc={actionDescription}
          confirmText={actionConfirmText}
          handleConfirm={handleConfirmAction}
          destructive={pendingAction.type === "revoke"}
        />
      ) : null}
    </>
  );
}
