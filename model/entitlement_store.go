package model

import (
	"errors"
	"fmt"
	"sort"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

func ReplaceEntitlementTypeGroups(typeId int, groupNames []string, operatorId int, reason string) error {
	if typeId <= 0 {
		return errors.New("invalid entitlement type id")
	}
	cleanNames := make([]string, 0, len(groupNames))
	seen := make(map[string]struct{}, len(groupNames))
	for _, groupName := range groupNames {
		groupName = strings.TrimSpace(groupName)
		if groupName == "" {
			continue
		}
		if _, ok := seen[groupName]; ok {
			continue
		}
		seen[groupName] = struct{}{}
		cleanNames = append(cleanNames, groupName)
	}
	sort.Strings(cleanNames)
	return DB.Transaction(func(tx *gorm.DB) error {
		var entitlementType EntitlementType
		if err := lockForUpdate(tx).Where("id = ?", typeId).First(&entitlementType).Error; err != nil {
			return err
		}
		var oldGroups []EntitlementTypeGroup
		if err := tx.Where("entitlement_type_id = ?", typeId).Order("group_name asc").Find(&oldGroups).Error; err != nil {
			return err
		}
		oldNames := make([]string, 0, len(oldGroups))
		for _, group := range oldGroups {
			oldNames = append(oldNames, group.GroupName)
		}
		newGroups := make([]EntitlementTypeGroup, 0, len(cleanNames))
		for _, groupName := range cleanNames {
			var policy AccessGroupPolicy
			if err := tx.Where("group_name = ?", groupName).First(&policy).Error; err != nil {
				return fmt.Errorf("access group %s has no funding policy: %w", groupName, err)
			}
			if policy.FundingSourceType != entitlementType.AssetKind {
				return fmt.Errorf("%w: type=%s group=%s", ErrEntitlementFundingMismatch, entitlementType.AssetKind, policy.FundingSourceType)
			}
			newGroups = append(newGroups, EntitlementTypeGroup{
				EntitlementTypeId:   typeId,
				AccessGroupPolicyId: policy.Id,
				GroupName:           groupName,
				CreatedBy:           operatorId,
			})
		}
		beforeJSON, err := common.Marshal(oldNames)
		if err != nil {
			return err
		}
		afterJSON, err := common.Marshal(cleanNames)
		if err != nil {
			return err
		}
		if err := tx.Where("entitlement_type_id = ?", typeId).Delete(&EntitlementTypeGroup{}).Error; err != nil {
			return err
		}
		if len(newGroups) > 0 {
			if err := tx.Create(&newGroups).Error; err != nil {
				return err
			}
		}
		entitlementType.Revision++
		if err := tx.Model(&entitlementType).Updates(map[string]interface{}{
			"revision":   entitlementType.Revision,
			"updated_at": common.GetTimestamp(),
		}).Error; err != nil {
			return err
		}
		return tx.Create(&EntitlementTypeChangeLog{
			EntitlementTypeId: typeId,
			Revision:          entitlementType.Revision,
			Action:            "replace_groups",
			BeforeJSON:        string(beforeJSON),
			AfterJSON:         string(afterJSON),
			OperatorId:        operatorId,
			Reason:            strings.TrimSpace(reason),
		}).Error
	})
}

func CreateProductOrder(userId int, skuId int, quantity int) (*ProductOrder, error) {
	if userId <= 0 || skuId <= 0 || quantity <= 0 || quantity > 100 {
		return nil, errors.New("invalid product order")
	}
	var created ProductOrder
	err := DB.Transaction(func(tx *gorm.DB) error {
		var sku ProductSKU
		if err := lockForUpdate(tx).Where("id = ? AND status = ?", skuId, ProductStatusActive).First(&sku).Error; err != nil {
			return err
		}
		var product Product
		if err := tx.Where("id = ? AND status = ?", sku.ProductId, ProductStatusActive).First(&product).Error; err != nil {
			return err
		}
		var entitlementType EntitlementType
		if err := tx.Where("id = ? AND status = ?", sku.EntitlementTypeId, EntitlementTypeStatusActive).First(&entitlementType).Error; err != nil {
			return err
		}
		if quantity > 1 && !sku.MultiQuantityEnabled {
			return errors.New("sku does not allow multiple quantities")
		}
		if sku.GrantTotalQuota <= 0 || sku.PriceAmountMinor < 0 {
			return errors.New("invalid sku grant or price")
		}
		if product.Category == ProductCategorySubscription {
			if entitlementType.AssetKind != EntitlementAssetSubscription || sku.ValiditySeconds <= 0 {
				return errors.New("invalid subscription sku")
			}
		} else if product.Category == ProductCategoryRecharge {
			if entitlementType.AssetKind != EntitlementAssetStoredValue || sku.ActivationPolicy != ActivationPolicyImmediate {
				return errors.New("invalid recharge sku")
			}
		} else {
			return errors.New("unsupported product category")
		}
		if sku.Stock > 0 && sku.Stock < int64(quantity) {
			return errors.New("sku stock insufficient")
		}
		if sku.PurchaseLimit > 0 {
			var purchased int64
			if err := tx.Model(&ProductOrderItem{}).
				Joins("JOIN product_orders ON product_orders.id = product_order_items.order_id").
				Where("product_orders.user_id = ? AND product_order_items.sku_id = ? AND product_orders.status IN ?", userId, skuId, []string{ProductOrderStatusPaid, ProductOrderStatusFulfilled}).
				Select("COALESCE(SUM(product_order_items.quantity), 0)").Scan(&purchased).Error; err != nil {
				return err
			}
			if purchased+int64(quantity) > int64(sku.PurchaseLimit) {
				return errors.New("sku purchase limit exceeded")
			}
		}
		orderNo := fmt.Sprintf("PO-%d-%s", common.GetTimestamp(), common.GetRandomString(10))
		order := ProductOrder{
			OrderNo:          orderNo,
			UserId:           userId,
			Status:           ProductOrderStatusPending,
			TotalAmountMinor: sku.PriceAmountMinor * int64(quantity),
			Currency:         sku.Currency,
		}
		if err := tx.Create(&order).Error; err != nil {
			return err
		}
		item := ProductOrderItem{
			OrderId:               order.Id,
			ProductId:             product.Id,
			SKUId:                 sku.Id,
			EntitlementTypeId:     entitlementType.Id,
			ProductName:           product.Name,
			SKUName:               sku.Name,
			Quantity:              quantity,
			UnitPriceAmountMinor:  sku.PriceAmountMinor,
			GrantTotalQuota:       sku.GrantTotalQuota,
			GrantDailyQuota:       sku.GrantDailyQuota,
			ValiditySeconds:       sku.ValiditySeconds,
			ActivationPolicy:      sku.ActivationPolicy,
			ActivationDeadlineSec: sku.ActivationDeadlineSec,
		}
		if err := tx.Create(&item).Error; err != nil {
			return err
		}
		if sku.Stock > 0 {
			result := tx.Model(&ProductSKU{}).Where("id = ? AND stock >= ?", sku.Id, quantity).
				Update("stock", gorm.Expr("stock - ?", quantity))
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected != 1 {
				return errors.New("sku stock insufficient")
			}
		}
		order.Items = []ProductOrderItem{item}
		created = order
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &created, nil
}

func CompleteProductOrder(orderNo string, providerTradeNo string, paymentMethod string) error {
	return CompleteProductOrderWithProvider(orderNo, providerTradeNo, "", paymentMethod, "")
}

func PrepareProductOrderPayment(orderNo string, userId int, paymentProvider string, paymentMethod string) (*ProductOrder, error) {
	orderNo = strings.TrimSpace(orderNo)
	paymentProvider = strings.TrimSpace(paymentProvider)
	paymentMethod = strings.TrimSpace(paymentMethod)
	if orderNo == "" || userId <= 0 || paymentProvider == "" || paymentMethod == "" {
		return nil, errors.New("invalid product order payment")
	}
	var prepared ProductOrder
	err := DB.Transaction(func(tx *gorm.DB) error {
		var order ProductOrder
		if err := lockForUpdate(tx).Where("order_no = ? AND user_id = ?", orderNo, userId).First(&order).Error; err != nil {
			return err
		}
		if order.Status != ProductOrderStatusPending {
			return fmt.Errorf("order cannot be paid from status %s", order.Status)
		}
		if order.TotalAmountMinor <= 0 {
			return errors.New("free order does not require payment")
		}
		if order.PaymentProvider != "" && order.PaymentProvider != paymentProvider {
			return ErrPaymentMethodMismatch
		}
		if err := tx.Model(&order).Updates(map[string]interface{}{
			"payment_provider": paymentProvider,
			"payment_method":   paymentMethod,
			"updated_at":       common.GetTimestamp(),
		}).Error; err != nil {
			return err
		}
		order.PaymentProvider = paymentProvider
		order.PaymentMethod = paymentMethod
		prepared = order
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &prepared, nil
}

func CompleteProductOrderWithProvider(orderNo string, providerTradeNo string, expectedPaymentProvider string, paymentMethod string, providerPayload string) error {
	orderNo = strings.TrimSpace(orderNo)
	if orderNo == "" {
		return errors.New("order number is empty")
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		var order ProductOrder
		if err := lockForUpdate(tx).Preload("Items").Where("order_no = ?", orderNo).First(&order).Error; err != nil {
			return err
		}
		if order.Status == ProductOrderStatusFulfilled {
			return nil
		}
		if expectedPaymentProvider != "" && order.PaymentProvider != expectedPaymentProvider {
			return ErrPaymentMethodMismatch
		}
		if order.Status != ProductOrderStatusPending && order.Status != ProductOrderStatusPaid {
			return fmt.Errorf("order cannot be fulfilled from status %s", order.Status)
		}
		now := getDBTimestampTx(tx)
		batchId := fmt.Sprintf("FUL-%d-%s", order.Id, common.GetRandomString(8))
		for _, item := range order.Items {
			var entitlementType EntitlementType
			if err := tx.Where("id = ?", item.EntitlementTypeId).First(&entitlementType).Error; err != nil {
				return err
			}
			for quantityIndex := 0; quantityIndex < item.Quantity; quantityIndex++ {
				fulfillmentKey := fmt.Sprintf("%d:%d", item.Id, quantityIndex)
				var existingCount int64
				if err := tx.Model(&Entitlement{}).Where("fulfillment_key = ?", fulfillmentKey).Count(&existingCount).Error; err != nil {
					return err
				}
				if existingCount > 0 {
					continue
				}
				state := EntitlementStateActive
				startAt := now
				expireAt := int64(0)
				activationDeadline := int64(0)
				if entitlementType.AssetKind == EntitlementAssetSubscription {
					switch item.ActivationPolicy {
					case ActivationPolicyManual:
						state, startAt = EntitlementStatePending, 0
						if item.ActivationDeadlineSec > 0 {
							activationDeadline = now + item.ActivationDeadlineSec
						}
					case ActivationPolicyDeferred:
						var lastExpire int64
						if err := tx.Model(&Entitlement{}).
							Where("user_id = ? AND entitlement_type_id = ? AND state IN ?", order.UserId, item.EntitlementTypeId, []string{EntitlementStateActive, EntitlementStateQueued}).
							Select("COALESCE(MAX(expire_at), 0)").Scan(&lastExpire).Error; err != nil {
							return err
						}
						if lastExpire > startAt {
							startAt, state = lastExpire, EntitlementStateQueued
						}
					}
					if startAt > 0 {
						expireAt = startAt + item.ValiditySeconds
					}
				}
				entitlement := Entitlement{
					UserId:             order.UserId,
					EntitlementTypeId:  item.EntitlementTypeId,
					AssetKind:          entitlementType.AssetKind,
					ProductId:          item.ProductId,
					SKUId:              item.SKUId,
					OrderItemId:        item.Id,
					QuantityIndex:      quantityIndex,
					FulfillmentKey:     &fulfillmentKey,
					State:              state,
					TotalQuota:         item.GrantTotalQuota,
					DailyQuota:         item.GrantDailyQuota,
					ResetTimezone:      "Asia/Shanghai",
					StartAt:            startAt,
					ExpireAt:           expireAt,
					ActivationDeadline: activationDeadline,
					SourceType:         "order",
					SourceId:           order.Id,
					FulfillmentBatchId: batchId,
				}
				if err := tx.Create(&entitlement).Error; err != nil {
					return err
				}
			}
		}
		tradeNo := strings.TrimSpace(providerTradeNo)
		updates := map[string]interface{}{
			"status":         ProductOrderStatusFulfilled,
			"payment_method": strings.TrimSpace(paymentMethod),
			"paid_at":        now,
			"fulfilled_at":   now,
			"updated_at":     common.GetTimestamp(),
		}
		if expectedPaymentProvider != "" {
			updates["payment_provider"] = expectedPaymentProvider
		}
		if strings.TrimSpace(providerPayload) != "" {
			updates["provider_payload"] = providerPayload
		}
		if tradeNo != "" {
			updates["provider_trade_no"] = tradeNo
		}
		return tx.Model(&order).Updates(updates).Error
	})
}

func AdjustEntitlement(entitlementId int, operatorId int, deltaQuota int64, reason string, idempotencyKey string) error {
	reason = strings.TrimSpace(reason)
	idempotencyKey = strings.TrimSpace(idempotencyKey)
	if entitlementId <= 0 || deltaQuota == 0 || reason == "" || idempotencyKey == "" {
		return errors.New("invalid entitlement adjustment")
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		var existing EntitlementAdjustmentLedger
		query := tx.Where("idempotency_key = ?", idempotencyKey).Limit(1).Find(&existing)
		if query.Error != nil {
			return query.Error
		}
		if query.RowsAffected > 0 {
			if existing.EntitlementId == entitlementId && existing.DeltaQuota == deltaQuota {
				return nil
			}
			return errors.New("idempotency key already used for another adjustment")
		}
		var entitlement Entitlement
		if err := lockForUpdate(tx).Where("id = ?", entitlementId).First(&entitlement).Error; err != nil {
			return err
		}
		newTotal := entitlement.TotalQuota + deltaQuota
		if newTotal < entitlement.UsedQuota+entitlement.ReservedQuota {
			return errors.New("adjusted quota cannot be less than used plus reserved quota")
		}
		ledger := EntitlementAdjustmentLedger{
			IdempotencyKey: idempotencyKey,
			EntitlementId:  entitlementId,
			OperatorId:     operatorId,
			DeltaQuota:     deltaQuota,
			Reason:         reason,
		}
		if err := tx.Create(&ledger).Error; err != nil {
			return err
		}
		updates := map[string]interface{}{"total_quota": newTotal, "updated_at": common.GetTimestamp()}
		if entitlement.State == EntitlementStateDepleted && newTotal > entitlement.UsedQuota {
			updates["state"] = EntitlementStateActive
		}
		result := tx.Model(&Entitlement{}).Where("id = ?", entitlementId).Updates(updates)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return gorm.ErrRecordNotFound
		}
		return nil
	})
}

func RevokeEntitlement(entitlementId int) error {
	if entitlementId <= 0 {
		return errors.New("invalid entitlement id")
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		var entitlement Entitlement
		if err := lockForUpdate(tx).Where("id = ?", entitlementId).First(&entitlement).Error; err != nil {
			return err
		}
		if entitlement.State == EntitlementStateCancelled {
			return nil
		}
		if entitlement.ReservedQuota != 0 {
			return errors.New("entitlement still has in-flight reservations")
		}
		result := tx.Model(&Entitlement{}).Where("id = ? AND reserved_quota = 0", entitlementId).
			Updates(map[string]interface{}{"state": EntitlementStateCancelled, "updated_at": common.GetTimestamp()})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return errors.New("entitlement still has in-flight reservations")
		}
		return nil
	})
}

func ActivateEntitlement(userId int, entitlementId int) error {
	if userId <= 0 || entitlementId <= 0 {
		return errors.New("invalid entitlement activation")
	}
	now := GetDBTimestamp()
	return DB.Transaction(func(tx *gorm.DB) error {
		var entitlement Entitlement
		if err := lockForUpdate(tx).Where("id = ? AND user_id = ?", entitlementId, userId).First(&entitlement).Error; err != nil {
			return err
		}
		if entitlement.State == EntitlementStateActive {
			return nil
		}
		if entitlement.State != EntitlementStatePending {
			return errors.New("entitlement is not pending activation")
		}
		if entitlement.ActivationDeadline > 0 && entitlement.ActivationDeadline <= now {
			return errors.New("entitlement activation deadline passed")
		}
		var item ProductOrderItem
		if err := tx.Where("id = ?", entitlement.OrderItemId).First(&item).Error; err != nil {
			return err
		}
		return tx.Model(&entitlement).Updates(map[string]interface{}{
			"state":      EntitlementStateActive,
			"start_at":   now,
			"expire_at":  now + item.ValiditySeconds,
			"updated_at": common.GetTimestamp(),
		}).Error
	})
}
