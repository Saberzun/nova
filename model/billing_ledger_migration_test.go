package model

import (
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestMigrateBillingLedgerToNanoUSDIsAtomicAndIdempotent(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(
		&Option{},
		&User{},
		&ProductSKU{},
		&Entitlement{},
	))

	previousDB := DB
	DB = db
	t.Cleanup(func() { DB = previousDB })

	require.NoError(t, db.Create(&Option{Key: "QuotaPerUnit", Value: "500000"}).Error)
	require.NoError(t, db.Create(&User{Id: 1, Username: "ledger-user", Password: "password", Quota: 500_000, UsedQuota: 250_000}).Error)
	require.NoError(t, db.Create(&ProductSKU{
		Code: "ledger-sku", ProductId: 1, EntitlementTypeId: 1, Name: "Ledger SKU",
		Currency: "CNY", GrantTotalQuota: 1_000_000, GrantDailyQuota: 500_000,
		ActivationPolicy: ActivationPolicyImmediate, Status: ProductStatusActive,
	}).Error)
	require.NoError(t, db.Create(&Entitlement{
		UserId: 1, EntitlementTypeId: 1, AssetKind: EntitlementAssetSubscription,
		State: EntitlementStateActive, TotalQuota: 500_000, UsedQuota: 100_000,
		ResetTimezone: "Asia/Shanghai",
	}).Error)

	require.NoError(t, migrateBillingLedgerToNanoUSD())
	require.NoError(t, migrateBillingLedgerToNanoUSD())

	var user User
	require.NoError(t, db.First(&user, 1).Error)
	require.Equal(t, 1_000_000_000, user.Quota)
	require.Equal(t, 500_000_000, user.UsedQuota)

	var sku ProductSKU
	require.NoError(t, db.Where("code = ?", "ledger-sku").First(&sku).Error)
	require.EqualValues(t, 2_000_000_000, sku.GrantTotalQuota)
	require.EqualValues(t, 1_000_000_000, sku.GrantDailyQuota)

	var entitlement Entitlement
	require.NoError(t, db.First(&entitlement).Error)
	require.EqualValues(t, 1_000_000_000, entitlement.TotalQuota)
	require.EqualValues(t, 200_000_000, entitlement.UsedQuota)

	var marker Option
	require.NoError(t, db.First(&marker, "key = ?", billingLedgerVersionKey).Error)
	require.Equal(t, billingLedgerNanoUSDV1, marker.Value)
	require.ErrorIs(t, db.First(&Option{}, "key = ?", "QuotaPerUnit").Error, gorm.ErrRecordNotFound)
}
