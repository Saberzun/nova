package model

import (
	"fmt"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func resetGiftFixtures(t *testing.T) {
	t.Helper()
	require.NoError(t, DB.AutoMigrate(
		&GiftSettings{}, &GiftAccount{}, &GiftLedgerEntry{}, &GiftHold{},
		&ReferralProfile{}, &ReferralRewardEvent{}, &LegacyQuotaFreezeSnapshot{},
	))
	tables := []interface{}{
		&ReferralRewardEvent{}, &ReferralProfile{}, &GiftHold{}, &GiftLedgerEntry{},
		&GiftAccount{}, &GiftSettings{}, &LegacyQuotaFreezeSnapshot{},
	}
	for _, table := range tables {
		require.NoError(t, DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Unscoped().Delete(table).Error)
	}
	t.Cleanup(func() {
		for _, table := range tables {
			_ = DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Unscoped().Delete(table).Error
		}
		_ = DB.Where("username LIKE ?", "gift-test-%").Unscoped().Delete(&User{}).Error
	})
}

func TestGiftReserveCaptureRefundIsAuditableAndIdempotent(t *testing.T) {
	resetGiftFixtures(t)
	userId := 78001
	require.NoError(t, AdminAdjustGift(userId, 1, 10000, "test grant", "gift-reserve-grant"))

	order := ProductOrder{
		Id: 88001, OrderNo: "gift-order-reserve", UserId: userId,
		GiftDiscountCents: 3000, OriginalAmountCents: 10000, CashPayableCents: 7000,
	}
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		return reserveGiftTx(tx, userId, order.Id, order.GiftDiscountCents, time.Now().Unix()+1800)
	}))
	account, err := GetGiftAccount(userId)
	require.NoError(t, err)
	assert.EqualValues(t, 7000, account.AvailableCents)
	assert.EqualValues(t, 3000, account.ReservedCents)

	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error { return captureGiftTx(tx, &order) }))
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error { return captureGiftTx(tx, &order) }))
	account, err = GetGiftAccount(userId)
	require.NoError(t, err)
	assert.EqualValues(t, 7000, account.AvailableCents)
	assert.Zero(t, account.ReservedCents)

	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error { return refundGiftTx(tx, &order, "test refund") }))
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error { return refundGiftTx(tx, &order, "test refund") }))
	account, err = GetGiftAccount(userId)
	require.NoError(t, err)
	assert.EqualValues(t, 10000, account.AvailableCents)

	entries, err := ListGiftLedger(userId, 20)
	require.NoError(t, err)
	assert.Len(t, entries, 4)
}

func TestReferralFirstAndRecurringRewardsUseCashPaid(t *testing.T) {
	resetGiftFixtures(t)
	suffix := time.Now().UnixNano()
	inviter := User{Username: fmt.Sprintf("gift-test-inviter-%d", suffix), Password: "password123", Role: common.RoleCommonUser, Status: common.UserStatusEnabled}
	inviter.AffCode = fmt.Sprintf("gi%d", suffix)
	require.NoError(t, DB.Create(&inviter).Error)
	invitee := User{Username: fmt.Sprintf("gift-test-invitee-%d", suffix), Password: "password123", Role: common.RoleCommonUser, Status: common.UserStatusEnabled, InviterId: inviter.Id}
	invitee.AffCode = fmt.Sprintf("ge%d", suffix)
	require.NoError(t, DB.Create(&invitee).Error)
	require.NoError(t, DB.Create(&GiftSettings{
		CheckoutEnabled: true, ReferralEnabled: true,
		FirstRateBps: 1000, RecurringRateBps: 500, MinCashPaidCents: 100,
		RewardCapCents: 10000, CoolingDays: 7,
	}).Error)
	product := Product{Code: fmt.Sprintf("gift-test-product-%d", suffix), Name: "Gift Test", Category: ProductCategorySubscription, Status: ProductStatusActive}
	require.NoError(t, DB.Create(&product).Error)

	first := ProductOrder{
		OrderNo: fmt.Sprintf("gift-first-%d", suffix), UserId: invitee.Id,
		OriginalAmountCents: 10000, GiftDiscountCents: 3000, CashPaidCents: 7000,
		Items: []ProductOrderItem{{ProductId: product.Id}},
	}
	second := ProductOrder{
		OrderNo: fmt.Sprintf("gift-second-%d", suffix), UserId: invitee.Id,
		OriginalAmountCents: 10000, CashPaidCents: 10000,
		Items: []ProductOrderItem{{ProductId: product.Id}},
	}
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		first.Id = int(suffix%100000000) + 900000
		return createReferralRewardTx(tx, &first, time.Now().Unix())
	}))
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		second.Id = first.Id + 1
		return createReferralRewardTx(tx, &second, time.Now().Unix())
	}))

	var events []ReferralRewardEvent
	require.NoError(t, DB.Where("invitee_user_id = ?", invitee.Id).Order("id asc").Find(&events).Error)
	require.Len(t, events, 2)
	assert.Equal(t, ReferralRewardTierFirst, events[0].RewardTier)
	assert.EqualValues(t, 700, events[0].RewardCents)
	assert.Equal(t, ReferralRewardTierRecurring, events[1].RewardTier)
	assert.EqualValues(t, 500, events[1].RewardCents)
}

func TestFullGiftOrderDoesNotConsumeFirstReferralReward(t *testing.T) {
	resetGiftFixtures(t)
	suffix := time.Now().UnixNano()
	inviter := User{Username: fmt.Sprintf("gift-test-inviter-%d", suffix), Password: "password123", Role: common.RoleCommonUser, Status: common.UserStatusEnabled, AffCode: fmt.Sprintf("fg-i-%d", suffix)}
	require.NoError(t, DB.Create(&inviter).Error)
	invitee := User{Username: fmt.Sprintf("gift-test-invitee-%d", suffix), Password: "password123", Role: common.RoleCommonUser, Status: common.UserStatusEnabled, InviterId: inviter.Id, AffCode: fmt.Sprintf("fg-e-%d", suffix)}
	require.NoError(t, DB.Create(&invitee).Error)
	require.NoError(t, DB.Create(&GiftSettings{
		CheckoutEnabled: true, ReferralEnabled: true, FirstRateBps: 1000,
		RecurringRateBps: 500, MinCashPaidCents: 100, RewardCapCents: 10000, CoolingDays: 7,
	}).Error)

	fullGiftOrder := ProductOrder{Id: int(suffix%100000000) + 1000000, OrderNo: fmt.Sprintf("full-gift-%d", suffix), UserId: invitee.Id, GiftDiscountCents: 10000, PaymentMethod: "gift"}
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		return createReferralRewardTx(tx, &fullGiftOrder, time.Now().Unix())
	}))

	cashOrder := ProductOrder{Id: fullGiftOrder.Id + 1, OrderNo: fmt.Sprintf("cash-after-gift-%d", suffix), UserId: invitee.Id, OriginalAmountCents: 10000, CashPaidCents: 10000}
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		return createReferralRewardTx(tx, &cashOrder, time.Now().Unix())
	}))
	var event ReferralRewardEvent
	require.NoError(t, DB.Where("invitee_user_id = ?", invitee.Id).First(&event).Error)
	assert.Equal(t, ReferralRewardTierFirst, event.RewardTier)
	assert.EqualValues(t, 1000, event.RewardCents)
}

func TestReferralRefundCancelsPendingReward(t *testing.T) {
	resetGiftFixtures(t)
	order := ProductOrder{Id: 89001, OrderNo: "gift-pending-refund", UserId: 78002}
	event := ReferralRewardEvent{
		InviterUserId: 78001, InviteeUserId: order.UserId, SourceOrderId: order.Id,
		SourceOrderNo: order.OrderNo, RewardTier: ReferralRewardTierFirst,
		CashPaidCents: 10000, RewardRateBps: 1000, RewardCents: 1000,
		Status: ReferralRewardPending, ReleaseAt: time.Now().Unix() + 86400,
	}
	require.NoError(t, DB.Create(&event).Error)
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		return reverseReferralRewardTx(tx, &order, "refund")
	}))
	require.NoError(t, DB.First(&event, event.Id).Error)
	assert.Equal(t, ReferralRewardCancelled, event.Status)
	account, err := GetGiftAccount(event.InviterUserId)
	require.NoError(t, err)
	assert.Zero(t, account.AvailableCents)
	assert.Zero(t, account.DebtCents)
}

func TestReleasedReferralRefundCreatesDebtWhenGiftWasSpent(t *testing.T) {
	resetGiftFixtures(t)
	inviterId := 78003
	order := ProductOrder{Id: 89002, OrderNo: "gift-released-refund", UserId: 78004}
	require.NoError(t, AdminAdjustGift(inviterId, 1, 1000, "released reward fixture", "released-reward-fixture"))
	require.NoError(t, AdminAdjustGift(inviterId, 1, -700, "spent gift fixture", "spent-gift-fixture"))
	event := ReferralRewardEvent{
		InviterUserId: inviterId, InviteeUserId: order.UserId, SourceOrderId: order.Id,
		SourceOrderNo: order.OrderNo, RewardTier: ReferralRewardTierFirst,
		CashPaidCents: 10000, RewardRateBps: 1000, RewardCents: 1000,
		Status: ReferralRewardReleased, ReleasedAt: time.Now().Unix(),
	}
	require.NoError(t, DB.Create(&event).Error)
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		return reverseReferralRewardTx(tx, &order, "refund")
	}))
	account, err := GetGiftAccount(inviterId)
	require.NoError(t, err)
	assert.Zero(t, account.AvailableCents)
	assert.EqualValues(t, 700, account.DebtCents)
	require.NoError(t, DB.First(&event, event.Id).Error)
	assert.Equal(t, ReferralRewardReversed, event.Status)
}

func TestGiftReserveRejectsInsufficientBalance(t *testing.T) {
	resetGiftFixtures(t)
	require.NoError(t, AdminAdjustGift(78005, 1, 100, "small fixture", "small-fixture"))
	err := DB.Transaction(func(tx *gorm.DB) error {
		return reserveGiftTx(tx, 78005, 89003, 101, time.Now().Unix()+1800)
	})
	require.ErrorIs(t, err, ErrGiftBalanceInsufficient)
	account, accountErr := GetGiftAccount(78005)
	require.NoError(t, accountErr)
	assert.EqualValues(t, 100, account.AvailableCents)
	assert.Zero(t, account.ReservedCents)
}

func TestPaymentExceptionReleasesGiftHold(t *testing.T) {
	resetGiftFixtures(t)
	userId := 78006
	require.NoError(t, AdminAdjustGift(userId, 1, 1000, "payment exception fixture", "payment-exception-fixture"))
	order := ProductOrder{OrderNo: "gift-payment-exception", UserId: userId, Status: ProductOrderStatusPending, OriginalAmountCents: 2000, GiftDiscountCents: 1000, CashPayableCents: 1000, TotalAmountMinor: 1000}
	require.NoError(t, DB.Create(&order).Error)
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		return reserveGiftTx(tx, userId, order.Id, order.GiftDiscountCents, time.Now().Unix()+1800)
	}))
	require.NoError(t, MarkProductOrderPaymentException(order.OrderNo, "amount mismatch", "{}"))
	account, err := GetGiftAccount(userId)
	require.NoError(t, err)
	assert.EqualValues(t, 1000, account.AvailableCents)
	assert.Zero(t, account.ReservedCents)
	require.NoError(t, DB.Where("order_no = ?", order.OrderNo).First(&order).Error)
	assert.Equal(t, ProductOrderStatusPaymentException, order.Status)
	assert.Equal(t, GiftHoldStatusReleased, order.GiftStatus)
}

func TestLegacyQuotaFreezeRejectsQuotaMutation(t *testing.T) {
	previous := common.LegacyQuotaFrozen
	common.LegacyQuotaFrozen = true
	t.Cleanup(func() { common.LegacyQuotaFrozen = previous })
	require.EqualError(t, IncreaseUserQuota(1, 1, true), "legacy user quota is frozen")
	require.EqualError(t, DecreaseUserQuota(1, 1, true), "legacy user quota is frozen")
}

func TestLegacyQuotaAuditAllowsUsedQuotaToKeepTrackingUsage(t *testing.T) {
	resetGiftFixtures(t)
	suffix := time.Now().UnixNano()
	user := User{
		Username: fmt.Sprintf("gift-test-quota-audit-%d", suffix), Password: "password123",
		Role: common.RoleCommonUser, Status: common.UserStatusEnabled, Quota: 1000, UsedQuota: 100,
	}
	require.NoError(t, DB.Create(&user).Error)
	created, err := FreezeLegacyQuota(fmt.Sprintf("gift-test-freeze-%d", suffix))
	require.NoError(t, err)
	require.Positive(t, created)

	require.NoError(t, DB.Model(&User{}).Where("id = ?", user.Id).Update("used_quota", 200).Error)
	report, err := AuditGiftAccounting()
	require.NoError(t, err)
	assert.Zero(t, report.FrozenQuotaMismatchCount)

	require.NoError(t, DB.Model(&User{}).Where("id = ?", user.Id).Update("quota", 999).Error)
	report, err = AuditGiftAccounting()
	require.NoError(t, err)
	assert.EqualValues(t, 1, report.FrozenQuotaMismatchCount)
}

func TestLegacyInvitationQuotaOptionsRejectNonZeroValues(t *testing.T) {
	require.Error(t, UpdateOption("QuotaForInviter", "1"))
	require.Error(t, UpdateOption("QuotaForInvitee", "1"))
	require.Error(t, UpdateOptionsBulk(map[string]string{"QuotaForInviter": "1"}))
}
