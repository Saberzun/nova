package model

import (
	"fmt"
	"math"
	"strconv"

	"gorm.io/gorm"
)

const (
	billingLedgerVersionKey    = "BillingLedgerVersion"
	billingLedgerNanoUSDV1     = "nano_usd_v1"
	legacyQuotaToNanoUSDFactor = int64(2000)
)

type ledgerColumn struct {
	table  string
	column string
}

var legacyLedgerColumns = []ledgerColumn{
	{"users", "quota"},
	{"users", "used_quota"},
	{"users", "aff_quota"},
	{"users", "aff_history"},
	{"tokens", "remain_quota"},
	{"tokens", "used_quota"},
	{"channels", "used_quota"},
	{"redemptions", "quota"},
	{"logs", "quota"},
	{"midjourneys", "quota"},
	{"quota_data", "quota"},
	{"tasks", "quota"},
	{"checkins", "quota_awarded"},
	{"subscription_plans", "total_amount"},
	{"user_subscriptions", "amount_total"},
	{"user_subscriptions", "amount_used"},
	{"subscription_pre_consume_records", "pre_consumed"},
	{"product_skus", "grant_total_quota"},
	{"product_skus", "grant_daily_quota"},
	{"product_order_items", "grant_total_quota"},
	{"product_order_items", "grant_daily_quota"},
	{"entitlements", "total_quota"},
	{"entitlements", "used_quota"},
	{"entitlements", "reserved_quota"},
	{"entitlements", "daily_quota"},
	{"entitlement_daily_usages", "used_quota"},
	{"entitlement_daily_usages", "reserved_quota"},
	{"entitlement_adjustment_ledgers", "delta_quota"},
	{"usage_charges", "estimated_quota"},
	{"usage_charges", "reserved_quota"},
	{"usage_charges", "settled_quota"},
	{"usage_charges", "uncovered_quota"},
	{"usage_charge_allocations", "reserved_quota"},
	{"usage_charge_allocations", "settled_quota"},
	{"usage_charge_allocations", "refunded_quota"},
}

var legacyLedgerOptionKeys = []string{
	"QuotaForNewUser",
	"QuotaForInviter",
	"QuotaForInvitee",
	"QuotaRemindThreshold",
	"checkin_setting.min_quota",
	"checkin_setting.max_quota",
}

// migrateBillingLedgerToNanoUSD converts the historical fixed
// 500,000-units-per-USD ledger to a fixed nanoUSD ledger. The marker and all
// value updates are committed atomically, making repeated starts idempotent.
func migrateBillingLedgerToNanoUSD() error {
	return DB.Transaction(func(tx *gorm.DB) error {
		var marker Option
		result := tx.Where("key = ?", billingLedgerVersionKey).Limit(1).Find(&marker)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected > 0 {
			if marker.Value != billingLedgerNanoUSDV1 {
				return fmt.Errorf("unsupported billing ledger version %q", marker.Value)
			}
			return nil
		}

		for _, item := range legacyLedgerColumns {
			if !tx.Migrator().HasTable(item.table) || !tx.Migrator().HasColumn(item.table, item.column) {
				continue
			}
			query := fmt.Sprintf(
				"UPDATE %s SET %s = %s * ? WHERE %s <> 0",
				item.table,
				item.column,
				item.column,
				item.column,
			)
			if err := tx.Exec(query, legacyQuotaToNanoUSDFactor).Error; err != nil {
				return fmt.Errorf("migrate %s.%s to nanoUSD: %w", item.table, item.column, err)
			}
		}

		for _, key := range legacyLedgerOptionKeys {
			var option Option
			result := tx.Where("key = ?", key).Limit(1).Find(&option)
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected == 0 {
				continue
			}
			value, err := strconv.ParseInt(option.Value, 10, 64)
			if err != nil {
				return fmt.Errorf("migrate ledger option %s: %w", key, err)
			}
			if value > math.MaxInt64/legacyQuotaToNanoUSDFactor ||
				value < math.MinInt64/legacyQuotaToNanoUSDFactor {
				return fmt.Errorf("migrate ledger option %s: value overflows nanoUSD ledger", key)
			}
			option.Value = strconv.FormatInt(value*legacyQuotaToNanoUSDFactor, 10)
			if err := tx.Save(&option).Error; err != nil {
				return err
			}
		}

		if err := tx.Where("key = ?", "QuotaPerUnit").Delete(&Option{}).Error; err != nil {
			return err
		}
		return tx.Create(&Option{Key: billingLedgerVersionKey, Value: billingLedgerNanoUSDV1}).Error
	})
}
