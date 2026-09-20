package model

import (
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func resetEntitlementFixtures(t *testing.T) {
	t.Helper()
	tables := []interface{}{
		&UsageChargeAllocation{}, &UsageCharge{}, &EntitlementDailyUsage{},
		&EntitlementAdjustmentLedger{}, &Entitlement{}, &ProductOrderItem{},
		&ProductOrder{}, &ProductSKU{}, &Product{}, &EntitlementTypeChangeLog{},
		&EntitlementTypeGroup{}, &EntitlementType{}, &AccessGroupPolicy{},
	}
	for _, table := range tables {
		require.NoError(t, DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Unscoped().Delete(table).Error)
	}
	t.Cleanup(func() {
		for _, table := range tables {
			_ = DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Unscoped().Delete(table).Error
		}
	})
}

func seedEntitlementType(t *testing.T, code string, assetKind string, groups ...string) EntitlementType {
	t.Helper()
	for _, group := range groups {
		var count int64
		require.NoError(t, DB.Model(&AccessGroupPolicy{}).Where("group_name = ?", group).Count(&count).Error)
		if count == 0 {
			require.NoError(t, DB.Create(&AccessGroupPolicy{GroupName: group, FundingSourceType: assetKind}).Error)
		}
	}
	entitlementType := EntitlementType{
		Code: code, Name: code, AssetKind: assetKind,
		MeterType: EntitlementMeterQuota, Status: EntitlementTypeStatusActive,
	}
	require.NoError(t, DB.Create(&entitlementType).Error)
	require.NoError(t, ReplaceEntitlementTypeGroups(entitlementType.Id, groups, 1, "test setup"))
	return entitlementType
}

func seedEntitlement(t *testing.T, userId int, typeId int, assetKind string, quota int64, daily int64, sortOrder int) Entitlement {
	t.Helper()
	entitlement := Entitlement{
		UserId: userId, EntitlementTypeId: typeId, AssetKind: assetKind,
		State: EntitlementStateActive, TotalQuota: quota, DailyQuota: daily,
		StartAt: GetDBTimestamp() - 10, ExpireAt: GetDBTimestamp() + 86400,
		SortOrder: sortOrder, ResetTimezone: "Asia/Shanghai",
	}
	require.NoError(t, DB.Create(&entitlement).Error)
	return entitlement
}

func TestEntitlementAggregateReserveSettleAndIdempotency(t *testing.T) {
	resetEntitlementFixtures(t)
	typeSub := seedEntitlementType(t, "mix-sub", EntitlementAssetSubscription, "gpt-mix-sub")
	first := seedEntitlement(t, 101, typeSub.Id, typeSub.AssetKind, 3, 0, 0)
	second := seedEntitlement(t, 101, typeSub.Id, typeSub.AssetKind, 7, 0, 1)

	reserved, err := PreConsumeEntitlements("req-aggregate", 101, 9, "gpt-mix-sub", EntitlementAssetSubscription, "gpt-5", 8)
	require.NoError(t, err)
	require.Len(t, reserved.Allocations, 2)
	assert.EqualValues(t, 3, reserved.Allocations[0].ReservedQuota)
	assert.EqualValues(t, 5, reserved.Allocations[1].ReservedQuota)

	again, err := PreConsumeEntitlements("req-aggregate", 101, 9, "gpt-mix-sub", EntitlementAssetSubscription, "gpt-5", 8)
	require.NoError(t, err)
	assert.Equal(t, reserved.UsageChargeId, again.UsageChargeId)
	assert.EqualValues(t, 8, again.ReservedQuota)

	require.NoError(t, SettleEntitlementCharge("req-aggregate", 6))
	require.NoError(t, DB.First(&first, first.Id).Error)
	require.NoError(t, DB.First(&second, second.Id).Error)
	assert.EqualValues(t, 3, first.UsedQuota)
	assert.Equal(t, EntitlementStateDepleted, first.State)
	assert.EqualValues(t, 3, second.UsedQuota)
	assert.Zero(t, first.ReservedQuota)
	assert.Zero(t, second.ReservedQuota)

	var charge UsageCharge
	require.NoError(t, DB.Preload("Allocations").Where("request_id = ?", "req-aggregate").First(&charge).Error)
	assert.Equal(t, UsageChargeStateSettled, charge.State)
	assert.EqualValues(t, 6, charge.SettledQuota)
	assert.Len(t, charge.Allocations, 2)
	assert.EqualValues(t, 2, charge.Allocations[1].RefundedQuota)

	_, err = PreConsumeEntitlements("req-too-large", 101, 9, "gpt-mix-sub", EntitlementAssetSubscription, "gpt-5", 5)
	require.ErrorIs(t, err, ErrEntitlementQuotaInsufficient)
	assert.ErrorIs(t, DB.Where("request_id = ?", "req-too-large").First(&UsageCharge{}).Error, gorm.ErrRecordNotFound)
}

func TestEntitlementSharedGroupsDynamicPolicyAndFundingIsolation(t *testing.T) {
	resetEntitlementFixtures(t)
	typeSub := seedEntitlementType(t, "pro-sub", EntitlementAssetSubscription, "gpt-pro-sub", "gpt-mix-sub")
	seedEntitlement(t, 202, typeSub.Id, typeSub.AssetKind, 10, 0, 0)

	_, err := PreConsumeEntitlements("req-shared-one", 202, 1, "gpt-pro-sub", EntitlementAssetSubscription, "gpt-5", 6)
	require.NoError(t, err)
	require.NoError(t, SettleEntitlementCharge("req-shared-one", 6))
	_, err = PreConsumeEntitlements("req-shared-two", 202, 1, "gpt-mix-sub", EntitlementAssetSubscription, "gpt-5", 5)
	require.ErrorIs(t, err, ErrEntitlementQuotaInsufficient)

	allowed, err := UserCanUseEntitlementGroup(202, "gpt-mix-sub")
	require.NoError(t, err)
	assert.True(t, allowed)
	require.NoError(t, ReplaceEntitlementTypeGroups(typeSub.Id, []string{"gpt-pro-sub"}, 2, "remove mix"))
	allowed, err = UserCanUseEntitlementGroup(202, "gpt-mix-sub")
	require.NoError(t, err)
	assert.False(t, allowed)
	_, err = PreConsumeEntitlements("req-removed-group", 202, 1, "gpt-mix-sub", EntitlementAssetSubscription, "gpt-5", 1)
	require.ErrorIs(t, err, ErrEntitlementQuotaInsufficient)

	typeStored := seedEntitlementType(t, "pro-paygo", EntitlementAssetStoredValue, "gpt-pro-paygo")
	seedEntitlement(t, 202, typeStored.Id, typeStored.AssetKind, 100, 0, 0)
	_, err = PreConsumeEntitlements("req-wrong-fund", 202, 1, "gpt-pro-paygo", EntitlementAssetSubscription, "gpt-5", 1)
	require.ErrorIs(t, err, ErrEntitlementFundingMismatch)
	_, err = PreConsumeEntitlements("req-correct-fund", 202, 1, "gpt-pro-paygo", EntitlementAssetStoredValue, "gpt-5", 1)
	require.NoError(t, err)
	require.NoError(t, RefundEntitlementCharge("req-correct-fund"))
	require.NoError(t, RefundEntitlementCharge("req-correct-fund"))

	var logs []EntitlementTypeChangeLog
	require.NoError(t, DB.Where("entitlement_type_id = ?", typeSub.Id).Order("revision asc").Find(&logs).Error)
	assert.Len(t, logs, 2)
}

func TestPauseEntitlementStopsUsageWithoutExtendingValidity(t *testing.T) {
	resetEntitlementFixtures(t)
	entitlementType := seedEntitlementType(t, "pause-sub", EntitlementAssetSubscription, "pause-sub")
	entitlement := seedEntitlement(t, 303, entitlementType.Id, entitlementType.AssetKind, 100, 0, 0)
	originalExpireAt := entitlement.ExpireAt

	require.NoError(t, PauseEntitlement(entitlement.Id))
	require.NoError(t, DB.First(&entitlement, entitlement.Id).Error)
	assert.Equal(t, EntitlementStatePaused, entitlement.State)
	assert.Equal(t, originalExpireAt, entitlement.ExpireAt)

	_, err := PreConsumeEntitlements("paused-request", 303, 1, "pause-sub", EntitlementAssetSubscription, "gpt-5", 1)
	require.ErrorIs(t, err, ErrEntitlementQuotaInsufficient)

	require.NoError(t, ResumeEntitlement(entitlement.Id))
	require.NoError(t, DB.First(&entitlement, entitlement.Id).Error)
	assert.Equal(t, EntitlementStateActive, entitlement.State)
	assert.Equal(t, originalExpireAt, entitlement.ExpireAt)
}

func TestPausedEntitlementExpiresOnOriginalSchedule(t *testing.T) {
	resetEntitlementFixtures(t)
	entitlementType := seedEntitlementType(t, "expiring-pause-sub", EntitlementAssetSubscription)
	entitlement := seedEntitlement(t, 304, entitlementType.Id, entitlementType.AssetKind, 100, 0, 0)
	require.NoError(t, PauseEntitlement(entitlement.Id))
	require.NoError(t, DB.Model(&entitlement).Update("expire_at", GetDBTimestamp()-1).Error)

	require.NoError(t, RefreshUserEntitlementStates(entitlement.UserId))
	require.NoError(t, DB.First(&entitlement, entitlement.Id).Error)
	assert.Equal(t, EntitlementStateExpired, entitlement.State)
}

func TestGrantProductSKUEntitlementUsesSKUConfiguration(t *testing.T) {
	resetEntitlementFixtures(t)
	entitlementType := seedEntitlementType(t, "admin-sku-sub", EntitlementAssetSubscription)
	product := Product{Code: "admin-sku-product", Name: "Admin SKU Product", Category: ProductCategorySubscription, Status: ProductStatusActive}
	require.NoError(t, DB.Create(&product).Error)
	sku := ProductSKU{
		Code: "admin-sku", ProductId: product.Id, EntitlementTypeId: entitlementType.Id,
		Name: "Admin SKU", GrantTotalQuota: 123, GrantDailyQuota: 45,
		ValiditySeconds: 3600, ActivationPolicy: ActivationPolicyImmediate, Status: ProductStatusActive,
	}
	require.NoError(t, DB.Create(&sku).Error)

	entitlement, err := GrantProductSKUEntitlement(305, sku.Id, 1)
	require.NoError(t, err)
	assert.Equal(t, sku.Id, entitlement.SKUId)
	assert.Equal(t, product.Id, entitlement.ProductId)
	assert.EqualValues(t, 123, entitlement.TotalQuota)
	assert.EqualValues(t, 45, entitlement.DailyQuota)
	assert.Equal(t, EntitlementStateActive, entitlement.State)
	assert.EqualValues(t, 3600, entitlement.ExpireAt-entitlement.StartAt)
}

func TestDeleteProductSKURejectsReferencedSKU(t *testing.T) {
	resetEntitlementFixtures(t)
	entitlementType := seedEntitlementType(t, "delete-sku-sub", EntitlementAssetSubscription)
	product := Product{Code: "delete-sku-product", Name: "Delete SKU Product", Category: ProductCategorySubscription, Status: ProductStatusActive}
	require.NoError(t, DB.Create(&product).Error)
	unusedSKU := ProductSKU{Code: "unused-sku", ProductId: product.Id, EntitlementTypeId: entitlementType.Id, Name: "Unused", GrantTotalQuota: 1, ValiditySeconds: 60, ActivationPolicy: ActivationPolicyImmediate, Status: ProductStatusActive}
	require.NoError(t, DB.Create(&unusedSKU).Error)
	require.NoError(t, DeleteProductSKU(unusedSKU.Id))
	assert.ErrorIs(t, DB.First(&ProductSKU{}, unusedSKU.Id).Error, gorm.ErrRecordNotFound)

	referencedSKU := ProductSKU{Code: "referenced-sku", ProductId: product.Id, EntitlementTypeId: entitlementType.Id, Name: "Referenced", GrantTotalQuota: 1, ValiditySeconds: 60, ActivationPolicy: ActivationPolicyImmediate, Status: ProductStatusActive}
	require.NoError(t, DB.Create(&referencedSKU).Error)
	require.NoError(t, DB.Create(&Entitlement{UserId: 306, EntitlementTypeId: entitlementType.Id, AssetKind: EntitlementAssetSubscription, ProductId: product.Id, SKUId: referencedSKU.Id, TotalQuota: 1}).Error)

	err := DeleteProductSKU(referencedSKU.Id)
	require.EqualError(t, err, "SKU has order or entitlement records; archive it instead")
	require.NoError(t, DB.First(&referencedSKU, referencedSKU.Id).Error)
}

func TestEntitlementDailyLimitAndQuantityFulfillment(t *testing.T) {
	resetEntitlementFixtures(t)
	typeSub := seedEntitlementType(t, "daily-sub", EntitlementAssetSubscription, "daily-sub")
	entitlement := seedEntitlement(t, 303, typeSub.Id, typeSub.AssetKind, 20, 5, 0)

	_, err := PreConsumeEntitlements("req-daily", 303, 1, "daily-sub", EntitlementAssetSubscription, "gpt-5", 5)
	require.NoError(t, err)
	require.NoError(t, SettleEntitlementCharge("req-daily", 5))
	_, err = PreConsumeEntitlements("req-daily-over", 303, 1, "daily-sub", EntitlementAssetSubscription, "gpt-5", 1)
	require.ErrorIs(t, err, ErrEntitlementQuotaInsufficient)

	periodStart, _ := entitlementDailyPeriod(time.Now(), entitlement.ResetTimezone)
	var daily EntitlementDailyUsage
	require.NoError(t, DB.Where("entitlement_id = ? AND period_start = ?", entitlement.Id, periodStart).First(&daily).Error)
	assert.EqualValues(t, 5, daily.UsedQuota)
	assert.Zero(t, daily.ReservedQuota)

	product := Product{Code: "three-pack", Name: "Three Pack", Category: ProductCategorySubscription, Status: ProductStatusActive}
	require.NoError(t, DB.Create(&product).Error)
	sku := ProductSKU{
		Code: fmt.Sprintf("three-pack-%d", time.Now().UnixNano()), ProductId: product.Id,
		EntitlementTypeId: typeSub.Id, Name: "Three Pack SKU", Currency: "CNY",
		GrantTotalQuota: 100, ValiditySeconds: 3600, ActivationPolicy: ActivationPolicyImmediate,
		MultiQuantityEnabled: true, Status: ProductStatusActive,
	}
	require.NoError(t, DB.Create(&sku).Error)
	order, err := CreateProductOrder(404, sku.Id, 3, 0)
	require.NoError(t, err)
	require.NoError(t, CompleteProductOrder(order.OrderNo, "", "free"))
	require.NoError(t, CompleteProductOrder(order.OrderNo, "", "free"))
	var count int64
	require.NoError(t, DB.Model(&Entitlement{}).Where("source_type = ? AND source_id = ?", "order", order.Id).Count(&count).Error)
	assert.EqualValues(t, 3, count)
}

func TestRechargeOrderUsesCustomerAmountAndCreatesOneEntitlement(t *testing.T) {
	resetEntitlementFixtures(t)
	typeStored := seedEntitlementType(t, "custom-paygo", EntitlementAssetStoredValue, "gpt-pro-paygo")
	product := Product{
		Code: "custom-recharge", Name: "Custom Recharge",
		Category: ProductCategoryRecharge, Status: ProductStatusActive,
	}
	require.NoError(t, DB.Create(&product).Error)
	sku := ProductSKU{
		Code:      fmt.Sprintf("custom-recharge-%d", time.Now().UnixNano()),
		ProductId: product.Id, EntitlementTypeId: typeStored.Id, Name: "Recharge Rule",
		PriceAmountMinor: 1_000, Currency: "CNY", GrantTotalQuota: 500,
		GrantDailyQuota: 50, MinRechargeAmountMinor: 1_000, MaxRechargeAmountMinor: 10_000,
		ActivationPolicy: ActivationPolicyImmediate, Status: ProductStatusActive,
	}
	require.NoError(t, DB.Create(&sku).Error)

	order, err := CreateProductOrder(505, sku.Id, 1, 2_500)
	require.NoError(t, err)
	assert.EqualValues(t, 2_500, order.TotalAmountMinor)
	require.Len(t, order.Items, 1)
	assert.EqualValues(t, 2_500, order.Items[0].UnitPriceAmountMinor)
	assert.EqualValues(t, 1_250, order.Items[0].GrantTotalQuota)
	assert.EqualValues(t, 125, order.Items[0].GrantDailyQuota)
	assert.Equal(t, 1, order.Items[0].Quantity)

	require.NoError(t, CompleteProductOrder(order.OrderNo, "", "free"))
	var entitlements []Entitlement
	require.NoError(t, DB.Where("source_type = ? AND source_id = ?", "order", order.Id).Find(&entitlements).Error)
	require.Len(t, entitlements, 1)
	assert.EqualValues(t, 1_250, entitlements[0].TotalQuota)
	assert.EqualValues(t, 125, entitlements[0].DailyQuota)

	_, err = CreateProductOrder(505, sku.Id, 1, 999)
	assert.ErrorContains(t, err, "outside the allowed range")
	_, err = CreateProductOrder(505, sku.Id, 1, 10_001)
	assert.ErrorContains(t, err, "outside the allowed range")
	_, err = CreateProductOrder(505, sku.Id, 2, 2_500)
	assert.ErrorContains(t, err, "one pricing rule sku")
}

func TestQueuedEntitlementBecomesActiveWhenItsStartTimeArrives(t *testing.T) {
	resetEntitlementFixtures(t)
	typeSub := seedEntitlementType(t, "queued-sub", EntitlementAssetSubscription, "queued-sub")
	entitlement := Entitlement{
		UserId: 606, EntitlementTypeId: typeSub.Id, AssetKind: typeSub.AssetKind,
		State: EntitlementStateQueued, TotalQuota: 100, StartAt: GetDBTimestamp() - 1,
		ExpireAt: GetDBTimestamp() + 3600, ResetTimezone: "Asia/Shanghai",
	}
	require.NoError(t, DB.Create(&entitlement).Error)

	result, err := PreConsumeEntitlements("req-queued-active", 606, 1, "queued-sub", EntitlementAssetSubscription, "gpt-5", 10)
	require.NoError(t, err)
	assert.EqualValues(t, 10, result.ReservedQuota)
	require.NoError(t, DB.First(&entitlement, entitlement.Id).Error)
	assert.Equal(t, EntitlementStateActive, entitlement.State)

	pending := Entitlement{
		UserId: 606, EntitlementTypeId: typeSub.Id, AssetKind: typeSub.AssetKind,
		State: EntitlementStatePending, TotalQuota: 100,
		ActivationDeadline: GetDBTimestamp() - 1, ResetTimezone: "Asia/Shanghai",
	}
	require.NoError(t, DB.Create(&pending).Error)
	require.NoError(t, RefreshUserEntitlementStates(606))
	require.NoError(t, DB.First(&pending, pending.Id).Error)
	assert.Equal(t, EntitlementStateExpired, pending.State)
}

func TestOrderCancellationAndExpirationRestoreReservedStock(t *testing.T) {
	resetEntitlementFixtures(t)
	typeSub := seedEntitlementType(t, "stock-sub", EntitlementAssetSubscription, "stock-sub")
	product := Product{Code: "stock-product", Name: "Stock Product", Category: ProductCategorySubscription, Status: ProductStatusActive}
	require.NoError(t, DB.Create(&product).Error)
	sku := ProductSKU{
		Code: fmt.Sprintf("stock-sku-%d", time.Now().UnixNano()), ProductId: product.Id,
		EntitlementTypeId: typeSub.Id, Name: "Stock SKU", PriceAmountMinor: 100,
		GrantTotalQuota: 100, ValiditySeconds: 3600, ActivationPolicy: ActivationPolicyImmediate,
		Stock: 2, MultiQuantityEnabled: true, Status: ProductStatusActive,
	}
	require.NoError(t, DB.Create(&sku).Error)

	order, err := CreateProductOrder(707, sku.Id, 2, 0)
	require.NoError(t, err)
	require.NoError(t, DB.First(&sku, sku.Id).Error)
	assert.Zero(t, sku.Stock)
	_, err = CreateProductOrder(708, sku.Id, 1, 0)
	assert.ErrorContains(t, err, "stock insufficient")
	require.NoError(t, CancelProductOrder(order.OrderNo, 707, "changed mind"))
	require.NoError(t, CancelProductOrder(order.OrderNo, 707, "changed mind"))
	require.NoError(t, DB.First(&sku, sku.Id).Error)
	assert.EqualValues(t, 2, sku.Stock)

	expiredOrder, err := CreateProductOrder(707, sku.Id, 1, 0)
	require.NoError(t, err)
	require.NoError(t, DB.Model(&ProductOrder{}).Where("id = ?", expiredOrder.Id).Update("expires_at", GetDBTimestamp()-1).Error)
	count, err := ExpirePendingProductOrders(10)
	require.NoError(t, err)
	assert.Equal(t, 1, count)
	require.NoError(t, DB.First(expiredOrder, expiredOrder.Id).Error)
	assert.Equal(t, ProductOrderStatusCancelled, expiredOrder.Status)
	require.NoError(t, DB.First(&sku, sku.Id).Error)
	assert.EqualValues(t, 2, sku.Stock)
}

func TestProductOrderRefundOnlyAllowsUnusedEntitlements(t *testing.T) {
	resetEntitlementFixtures(t)
	typeSub := seedEntitlementType(t, "refund-sub", EntitlementAssetSubscription, "refund-sub")
	product := Product{Code: "refund-product", Name: "Refund Product", Category: ProductCategorySubscription, Status: ProductStatusActive}
	require.NoError(t, DB.Create(&product).Error)
	sku := ProductSKU{
		Code: fmt.Sprintf("refund-sku-%d", time.Now().UnixNano()), ProductId: product.Id,
		EntitlementTypeId: typeSub.Id, Name: "Refund SKU", PriceAmountMinor: 100,
		GrantTotalQuota: 100, ValiditySeconds: 3600, ActivationPolicy: ActivationPolicyImmediate,
		Stock: 2, Status: ProductStatusActive,
	}
	require.NoError(t, DB.Create(&sku).Error)

	refundable, err := CreateProductOrder(808, sku.Id, 1, 0)
	require.NoError(t, err)
	require.NoError(t, CompleteProductOrder(refundable.OrderNo, "trade-refund-1", "manual"))
	require.NoError(t, RefundProductOrder(refundable.OrderNo, 1, "approved refund"))
	require.NoError(t, DB.First(refundable, refundable.Id).Error)
	assert.Equal(t, ProductOrderStatusRefunded, refundable.Status)
	var refundedEntitlement Entitlement
	require.NoError(t, DB.Where("source_type = ? AND source_id = ?", "order", refundable.Id).First(&refundedEntitlement).Error)
	assert.Equal(t, EntitlementStateCancelled, refundedEntitlement.State)

	nonRefundable, err := CreateProductOrder(808, sku.Id, 1, 0)
	require.NoError(t, err)
	require.NoError(t, CompleteProductOrder(nonRefundable.OrderNo, "trade-refund-2", "manual"))
	require.NoError(t, DB.Model(&Entitlement{}).Where("source_type = ? AND source_id = ?", "order", nonRefundable.Id).Update("used_quota", 1).Error)
	err = RefundProductOrder(nonRefundable.OrderNo, 1, "should fail")
	assert.ErrorContains(t, err, "consumed or reserved")
}

func TestInitiatedPaymentRequiresReconciliationBeforeCancellation(t *testing.T) {
	resetEntitlementFixtures(t)
	typeSub := seedEntitlementType(t, "reconcile-sub", EntitlementAssetSubscription, "reconcile-sub")
	product := Product{Code: "reconcile-product", Name: "Reconcile Product", Category: ProductCategorySubscription, Status: ProductStatusActive}
	require.NoError(t, DB.Create(&product).Error)
	sku := ProductSKU{
		Code: fmt.Sprintf("reconcile-sku-%d", time.Now().UnixNano()), ProductId: product.Id,
		EntitlementTypeId: typeSub.Id, Name: "Reconcile SKU", PriceAmountMinor: 100,
		GrantTotalQuota: 100, ValiditySeconds: 3600, ActivationPolicy: ActivationPolicyImmediate,
		Status: ProductStatusActive,
	}
	require.NoError(t, DB.Create(&sku).Error)
	order, err := CreateProductOrder(909, sku.Id, 1, 0)
	require.NoError(t, err)
	_, err = PrepareProductOrderPayment(order.OrderNo, 909, PaymentProviderEpay, "alipay")
	require.NoError(t, err)
	err = CancelProductOrder(order.OrderNo, 909, "unsafe cancel")
	assert.ErrorContains(t, err, "must be reconciled")
	require.NoError(t, ResetProductOrderPaymentPreparation(order.OrderNo, 909, PaymentProviderEpay, "confirmed unpaid"))
	require.NoError(t, CancelProductOrder(order.OrderNo, 909, "confirmed unpaid"))
}
