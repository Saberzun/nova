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
	order, err := CreateProductOrder(404, sku.Id, 3)
	require.NoError(t, err)
	require.NoError(t, CompleteProductOrder(order.OrderNo, "", "free"))
	require.NoError(t, CompleteProductOrder(order.OrderNo, "", "free"))
	var count int64
	require.NoError(t, DB.Model(&Entitlement{}).Where("source_type = ? AND source_id = ?", "order", order.Id).Count(&count).Error)
	assert.EqualValues(t, 3, count)
}
