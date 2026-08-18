package model

import (
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	GiftHoldStatusReserved = "reserved"
	GiftHoldStatusCaptured = "captured"
	GiftHoldStatusReleased = "released"
	GiftHoldStatusRefunded = "refunded"

	ReferralRewardPending   = "pending"
	ReferralRewardReleased  = "released"
	ReferralRewardCancelled = "cancelled"
	ReferralRewardReversed  = "reversed"

	ReferralRewardTierFirst     = "first"
	ReferralRewardTierRecurring = "recurring"

	DefaultReferralFirstRateBps     = int64(1000)
	DefaultReferralRecurringRateBps = int64(500)
	DefaultReferralMinCashCents     = int64(100)
	DefaultReferralCoolingDays      = 7
)

var (
	ErrGiftBalanceInsufficient = errors.New("gift balance insufficient")
	ErrGiftHoldStateInvalid    = errors.New("gift hold state invalid")
)

type GiftSettings struct {
	Id                      int   `json:"id"`
	CheckoutEnabled         bool  `json:"checkout_enabled"`
	ReferralEnabled         bool  `json:"referral_enabled"`
	FirstRateBps            int64 `json:"first_rate_bps" gorm:"bigint;not null"`
	RecurringRateBps        int64 `json:"recurring_rate_bps" gorm:"bigint;not null"`
	MinCashPaidCents        int64 `json:"min_cash_paid_cents" gorm:"bigint;not null"`
	RewardCapCents          int64 `json:"reward_cap_cents" gorm:"bigint;not null"`
	CoolingDays             int   `json:"cooling_days" gorm:"not null"`
	LargeGrantApprovalCents int64 `json:"large_grant_approval_cents" gorm:"bigint;not null"`
	CreatedAt               int64 `json:"created_at" gorm:"bigint"`
	UpdatedAt               int64 `json:"updated_at" gorm:"bigint"`
}

func (s *GiftSettings) BeforeCreate(_ *gorm.DB) error {
	now := common.GetTimestamp()
	if s.FirstRateBps <= 0 {
		s.FirstRateBps = DefaultReferralFirstRateBps
	}
	if s.RecurringRateBps <= 0 {
		s.RecurringRateBps = DefaultReferralRecurringRateBps
	}
	if s.MinCashPaidCents <= 0 {
		s.MinCashPaidCents = DefaultReferralMinCashCents
	}
	if s.CoolingDays <= 0 {
		s.CoolingDays = DefaultReferralCoolingDays
	}
	s.CreatedAt, s.UpdatedAt = now, now
	return nil
}

func (s *GiftSettings) BeforeUpdate(_ *gorm.DB) error {
	s.UpdatedAt = common.GetTimestamp()
	return nil
}

func GetGiftSettings() (*GiftSettings, error) {
	var settings GiftSettings
	result := DB.Order("id asc").Limit(1).Find(&settings)
	if result.Error != nil {
		return nil, result.Error
	}
	if result.RowsAffected == 0 {
		settings = GiftSettings{
			FirstRateBps:     DefaultReferralFirstRateBps,
			RecurringRateBps: DefaultReferralRecurringRateBps,
			MinCashPaidCents: DefaultReferralMinCashCents,
			CoolingDays:      DefaultReferralCoolingDays,
		}
	}
	return &settings, nil
}

func SaveGiftSettings(settings *GiftSettings) error {
	if settings == nil || settings.FirstRateBps < 0 || settings.FirstRateBps > 10000 ||
		settings.RecurringRateBps < 0 || settings.RecurringRateBps > 10000 ||
		settings.MinCashPaidCents < 0 || settings.RewardCapCents < 0 || settings.CoolingDays < 1 || settings.CoolingDays > 365 {
		return errors.New("invalid gift settings")
	}
	if settings.ReferralEnabled && settings.RewardCapCents <= 0 {
		return errors.New("referral reward cap must be configured before enabling rewards")
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		var existing GiftSettings
		result := lockForUpdate(tx).Order("id asc").Limit(1).Find(&existing)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			settings.Id = 0
			return tx.Create(settings).Error
		}
		return tx.Model(&existing).Updates(map[string]interface{}{
			"checkout_enabled":           settings.CheckoutEnabled,
			"referral_enabled":           settings.ReferralEnabled,
			"first_rate_bps":             settings.FirstRateBps,
			"recurring_rate_bps":         settings.RecurringRateBps,
			"min_cash_paid_cents":        settings.MinCashPaidCents,
			"reward_cap_cents":           settings.RewardCapCents,
			"cooling_days":               settings.CoolingDays,
			"large_grant_approval_cents": settings.LargeGrantApprovalCents,
			"updated_at":                 common.GetTimestamp(),
		}).Error
	})
}

type GiftAccount struct {
	UserId         int   `json:"user_id" gorm:"primaryKey;autoIncrement:false"`
	AvailableCents int64 `json:"available_cents" gorm:"bigint;not null"`
	ReservedCents  int64 `json:"reserved_cents" gorm:"bigint;not null"`
	DebtCents      int64 `json:"debt_cents" gorm:"bigint;not null"`
	Version        int64 `json:"version" gorm:"bigint;not null"`
	CreatedAt      int64 `json:"created_at" gorm:"bigint"`
	UpdatedAt      int64 `json:"updated_at" gorm:"bigint"`
}

func (a *GiftAccount) BeforeCreate(_ *gorm.DB) error {
	now := common.GetTimestamp()
	if a.Version <= 0 {
		a.Version = 1
	}
	a.CreatedAt, a.UpdatedAt = now, now
	return nil
}

type GiftLedgerEntry struct {
	Id                   int    `json:"id"`
	UserId               int    `json:"user_id" gorm:"index;not null"`
	BusinessType         string `json:"business_type" gorm:"type:varchar(64);index;not null"`
	BusinessId           string `json:"business_id" gorm:"type:varchar(128);index"`
	IdempotencyKey       string `json:"idempotency_key" gorm:"type:varchar(191);uniqueIndex;not null"`
	AvailableDeltaCents  int64  `json:"available_delta_cents" gorm:"bigint;not null"`
	ReservedDeltaCents   int64  `json:"reserved_delta_cents" gorm:"bigint;not null"`
	DebtDeltaCents       int64  `json:"debt_delta_cents" gorm:"bigint;not null"`
	AvailableBeforeCents int64  `json:"available_before_cents" gorm:"bigint;not null"`
	AvailableAfterCents  int64  `json:"available_after_cents" gorm:"bigint;not null"`
	ReservedBeforeCents  int64  `json:"reserved_before_cents" gorm:"bigint;not null"`
	ReservedAfterCents   int64  `json:"reserved_after_cents" gorm:"bigint;not null"`
	DebtBeforeCents      int64  `json:"debt_before_cents" gorm:"bigint;not null"`
	DebtAfterCents       int64  `json:"debt_after_cents" gorm:"bigint;not null"`
	OperatorType         string `json:"operator_type" gorm:"type:varchar(32);not null"`
	OperatorId           int    `json:"operator_id" gorm:"index"`
	Reason               string `json:"reason" gorm:"type:varchar(255)"`
	MetadataJSON         string `json:"metadata_json" gorm:"type:text"`
	CreatedAt            int64  `json:"created_at" gorm:"bigint;index"`
}

func (e *GiftLedgerEntry) BeforeCreate(_ *gorm.DB) error {
	e.BusinessType = strings.TrimSpace(e.BusinessType)
	e.BusinessId = strings.TrimSpace(e.BusinessId)
	e.IdempotencyKey = strings.TrimSpace(e.IdempotencyKey)
	e.Reason = strings.TrimSpace(e.Reason)
	e.CreatedAt = common.GetTimestamp()
	return nil
}

type GiftHold struct {
	Id          int    `json:"id"`
	UserId      int    `json:"user_id" gorm:"index;not null"`
	OrderId     int    `json:"order_id" gorm:"uniqueIndex;not null"`
	AmountCents int64  `json:"amount_cents" gorm:"bigint;not null"`
	Status      string `json:"status" gorm:"type:varchar(32);index;not null"`
	ExpiresAt   int64  `json:"expires_at" gorm:"bigint;index"`
	CapturedAt  int64  `json:"captured_at" gorm:"bigint"`
	ReleasedAt  int64  `json:"released_at" gorm:"bigint"`
	RefundedAt  int64  `json:"refunded_at" gorm:"bigint"`
	CreatedAt   int64  `json:"created_at" gorm:"bigint"`
	UpdatedAt   int64  `json:"updated_at" gorm:"bigint"`
}

func (h *GiftHold) BeforeCreate(_ *gorm.DB) error {
	now := common.GetTimestamp()
	if h.Status == "" {
		h.Status = GiftHoldStatusReserved
	}
	h.CreatedAt, h.UpdatedAt = now, now
	return nil
}

type ReferralProfile struct {
	InviteeUserId           int    `json:"invitee_user_id" gorm:"primaryKey;autoIncrement:false"`
	InviterUserId           int    `json:"inviter_user_id" gorm:"index;not null"`
	FirstQualifiedOrderId   int    `json:"first_qualified_order_id" gorm:"index"`
	FirstQualifiedPaidAt    int64  `json:"first_qualified_paid_at" gorm:"bigint"`
	QualifiedPaidOrderCount int64  `json:"qualified_paid_order_count" gorm:"bigint;not null"`
	Status                  string `json:"status" gorm:"type:varchar(32);index;not null"`
	CreatedAt               int64  `json:"created_at" gorm:"bigint"`
	UpdatedAt               int64  `json:"updated_at" gorm:"bigint"`
}

func (p *ReferralProfile) BeforeCreate(_ *gorm.DB) error {
	now := common.GetTimestamp()
	if p.Status == "" {
		p.Status = "active"
	}
	p.CreatedAt, p.UpdatedAt = now, now
	return nil
}

type ReferralRewardEvent struct {
	Id                     int    `json:"id"`
	InviterUserId          int    `json:"inviter_user_id" gorm:"index;not null"`
	InviteeUserId          int    `json:"invitee_user_id" gorm:"index;not null"`
	SourceOrderId          int    `json:"source_order_id" gorm:"uniqueIndex;not null"`
	SourceOrderNo          string `json:"source_order_no" gorm:"type:varchar(64);uniqueIndex;not null"`
	SourceCategory         string `json:"source_category" gorm:"type:varchar(32);index;not null"`
	RewardTier             string `json:"reward_tier" gorm:"type:varchar(32);index;not null"`
	OriginalAmountCents    int64  `json:"original_amount_cents" gorm:"bigint;not null"`
	PromotionDiscountCents int64  `json:"promotion_discount_cents" gorm:"bigint;not null"`
	GiftDiscountCents      int64  `json:"gift_discount_cents" gorm:"bigint;not null"`
	CashPaidCents          int64  `json:"cash_paid_cents" gorm:"bigint;not null"`
	RewardRateBps          int64  `json:"reward_rate_bps" gorm:"bigint;not null"`
	RewardCents            int64  `json:"reward_cents" gorm:"bigint;not null"`
	Status                 string `json:"status" gorm:"type:varchar(32);index;not null"`
	ReleaseAt              int64  `json:"release_at" gorm:"bigint;index"`
	ReleasedAt             int64  `json:"released_at" gorm:"bigint"`
	ReversedAt             int64  `json:"reversed_at" gorm:"bigint"`
	ReversalReason         string `json:"reversal_reason" gorm:"type:varchar(255)"`
	CreatedAt              int64  `json:"created_at" gorm:"bigint"`
	UpdatedAt              int64  `json:"updated_at" gorm:"bigint"`
}

func (e *ReferralRewardEvent) BeforeCreate(_ *gorm.DB) error {
	now := common.GetTimestamp()
	if e.Status == "" {
		e.Status = ReferralRewardPending
	}
	e.CreatedAt, e.UpdatedAt = now, now
	return nil
}

type LegacyQuotaFreezeSnapshot struct {
	Id               int    `json:"id"`
	UserId           int    `json:"user_id" gorm:"uniqueIndex;not null"`
	QuotaNanoUSD     int64  `json:"quota_nano_usd" gorm:"bigint;not null"`
	UsedQuotaNanoUSD int64  `json:"used_quota_nano_usd" gorm:"bigint;not null"`
	FreezeBatchNo    string `json:"freeze_batch_no" gorm:"type:varchar(64);index;not null"`
	FrozenAt         int64  `json:"frozen_at" gorm:"bigint;index"`
	CreatedAt        int64  `json:"created_at" gorm:"bigint"`
}

func getOrCreateGiftAccountTx(tx *gorm.DB, userId int) (*GiftAccount, error) {
	if userId <= 0 {
		return nil, errors.New("invalid gift account user")
	}
	var account GiftAccount
	result := lockForUpdate(tx).Where("user_id = ?", userId).Limit(1).Find(&account)
	if result.Error != nil {
		return nil, result.Error
	}
	if result.RowsAffected == 0 {
		account = GiftAccount{UserId: userId}
		if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&account).Error; err != nil {
			return nil, err
		}
		if err := lockForUpdate(tx).Where("user_id = ?", userId).First(&account).Error; err != nil {
			return nil, err
		}
	}
	return &account, nil
}

func applyGiftDeltaTx(tx *gorm.DB, userId int, availableDelta int64, reservedDelta int64, debtDelta int64, entry GiftLedgerEntry) error {
	if strings.TrimSpace(entry.IdempotencyKey) == "" {
		return errors.New("gift ledger idempotency key is required")
	}
	var existingCount int64
	if err := tx.Model(&GiftLedgerEntry{}).Where("idempotency_key = ?", entry.IdempotencyKey).Count(&existingCount).Error; err != nil {
		return err
	}
	if existingCount > 0 {
		return nil
	}
	account, err := getOrCreateGiftAccountTx(tx, userId)
	if err != nil {
		return err
	}
	availableAfter := account.AvailableCents + availableDelta
	reservedAfter := account.ReservedCents + reservedDelta
	debtAfter := account.DebtCents + debtDelta
	if availableAfter < 0 || reservedAfter < 0 || debtAfter < 0 {
		return ErrGiftBalanceInsufficient
	}
	entry.UserId = userId
	entry.AvailableDeltaCents = availableDelta
	entry.ReservedDeltaCents = reservedDelta
	entry.DebtDeltaCents = debtDelta
	entry.AvailableBeforeCents = account.AvailableCents
	entry.AvailableAfterCents = availableAfter
	entry.ReservedBeforeCents = account.ReservedCents
	entry.ReservedAfterCents = reservedAfter
	entry.DebtBeforeCents = account.DebtCents
	entry.DebtAfterCents = debtAfter
	if entry.OperatorType == "" {
		entry.OperatorType = "system"
	}
	result := tx.Model(account).Where("version = ?", account.Version).Updates(map[string]interface{}{
		"available_cents": availableAfter,
		"reserved_cents":  reservedAfter,
		"debt_cents":      debtAfter,
		"version":         account.Version + 1,
		"updated_at":      common.GetTimestamp(),
	})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected != 1 {
		return errors.New("gift account changed concurrently")
	}
	return tx.Create(&entry).Error
}

func creditGiftTx(tx *gorm.DB, userId int, amount int64, entry GiftLedgerEntry) error {
	if amount <= 0 {
		return errors.New("gift credit must be positive")
	}
	account, err := getOrCreateGiftAccountTx(tx, userId)
	if err != nil {
		return err
	}
	repaid := amount
	if repaid > account.DebtCents {
		repaid = account.DebtCents
	}
	return applyGiftDeltaTx(tx, userId, amount-repaid, 0, -repaid, entry)
}

func GetGiftAccount(userId int) (*GiftAccount, error) {
	var account GiftAccount
	result := DB.Where("user_id = ?", userId).Limit(1).Find(&account)
	if result.Error != nil {
		return nil, result.Error
	}
	if result.RowsAffected == 0 {
		return &GiftAccount{UserId: userId}, nil
	}
	return &account, nil
}

func AdminAdjustGift(userId int, operatorId int, deltaCents int64, reason string, idempotencyKey string) error {
	if userId <= 0 || operatorId <= 0 || deltaCents == 0 || strings.TrimSpace(reason) == "" || strings.TrimSpace(idempotencyKey) == "" {
		return errors.New("invalid gift adjustment")
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		entry := GiftLedgerEntry{
			BusinessType:   "admin_grant",
			BusinessId:     fmt.Sprintf("user:%d", userId),
			IdempotencyKey: "admin_gift:" + strings.TrimSpace(idempotencyKey),
			OperatorType:   "admin",
			OperatorId:     operatorId,
			Reason:         reason,
		}
		if deltaCents > 0 {
			return creditGiftTx(tx, userId, deltaCents, entry)
		}
		entry.BusinessType = "admin_deduct"
		return applyGiftDeltaTx(tx, userId, deltaCents, 0, 0, entry)
	})
}

func reserveGiftTx(tx *gorm.DB, userId int, orderId int, amount int64, expiresAt int64) error {
	if amount <= 0 {
		return nil
	}
	hold := GiftHold{UserId: userId, OrderId: orderId, AmountCents: amount, Status: GiftHoldStatusReserved, ExpiresAt: expiresAt}
	if err := tx.Create(&hold).Error; err != nil {
		return err
	}
	return applyGiftDeltaTx(tx, userId, -amount, amount, 0, GiftLedgerEntry{
		BusinessType:   "checkout_reserve",
		BusinessId:     fmt.Sprintf("order:%d", orderId),
		IdempotencyKey: fmt.Sprintf("checkout_reserve:%d", orderId),
		OperatorType:   "user",
		OperatorId:     userId,
		Reason:         "商城订单礼金预占",
	})
}

func captureGiftTx(tx *gorm.DB, order *ProductOrder) error {
	if order == nil || order.GiftDiscountCents <= 0 {
		return nil
	}
	var hold GiftHold
	if err := lockForUpdate(tx).Where("order_id = ?", order.Id).First(&hold).Error; err != nil {
		return err
	}
	if hold.Status == GiftHoldStatusCaptured {
		return nil
	}
	if hold.Status != GiftHoldStatusReserved {
		return ErrGiftHoldStateInvalid
	}
	if err := applyGiftDeltaTx(tx, order.UserId, 0, -hold.AmountCents, 0, GiftLedgerEntry{
		BusinessType:   "checkout_capture",
		BusinessId:     fmt.Sprintf("order:%d", order.Id),
		IdempotencyKey: fmt.Sprintf("checkout_capture:%d", order.Id),
		OperatorType:   "system",
		Reason:         "商城订单礼金结算",
	}); err != nil {
		return err
	}
	now := getDBTimestampTx(tx)
	return tx.Model(&hold).Updates(map[string]interface{}{"status": GiftHoldStatusCaptured, "captured_at": now, "updated_at": now}).Error
}

func releaseGiftTx(tx *gorm.DB, order *ProductOrder, reason string) error {
	if order == nil || order.GiftDiscountCents <= 0 {
		return nil
	}
	var hold GiftHold
	result := lockForUpdate(tx).Where("order_id = ?", order.Id).Limit(1).Find(&hold)
	if result.Error != nil || result.RowsAffected == 0 {
		return result.Error
	}
	if hold.Status == GiftHoldStatusReleased {
		return nil
	}
	if hold.Status != GiftHoldStatusReserved {
		return ErrGiftHoldStateInvalid
	}
	if err := applyGiftDeltaTx(tx, order.UserId, hold.AmountCents, -hold.AmountCents, 0, GiftLedgerEntry{
		BusinessType:   "checkout_release",
		BusinessId:     fmt.Sprintf("order:%d", order.Id),
		IdempotencyKey: fmt.Sprintf("checkout_release:%d", order.Id),
		OperatorType:   "system",
		Reason:         reason,
	}); err != nil {
		return err
	}
	now := getDBTimestampTx(tx)
	return tx.Model(&hold).Updates(map[string]interface{}{"status": GiftHoldStatusReleased, "released_at": now, "updated_at": now}).Error
}

func refundGiftTx(tx *gorm.DB, order *ProductOrder, reason string) error {
	if order == nil || order.GiftDiscountCents <= 0 {
		return nil
	}
	var hold GiftHold
	if err := lockForUpdate(tx).Where("order_id = ?", order.Id).First(&hold).Error; err != nil {
		return err
	}
	if hold.Status == GiftHoldStatusRefunded {
		return nil
	}
	if hold.Status != GiftHoldStatusCaptured {
		return ErrGiftHoldStateInvalid
	}
	if err := creditGiftTx(tx, order.UserId, hold.AmountCents, GiftLedgerEntry{
		BusinessType:   "order_refund",
		BusinessId:     fmt.Sprintf("order:%d", order.Id),
		IdempotencyKey: fmt.Sprintf("order_refund:%d", order.Id),
		OperatorType:   "system",
		Reason:         reason,
	}); err != nil {
		return err
	}
	now := getDBTimestampTx(tx)
	return tx.Model(&hold).Updates(map[string]interface{}{"status": GiftHoldStatusRefunded, "refunded_at": now, "updated_at": now}).Error
}

func createReferralRewardTx(tx *gorm.DB, order *ProductOrder, now int64) error {
	if order == nil || order.CashPaidCents <= 0 {
		return nil
	}
	switch strings.ToLower(strings.TrimSpace(order.PaymentMethod)) {
	case "manual", "gift", "free":
		return nil
	}
	if !tx.Migrator().HasTable(&GiftSettings{}) || !tx.Migrator().HasTable(&ReferralRewardEvent{}) {
		return nil
	}
	var settings GiftSettings
	result := tx.Order("id asc").Limit(1).Find(&settings)
	if result.Error != nil || result.RowsAffected == 0 || !settings.ReferralEnabled {
		return result.Error
	}
	if settings.RewardCapCents <= 0 || order.CashPaidCents < settings.MinCashPaidCents {
		return nil
	}
	var invitee User
	result = lockForUpdate(tx).Select("id", "inviter_id").Where("id = ?", order.UserId).Limit(1).Find(&invitee)
	if result.Error != nil || result.RowsAffected == 0 || invitee.InviterId <= 0 || invitee.InviterId == invitee.Id {
		return result.Error
	}
	var existing ReferralRewardEvent
	result = tx.Where("source_order_id = ?", order.Id).Limit(1).Find(&existing)
	if result.Error != nil || result.RowsAffected > 0 {
		return result.Error
	}
	var eventCount int64
	if err := tx.Model(&ReferralRewardEvent{}).Where("invitee_user_id = ?", invitee.Id).Count(&eventCount).Error; err != nil {
		return err
	}
	tier := ReferralRewardTierRecurring
	rate := settings.RecurringRateBps
	if eventCount == 0 {
		tier = ReferralRewardTierFirst
		rate = settings.FirstRateBps
	}
	reward := decimal.NewFromInt(order.CashPaidCents).Mul(decimal.NewFromInt(rate)).Div(decimal.NewFromInt(10000)).IntPart()
	if reward > settings.RewardCapCents {
		reward = settings.RewardCapCents
	}
	if reward <= 0 {
		return nil
	}
	category := ""
	if len(order.Items) > 0 {
		var product Product
		if err := tx.Select("category").Where("id = ?", order.Items[0].ProductId).First(&product).Error; err != nil {
			return err
		}
		category = product.Category
	}
	event := ReferralRewardEvent{
		InviterUserId:          invitee.InviterId,
		InviteeUserId:          invitee.Id,
		SourceOrderId:          order.Id,
		SourceOrderNo:          order.OrderNo,
		SourceCategory:         category,
		RewardTier:             tier,
		OriginalAmountCents:    order.OriginalAmountCents,
		PromotionDiscountCents: order.PromotionDiscountCents,
		GiftDiscountCents:      order.GiftDiscountCents,
		CashPaidCents:          order.CashPaidCents,
		RewardRateBps:          rate,
		RewardCents:            reward,
		Status:                 ReferralRewardPending,
		ReleaseAt:              now + int64(settings.CoolingDays)*86400,
	}
	if err := tx.Create(&event).Error; err != nil {
		return err
	}
	var profile ReferralProfile
	profileResult := lockForUpdate(tx).Where("invitee_user_id = ?", invitee.Id).Limit(1).Find(&profile)
	if profileResult.Error != nil {
		return profileResult.Error
	}
	if profileResult.RowsAffected == 0 {
		profile = ReferralProfile{InviteeUserId: invitee.Id, InviterUserId: invitee.InviterId, Status: "active"}
		if err := tx.Create(&profile).Error; err != nil {
			return err
		}
	}
	updates := map[string]interface{}{
		"qualified_paid_order_count": profile.QualifiedPaidOrderCount + 1,
		"updated_at":                 common.GetTimestamp(),
	}
	if profile.FirstQualifiedOrderId == 0 {
		updates["first_qualified_order_id"] = order.Id
		updates["first_qualified_paid_at"] = now
	}
	return tx.Model(&profile).Updates(updates).Error
}

func reverseReferralRewardTx(tx *gorm.DB, order *ProductOrder, reason string) error {
	if order == nil {
		return nil
	}
	if !tx.Migrator().HasTable(&ReferralRewardEvent{}) {
		return nil
	}
	var event ReferralRewardEvent
	result := lockForUpdate(tx).Where("source_order_id = ?", order.Id).Limit(1).Find(&event)
	if result.Error != nil || result.RowsAffected == 0 {
		return result.Error
	}
	now := getDBTimestampTx(tx)
	if event.Status == ReferralRewardPending {
		return tx.Model(&event).Updates(map[string]interface{}{
			"status": ReferralRewardCancelled, "reversal_reason": reason, "reversed_at": now, "updated_at": now,
		}).Error
	}
	if event.Status != ReferralRewardReleased {
		return nil
	}
	account, err := getOrCreateGiftAccountTx(tx, event.InviterUserId)
	if err != nil {
		return err
	}
	deduct := event.RewardCents
	if deduct > account.AvailableCents {
		deduct = account.AvailableCents
	}
	shortfall := event.RewardCents - deduct
	if err := applyGiftDeltaTx(tx, event.InviterUserId, -deduct, 0, shortfall, GiftLedgerEntry{
		BusinessType:   "referral_reverse",
		BusinessId:     fmt.Sprintf("order:%d", order.Id),
		IdempotencyKey: fmt.Sprintf("referral_reverse:%d", order.Id),
		OperatorType:   "system",
		Reason:         reason,
	}); err != nil {
		return err
	}
	return tx.Model(&event).Updates(map[string]interface{}{
		"status": ReferralRewardReversed, "reversal_reason": reason, "reversed_at": now, "updated_at": now,
	}).Error
}

func ReleaseDueReferralRewards(limit int) (int, error) {
	if limit <= 0 {
		return 0, nil
	}
	var ids []int
	now := GetDBTimestamp()
	if err := DB.Model(&ReferralRewardEvent{}).
		Where("status = ? AND release_at > 0 AND release_at <= ?", ReferralRewardPending, now).
		Order("id asc").Limit(limit).Pluck("id", &ids).Error; err != nil {
		return 0, err
	}
	released := 0
	for _, id := range ids {
		err := DB.Transaction(func(tx *gorm.DB) error {
			var event ReferralRewardEvent
			if err := lockForUpdate(tx).Where("id = ?", id).First(&event).Error; err != nil {
				return err
			}
			if event.Status != ReferralRewardPending || event.ReleaseAt > getDBTimestampTx(tx) {
				return nil
			}
			var order ProductOrder
			if err := tx.Select("id", "status").Where("id = ?", event.SourceOrderId).First(&order).Error; err != nil {
				return err
			}
			if order.Status != ProductOrderStatusFulfilled {
				return tx.Model(&event).Updates(map[string]interface{}{
					"status": ReferralRewardCancelled, "reversal_reason": "source order is not fulfilled", "reversed_at": now, "updated_at": now,
				}).Error
			}
			if err := creditGiftTx(tx, event.InviterUserId, event.RewardCents, GiftLedgerEntry{
				BusinessType:   "referral_release",
				BusinessId:     fmt.Sprintf("order:%d", event.SourceOrderId),
				IdempotencyKey: fmt.Sprintf("referral_release:%d", event.SourceOrderId),
				OperatorType:   "system",
				Reason:         "好友订单返现到账",
			}); err != nil {
				return err
			}
			if err := tx.Model(&event).Updates(map[string]interface{}{
				"status": ReferralRewardReleased, "released_at": now, "updated_at": now,
			}).Error; err != nil {
				return err
			}
			released++
			return nil
		})
		if err != nil {
			return released, err
		}
	}
	return released, nil
}

func ListGiftLedger(userId int, limit int) ([]GiftLedgerEntry, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	var entries []GiftLedgerEntry
	err := DB.Where("user_id = ?", userId).Order("id desc").Limit(limit).Find(&entries).Error
	return entries, err
}

func ListReferralRewardsForInviter(userId int, limit int) ([]ReferralRewardEvent, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	var events []ReferralRewardEvent
	err := DB.Where("inviter_user_id = ?", userId).Order("id desc").Limit(limit).Find(&events).Error
	return events, err
}

type GiftAuditReport struct {
	NegativeAccountCount       int64 `json:"negative_account_count"`
	AccountLedgerMismatchCount int64 `json:"account_ledger_mismatch_count"`
	StaleReservedHoldCount     int64 `json:"stale_reserved_hold_count"`
	OrderAmountMismatchCount   int64 `json:"order_amount_mismatch_count"`
	RewardMismatchCount        int64 `json:"reward_mismatch_count"`
	FrozenQuotaMismatchCount   int64 `json:"frozen_quota_mismatch_count"`
	CheckedAt                  int64 `json:"checked_at"`
}

func AuditGiftAccounting() (*GiftAuditReport, error) {
	report := &GiftAuditReport{CheckedAt: GetDBTimestamp()}
	if err := DB.Model(&GiftAccount{}).
		Where("available_cents < 0 OR reserved_cents < 0 OR debt_cents < 0").
		Count(&report.NegativeAccountCount).Error; err != nil {
		return nil, err
	}
	if err := DB.Model(&GiftHold{}).
		Joins("JOIN product_orders ON product_orders.id = gift_holds.order_id").
		Where("gift_holds.status = ? AND product_orders.status <> ?", GiftHoldStatusReserved, ProductOrderStatusPending).
		Count(&report.StaleReservedHoldCount).Error; err != nil {
		return nil, err
	}
	if err := DB.Model(&ProductOrder{}).
		Where("original_amount_cents > 0 AND original_amount_cents <> promotion_discount_cents + gift_discount_cents + cash_payable_cents").
		Count(&report.OrderAmountMismatchCount).Error; err != nil {
		return nil, err
	}
	type ledgerTotal struct {
		UserId    int
		Available int64
		Reserved  int64
		Debt      int64
	}
	var totals []ledgerTotal
	if err := DB.Model(&GiftLedgerEntry{}).Select(
		"user_id, COALESCE(SUM(available_delta_cents), 0) AS available, COALESCE(SUM(reserved_delta_cents), 0) AS reserved, COALESCE(SUM(debt_delta_cents), 0) AS debt",
	).Group("user_id").Scan(&totals).Error; err != nil {
		return nil, err
	}
	for _, total := range totals {
		var account GiftAccount
		if err := DB.Where("user_id = ?", total.UserId).First(&account).Error; err != nil {
			return nil, err
		}
		if account.AvailableCents != total.Available || account.ReservedCents != total.Reserved || account.DebtCents != total.Debt {
			report.AccountLedgerMismatchCount++
		}
	}
	var rewards []ReferralRewardEvent
	if err := DB.Find(&rewards).Error; err != nil {
		return nil, err
	}
	for _, reward := range rewards {
		expected := decimal.NewFromInt(reward.CashPaidCents).
			Mul(decimal.NewFromInt(reward.RewardRateBps)).
			Div(decimal.NewFromInt(10000)).IntPart()
		if reward.RewardCents <= 0 || reward.RewardCents > expected {
			report.RewardMismatchCount++
		}
	}
	if DB.Migrator().HasTable(&LegacyQuotaFreezeSnapshot{}) {
		if err := DB.Model(&LegacyQuotaFreezeSnapshot{}).
			Joins("JOIN users ON users.id = legacy_quota_freeze_snapshots.user_id").
			Where("users.quota <> legacy_quota_freeze_snapshots.quota_nano_usd").
			Count(&report.FrozenQuotaMismatchCount).Error; err != nil {
			return nil, err
		}
	}
	return report, nil
}

func FreezeLegacyQuota(batchNo string) (int, error) {
	batchNo = strings.TrimSpace(batchNo)
	if batchNo == "" {
		return 0, errors.New("freeze batch number is required")
	}
	created := 0
	err := DB.Transaction(func(tx *gorm.DB) error {
		var users []User
		if err := tx.Select("id", "quota", "used_quota").Order("id asc").Find(&users).Error; err != nil {
			return err
		}
		now := getDBTimestampTx(tx)
		for _, user := range users {
			var count int64
			if err := tx.Model(&LegacyQuotaFreezeSnapshot{}).Where("user_id = ?", user.Id).Count(&count).Error; err != nil {
				return err
			}
			if count > 0 {
				continue
			}
			snapshot := LegacyQuotaFreezeSnapshot{
				UserId: user.Id, QuotaNanoUSD: int64(user.Quota), UsedQuotaNanoUSD: int64(user.UsedQuota),
				FreezeBatchNo: batchNo, FrozenAt: now, CreatedAt: now,
			}
			if err := tx.Create(&snapshot).Error; err != nil {
				return err
			}
			created++
		}
		return nil
	})
	return created, err
}
