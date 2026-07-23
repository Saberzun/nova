package model

import (
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

type Entitlement struct {
	Id                 int     `json:"id"`
	UserId             int     `json:"user_id" gorm:"index;index:idx_entitlement_candidate,priority:1;not null"`
	EntitlementTypeId  int     `json:"entitlement_type_id" gorm:"index;not null"`
	AssetKind          string  `json:"asset_kind" gorm:"type:varchar(32);index;index:idx_entitlement_candidate,priority:2;not null"`
	ProductId          int     `json:"product_id" gorm:"index"`
	SKUId              int     `json:"sku_id" gorm:"index"`
	OrderItemId        int     `json:"order_item_id" gorm:"index"`
	QuantityIndex      int     `json:"quantity_index"`
	FulfillmentKey     *string `json:"fulfillment_key" gorm:"type:varchar(128);uniqueIndex"`
	State              string  `json:"state" gorm:"type:varchar(32);index;index:idx_entitlement_candidate,priority:3;not null"`
	TotalQuota         int64   `json:"total_quota" gorm:"bigint;not null"`
	UsedQuota          int64   `json:"used_quota" gorm:"bigint;not null"`
	ReservedQuota      int64   `json:"reserved_quota" gorm:"bigint;not null"`
	DailyQuota         int64   `json:"daily_quota" gorm:"bigint;not null"`
	ResetTimezone      string  `json:"reset_timezone" gorm:"type:varchar(64);not null"`
	StartAt            int64   `json:"start_at" gorm:"bigint;index"`
	ExpireAt           int64   `json:"expire_at" gorm:"bigint;index"`
	ActivationDeadline int64   `json:"activation_deadline" gorm:"bigint"`
	SortOrder          int     `json:"sort_order" gorm:"index"`
	SourceType         string  `json:"source_type" gorm:"type:varchar(32);index"`
	SourceId           int     `json:"source_id" gorm:"index"`
	FulfillmentBatchId string  `json:"fulfillment_batch_id" gorm:"type:varchar(64);index"`
	CreatedAt          int64   `json:"created_at" gorm:"bigint"`
	UpdatedAt          int64   `json:"updated_at" gorm:"bigint"`
}

func (e *Entitlement) BeforeCreate(_ *gorm.DB) error {
	now := common.GetTimestamp()
	if e.State == "" {
		e.State = EntitlementStateActive
	}
	if e.ResetTimezone == "" {
		e.ResetTimezone = "Asia/Shanghai"
	}
	e.CreatedAt, e.UpdatedAt = now, now
	return nil
}

func (e *Entitlement) BeforeUpdate(_ *gorm.DB) error { e.UpdatedAt = common.GetTimestamp(); return nil }

func (e *Entitlement) AvailableQuota() int64 {
	remaining := e.TotalQuota - e.UsedQuota - e.ReservedQuota
	if remaining < 0 {
		return 0
	}
	return remaining
}

type EntitlementDailyUsage struct {
	Id            int   `json:"id"`
	EntitlementId int   `json:"entitlement_id" gorm:"uniqueIndex:idx_entitlement_daily_period;index;not null"`
	PeriodStart   int64 `json:"period_start" gorm:"bigint;uniqueIndex:idx_entitlement_daily_period;index;not null"`
	PeriodEnd     int64 `json:"period_end" gorm:"bigint;index;not null"`
	UsedQuota     int64 `json:"used_quota" gorm:"bigint;not null"`
	ReservedQuota int64 `json:"reserved_quota" gorm:"bigint;not null"`
	CreatedAt     int64 `json:"created_at" gorm:"bigint"`
	UpdatedAt     int64 `json:"updated_at" gorm:"bigint"`
}

func (u *EntitlementDailyUsage) BeforeCreate(_ *gorm.DB) error {
	now := common.GetTimestamp()
	u.CreatedAt, u.UpdatedAt = now, now
	return nil
}

func (u *EntitlementDailyUsage) BeforeUpdate(_ *gorm.DB) error {
	u.UpdatedAt = common.GetTimestamp()
	return nil
}

func (u *EntitlementDailyUsage) AvailableQuota(limit int64) int64 {
	if limit <= 0 {
		return int64(^uint64(0) >> 1)
	}
	remaining := limit - u.UsedQuota - u.ReservedQuota
	if remaining < 0 {
		return 0
	}
	return remaining
}

type EntitlementAdjustmentLedger struct {
	Id             int    `json:"id"`
	IdempotencyKey string `json:"idempotency_key" gorm:"type:varchar(128);uniqueIndex;not null"`
	EntitlementId  int    `json:"entitlement_id" gorm:"index;not null"`
	OperatorId     int    `json:"operator_id" gorm:"index"`
	DeltaQuota     int64  `json:"delta_quota" gorm:"bigint;not null"`
	Reason         string `json:"reason" gorm:"type:varchar(255);not null"`
	CreatedAt      int64  `json:"created_at" gorm:"bigint"`
}

func (l *EntitlementAdjustmentLedger) BeforeCreate(_ *gorm.DB) error {
	l.CreatedAt = common.GetTimestamp()
	return nil
}

func entitlementDailyPeriod(now time.Time, timezone string) (int64, int64) {
	location, err := time.LoadLocation(strings.TrimSpace(timezone))
	if err != nil {
		location = time.UTC
	}
	local := now.In(location)
	start := time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, location)
	return start.Unix(), start.AddDate(0, 0, 1).Unix()
}

func GetUserEntitlementGroups(userId int) ([]string, error) {
	if userId <= 0 {
		return nil, nil
	}
	now := GetDBTimestamp()
	var groups []string
	err := DB.Model(&Entitlement{}).
		Distinct("entitlement_type_groups.group_name").
		Joins("JOIN entitlement_types ON entitlement_types.id = entitlements.entitlement_type_id").
		Joins("JOIN entitlement_type_groups ON entitlement_type_groups.entitlement_type_id = entitlement_types.id").
		Joins("JOIN access_group_policies ON access_group_policies.id = entitlement_type_groups.access_group_policy_id").
		Where("entitlements.user_id = ?", userId).
		Where("entitlements.state = ?", EntitlementStateActive).
		Where("entitlements.start_at <= ?", now).
		Where("(entitlements.expire_at = 0 OR entitlements.expire_at > ?)", now).
		Where("entitlements.used_quota < entitlements.total_quota").
		Where("entitlement_types.status = ?", EntitlementTypeStatusActive).
		Where("entitlements.asset_kind = access_group_policies.funding_source_type").
		Order("entitlement_type_groups.group_name asc").
		Pluck("entitlement_type_groups.group_name", &groups).Error
	return groups, err
}

func UserCanUseEntitlementGroup(userId int, groupName string) (bool, error) {
	if userId <= 0 || strings.TrimSpace(groupName) == "" {
		return false, nil
	}
	now := GetDBTimestamp()
	var count int64
	err := DB.Model(&Entitlement{}).
		Joins("JOIN entitlement_types ON entitlement_types.id = entitlements.entitlement_type_id").
		Joins("JOIN entitlement_type_groups ON entitlement_type_groups.entitlement_type_id = entitlement_types.id").
		Joins("JOIN access_group_policies ON access_group_policies.id = entitlement_type_groups.access_group_policy_id").
		Where("entitlements.user_id = ?", userId).
		Where("entitlements.state = ?", EntitlementStateActive).
		Where("entitlements.start_at <= ?", now).
		Where("(entitlements.expire_at = 0 OR entitlements.expire_at > ?)", now).
		Where("entitlements.used_quota < entitlements.total_quota").
		Where("entitlement_types.status = ?", EntitlementTypeStatusActive).
		Where("entitlement_type_groups.group_name = ?", strings.TrimSpace(groupName)).
		Where("entitlements.asset_kind = access_group_policies.funding_source_type").
		Limit(1).
		Count(&count).Error
	return count > 0, err
}
