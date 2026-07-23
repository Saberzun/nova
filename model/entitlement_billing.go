package model

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

const (
	UsageChargeStateReserved               = "reserved"
	UsageChargeStateSettled                = "settled"
	UsageChargeStateRefunded               = "refunded"
	UsageChargeStateReconciliationRequired = "reconciliation_required"
)

type UsageCharge struct {
	Id             int     `json:"id"`
	RequestId      string  `json:"request_id" gorm:"type:varchar(64);uniqueIndex;not null"`
	UserId         int     `json:"user_id" gorm:"index;not null"`
	APIKeyId       int     `json:"api_key_id" gorm:"index"`
	AccessGroup    string  `json:"access_group" gorm:"type:varchar(64);index;not null"`
	AssetKind      string  `json:"asset_kind" gorm:"type:varchar(32);index;not null"`
	ModelName      string  `json:"model_name" gorm:"type:varchar(128);index"`
	ModelRatio     float64 `json:"model_ratio"`
	GroupRatio     float64 `json:"group_ratio"`
	EstimatedQuota int64   `json:"estimated_quota" gorm:"bigint;not null"`
	ReservedQuota  int64   `json:"reserved_quota" gorm:"bigint;not null"`
	SettledQuota   int64   `json:"settled_quota" gorm:"bigint;not null"`
	UncoveredQuota int64   `json:"uncovered_quota" gorm:"bigint;not null"`
	State          string  `json:"state" gorm:"type:varchar(32);index;not null"`
	Metadata       string  `json:"metadata" gorm:"type:text"`
	CreatedAt      int64   `json:"created_at" gorm:"bigint"`
	SettledAt      int64   `json:"settled_at" gorm:"bigint"`
	UpdatedAt      int64   `json:"updated_at" gorm:"bigint;index"`

	Allocations []UsageChargeAllocation `json:"allocations,omitempty" gorm:"foreignKey:UsageChargeId"`
}

func (c *UsageCharge) BeforeCreate(_ *gorm.DB) error {
	now := common.GetTimestamp()
	c.RequestId = strings.TrimSpace(c.RequestId)
	if c.State == "" {
		c.State = UsageChargeStateReserved
	}
	c.CreatedAt = now
	c.UpdatedAt = now
	return nil
}

func (c *UsageCharge) BeforeUpdate(_ *gorm.DB) error {
	c.UpdatedAt = common.GetTimestamp()
	return nil
}

type UsageChargeAllocation struct {
	Id              int    `json:"id"`
	UsageChargeId   int    `json:"usage_charge_id" gorm:"index;not null"`
	EntitlementId   int    `json:"entitlement_id" gorm:"index;not null"`
	DailyUsageId    int    `json:"daily_usage_id" gorm:"index"`
	AllocationOrder int    `json:"allocation_order" gorm:"index;not null"`
	ReservedQuota   int64  `json:"reserved_quota" gorm:"bigint;not null"`
	SettledQuota    int64  `json:"settled_quota" gorm:"bigint;not null"`
	RefundedQuota   int64  `json:"refunded_quota" gorm:"bigint;not null"`
	State           string `json:"state" gorm:"type:varchar(32);index;not null"`
	CreatedAt       int64  `json:"created_at" gorm:"bigint"`
	SettledAt       int64  `json:"settled_at" gorm:"bigint"`
	UpdatedAt       int64  `json:"updated_at" gorm:"bigint"`
}

func (a *UsageChargeAllocation) BeforeCreate(_ *gorm.DB) error {
	now := common.GetTimestamp()
	if a.State == "" {
		a.State = UsageChargeStateReserved
	}
	a.CreatedAt = now
	a.UpdatedAt = now
	return nil
}

func (a *UsageChargeAllocation) BeforeUpdate(_ *gorm.DB) error {
	a.UpdatedAt = common.GetTimestamp()
	return nil
}

type EntitlementPreConsumeResult struct {
	UsageChargeId int
	ReservedQuota int64
	Allocations   []UsageChargeAllocation
}

func activeEntitlementCandidatesTx(tx *gorm.DB, userId int, accessGroup string, assetKind string, now int64) ([]Entitlement, error) {
	var entitlements []Entitlement
	query := tx.Model(&Entitlement{}).
		Select("entitlements.*").
		Joins("JOIN entitlement_types ON entitlement_types.id = entitlements.entitlement_type_id").
		Joins("JOIN entitlement_type_groups ON entitlement_type_groups.entitlement_type_id = entitlement_types.id").
		Where("entitlements.user_id = ?", userId).
		Where("entitlements.asset_kind = ?", assetKind).
		Where("entitlements.state = ?", EntitlementStateActive).
		Where("entitlements.start_at <= ?", now).
		Where("(entitlements.expire_at = 0 OR entitlements.expire_at > ?)", now).
		Where("entitlement_types.status = ?", EntitlementTypeStatusActive).
		Where("entitlement_type_groups.group_name = ?", accessGroup).
		Order("entitlements.sort_order asc, CASE WHEN entitlements.expire_at = 0 THEN 1 ELSE 0 END asc, entitlements.expire_at asc, entitlements.id asc")
	if err := lockForUpdate(query).Find(&entitlements).Error; err != nil {
		return nil, err
	}
	return entitlements, nil
}

func getOrCreateDailyUsageTx(tx *gorm.DB, entitlement *Entitlement, now time.Time) (*EntitlementDailyUsage, error) {
	if entitlement == nil || entitlement.DailyQuota <= 0 {
		return nil, nil
	}
	periodStart, periodEnd := entitlementDailyPeriod(now, entitlement.ResetTimezone)
	var usage EntitlementDailyUsage
	query := lockForUpdate(tx).
		Where("entitlement_id = ? AND period_start = ?", entitlement.Id, periodStart).
		Limit(1).
		Find(&usage)
	if query.Error != nil {
		return nil, query.Error
	}
	if query.RowsAffected > 0 {
		return &usage, nil
	}
	usage = EntitlementDailyUsage{
		EntitlementId: entitlement.Id,
		PeriodStart:   periodStart,
		PeriodEnd:     periodEnd,
	}
	if err := tx.Create(&usage).Error; err != nil {
		var existing EntitlementDailyUsage
		if findErr := lockForUpdate(tx).
			Where("entitlement_id = ? AND period_start = ?", entitlement.Id, periodStart).
			First(&existing).Error; findErr == nil {
			return &existing, nil
		}
		return nil, err
	}
	return &usage, nil
}

func reserveEntitlementChargeTx(tx *gorm.DB, charge *UsageCharge, amount int64) ([]UsageChargeAllocation, error) {
	if tx == nil || charge == nil || charge.Id <= 0 || amount <= 0 {
		return nil, errors.New("invalid entitlement reservation")
	}
	now := time.Unix(getDBTimestampTx(tx), 0)
	candidates, err := activeEntitlementCandidatesTx(tx, charge.UserId, charge.AccessGroup, charge.AssetKind, now.Unix())
	if err != nil {
		return nil, err
	}
	remaining := amount
	type reservationPlan struct {
		entitlement *Entitlement
		dailyUsage  *EntitlementDailyUsage
		amount      int64
	}
	plans := make([]reservationPlan, 0)
	for i := range candidates {
		if remaining <= 0 {
			break
		}
		entitlement := &candidates[i]
		available := entitlement.AvailableQuota()
		if available <= 0 {
			continue
		}
		dailyUsage, err := getOrCreateDailyUsageTx(tx, entitlement, now)
		if err != nil {
			return nil, err
		}
		if dailyUsage != nil {
			dailyAvailable := dailyUsage.AvailableQuota(entitlement.DailyQuota)
			if dailyAvailable < available {
				available = dailyAvailable
			}
		}
		if available <= 0 {
			continue
		}
		allocated := available
		if allocated > remaining {
			allocated = remaining
		}
		plans = append(plans, reservationPlan{entitlement: entitlement, dailyUsage: dailyUsage, amount: allocated})
		remaining -= allocated
	}
	if remaining > 0 {
		return nil, fmt.Errorf("%w, need=%d available=%d", ErrEntitlementQuotaInsufficient, amount, amount-remaining)
	}

	allocations := make([]UsageChargeAllocation, 0, len(plans))
	var existingCount int64
	if err := tx.Model(&UsageChargeAllocation{}).Where("usage_charge_id = ?", charge.Id).Count(&existingCount).Error; err != nil {
		return nil, err
	}
	for _, plan := range plans {
		entitlement := plan.entitlement
		dailyUsage := plan.dailyUsage
		allocated := plan.amount
		result := tx.Model(&Entitlement{}).
			Where("id = ? AND total_quota - used_quota - reserved_quota >= ?", entitlement.Id, allocated).
			Updates(map[string]interface{}{
				"reserved_quota": gorm.Expr("reserved_quota + ?", allocated),
				"updated_at":     common.GetTimestamp(),
			})
		if result.Error != nil {
			return nil, result.Error
		}
		if result.RowsAffected != 1 {
			return nil, ErrEntitlementQuotaInsufficient
		}
		if dailyUsage != nil {
			result := tx.Model(&EntitlementDailyUsage{}).
				Where("id = ? AND ? - used_quota - reserved_quota >= ?", dailyUsage.Id, entitlement.DailyQuota, allocated).
				Updates(map[string]interface{}{
					"reserved_quota": gorm.Expr("reserved_quota + ?", allocated),
					"updated_at":     common.GetTimestamp(),
				})
			if result.Error != nil {
				return nil, result.Error
			}
			if result.RowsAffected != 1 {
				return nil, ErrEntitlementQuotaInsufficient
			}
		}

		allocation := UsageChargeAllocation{
			UsageChargeId:   charge.Id,
			EntitlementId:   entitlement.Id,
			AllocationOrder: int(existingCount) + len(allocations),
			ReservedQuota:   allocated,
			State:           UsageChargeStateReserved,
		}
		if dailyUsage != nil {
			allocation.DailyUsageId = dailyUsage.Id
		}
		if err := tx.Create(&allocation).Error; err != nil {
			return nil, err
		}
		allocations = append(allocations, allocation)
	}
	return allocations, nil
}

func PreConsumeEntitlements(requestId string, userId int, apiKeyId int, accessGroup string, assetKind string, modelName string, amount int64) (*EntitlementPreConsumeResult, error) {
	requestId = strings.TrimSpace(requestId)
	accessGroup = strings.TrimSpace(accessGroup)
	if requestId == "" || userId <= 0 || accessGroup == "" || amount <= 0 {
		return nil, errors.New("invalid entitlement pre-consume request")
	}
	policyKind, found, err := GetAccessGroupFundingType(accessGroup)
	if err != nil {
		return nil, err
	}
	if !found || policyKind != assetKind {
		return nil, ErrEntitlementFundingMismatch
	}
	result := &EntitlementPreConsumeResult{}
	err = DB.Transaction(func(tx *gorm.DB) error {
		var existing UsageCharge
		query := lockForUpdate(tx).Preload("Allocations", func(db *gorm.DB) *gorm.DB {
			return db.Order("allocation_order asc, id asc")
		}).Where("request_id = ?", requestId).Limit(1).Find(&existing)
		if query.Error != nil {
			return query.Error
		}
		if query.RowsAffected > 0 {
			if existing.State == UsageChargeStateRefunded {
				return ErrEntitlementChargeRefunded
			}
			result.UsageChargeId = existing.Id
			result.ReservedQuota = existing.ReservedQuota
			result.Allocations = existing.Allocations
			return nil
		}
		charge := UsageCharge{
			RequestId:      requestId,
			UserId:         userId,
			APIKeyId:       apiKeyId,
			AccessGroup:    accessGroup,
			AssetKind:      assetKind,
			ModelName:      modelName,
			EstimatedQuota: amount,
			State:          UsageChargeStateReserved,
		}
		if err := tx.Create(&charge).Error; err != nil {
			return err
		}
		allocations, err := reserveEntitlementChargeTx(tx, &charge, amount)
		if err != nil {
			return err
		}
		charge.ReservedQuota = amount
		if err := tx.Model(&charge).Updates(map[string]interface{}{
			"reserved_quota": amount,
			"updated_at":     common.GetTimestamp(),
		}).Error; err != nil {
			return err
		}
		result.UsageChargeId = charge.Id
		result.ReservedQuota = amount
		result.Allocations = allocations
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

func IncreaseEntitlementReservation(requestId string, amount int64) error {
	if strings.TrimSpace(requestId) == "" || amount <= 0 {
		return errors.New("invalid entitlement reservation increase")
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		var charge UsageCharge
		if err := lockForUpdate(tx).Where("request_id = ?", requestId).First(&charge).Error; err != nil {
			return err
		}
		if charge.State != UsageChargeStateReserved {
			return fmt.Errorf("usage charge is not reservable: %s", charge.State)
		}
		_, err := reserveEntitlementChargeTx(tx, &charge, amount)
		if err != nil {
			return err
		}
		return tx.Model(&charge).Updates(map[string]interface{}{
			"estimated_quota": gorm.Expr("estimated_quota + ?", amount),
			"reserved_quota":  gorm.Expr("reserved_quota + ?", amount),
			"updated_at":      common.GetTimestamp(),
		}).Error
	})
}

func SettleEntitlementCharge(requestId string, actualQuota int64) error {
	if strings.TrimSpace(requestId) == "" || actualQuota < 0 {
		return errors.New("invalid entitlement settlement")
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		var charge UsageCharge
		if err := lockForUpdate(tx).Where("request_id = ?", requestId).First(&charge).Error; err != nil {
			return err
		}
		if charge.State == UsageChargeStateSettled || charge.State == UsageChargeStateReconciliationRequired {
			return nil
		}
		if charge.State == UsageChargeStateRefunded {
			return ErrEntitlementChargeRefunded
		}
		if actualQuota > charge.ReservedQuota {
			additional := actualQuota - charge.ReservedQuota
			const savepoint = "entitlement_settle_reserve"
			if err := tx.SavePoint(savepoint).Error; err != nil {
				return err
			}
			if _, err := reserveEntitlementChargeTx(tx, &charge, additional); err == nil {
				charge.ReservedQuota += additional
			} else {
				if rollbackErr := tx.RollbackTo(savepoint).Error; rollbackErr != nil {
					return rollbackErr
				}
				if !errors.Is(err, ErrEntitlementQuotaInsufficient) {
					return err
				}
			}
		}

		var allocations []UsageChargeAllocation
		if err := lockForUpdate(tx).Where("usage_charge_id = ?", charge.Id).
			Order("allocation_order asc, id asc").Find(&allocations).Error; err != nil {
			return err
		}
		remaining := actualQuota
		settledTotal := int64(0)
		now := common.GetTimestamp()
		for i := range allocations {
			allocation := &allocations[i]
			settled := allocation.ReservedQuota
			if settled > remaining {
				settled = remaining
			}
			if settled < 0 {
				settled = 0
			}
			refunded := allocation.ReservedQuota - settled
			result := tx.Model(&Entitlement{}).
				Where("id = ? AND reserved_quota >= ?", allocation.EntitlementId, allocation.ReservedQuota).
				Updates(map[string]interface{}{
					"reserved_quota": gorm.Expr("reserved_quota - ?", allocation.ReservedQuota),
					"used_quota":     gorm.Expr("used_quota + ?", settled),
					"state":          gorm.Expr("CASE WHEN used_quota + ? >= total_quota THEN ? ELSE state END", settled, EntitlementStateDepleted),
					"updated_at":     now,
				})
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected != 1 {
				return errors.New("entitlement reservation changed during settlement")
			}
			if allocation.DailyUsageId > 0 {
				result := tx.Model(&EntitlementDailyUsage{}).
					Where("id = ? AND reserved_quota >= ?", allocation.DailyUsageId, allocation.ReservedQuota).
					Updates(map[string]interface{}{
						"reserved_quota": gorm.Expr("reserved_quota - ?", allocation.ReservedQuota),
						"used_quota":     gorm.Expr("used_quota + ?", settled),
						"updated_at":     now,
					})
				if result.Error != nil {
					return result.Error
				}
				if result.RowsAffected != 1 {
					return errors.New("daily reservation changed during settlement")
				}
			}
			state := UsageChargeStateSettled
			if settled == 0 {
				state = UsageChargeStateRefunded
			}
			if err := tx.Model(allocation).Updates(map[string]interface{}{
				"settled_quota":  settled,
				"refunded_quota": refunded,
				"state":          state,
				"settled_at":     now,
				"updated_at":     now,
			}).Error; err != nil {
				return err
			}
			settledTotal += settled
			remaining -= settled
			if remaining < 0 {
				remaining = 0
			}
		}
		state := UsageChargeStateSettled
		uncovered := actualQuota - settledTotal
		if uncovered > 0 {
			state = UsageChargeStateReconciliationRequired
			common.SysLog(fmt.Sprintf("entitlement charge requires reconciliation: request_id=%s uncovered_quota=%d", requestId, uncovered))
		}
		return tx.Model(&charge).Updates(map[string]interface{}{
			"settled_quota":   settledTotal,
			"uncovered_quota": uncovered,
			"state":           state,
			"settled_at":      now,
			"updated_at":      now,
		}).Error
	})
}

func RefundEntitlementCharge(requestId string) error {
	if strings.TrimSpace(requestId) == "" {
		return errors.New("invalid entitlement refund")
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		var charge UsageCharge
		if err := lockForUpdate(tx).Where("request_id = ?", requestId).First(&charge).Error; err != nil {
			return err
		}
		if charge.State == UsageChargeStateRefunded {
			return nil
		}
		if charge.State != UsageChargeStateReserved {
			return fmt.Errorf("usage charge cannot be refunded from state %s", charge.State)
		}
		var allocations []UsageChargeAllocation
		if err := lockForUpdate(tx).Where("usage_charge_id = ?", charge.Id).Find(&allocations).Error; err != nil {
			return err
		}
		now := common.GetTimestamp()
		for i := range allocations {
			allocation := &allocations[i]
			result := tx.Model(&Entitlement{}).
				Where("id = ? AND reserved_quota >= ?", allocation.EntitlementId, allocation.ReservedQuota).
				Updates(map[string]interface{}{
					"reserved_quota": gorm.Expr("reserved_quota - ?", allocation.ReservedQuota),
					"updated_at":     now,
				})
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected != 1 {
				return errors.New("entitlement reservation changed during refund")
			}
			if allocation.DailyUsageId > 0 {
				result := tx.Model(&EntitlementDailyUsage{}).
					Where("id = ? AND reserved_quota >= ?", allocation.DailyUsageId, allocation.ReservedQuota).
					Updates(map[string]interface{}{
						"reserved_quota": gorm.Expr("reserved_quota - ?", allocation.ReservedQuota),
						"updated_at":     now,
					})
				if result.Error != nil {
					return result.Error
				}
				if result.RowsAffected != 1 {
					return errors.New("daily reservation changed during refund")
				}
			}
			if err := tx.Model(allocation).Updates(map[string]interface{}{
				"refunded_quota": allocation.ReservedQuota,
				"state":          UsageChargeStateRefunded,
				"settled_at":     now,
				"updated_at":     now,
			}).Error; err != nil {
				return err
			}
		}
		return tx.Model(&charge).Updates(map[string]interface{}{
			"state":      UsageChargeStateRefunded,
			"settled_at": now,
			"updated_at": now,
		}).Error
	})
}
