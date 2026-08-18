package service

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"

	"github.com/bytedance/gopkg/util/gopool"
)

const (
	entitlementLifecycleTickInterval = time.Minute
	entitlementLifecycleBatchSize    = 300
)

var (
	entitlementLifecycleOnce    sync.Once
	entitlementLifecycleRunning atomic.Bool
)

func StartEntitlementLifecycleTask() {
	entitlementLifecycleOnce.Do(func() {
		if !common.IsMasterNode {
			return
		}
		gopool.Go(func() {
			logger.LogInfo(context.Background(), fmt.Sprintf("entitlement lifecycle task started: tick=%s", entitlementLifecycleTickInterval))
			ticker := time.NewTicker(entitlementLifecycleTickInterval)
			defer ticker.Stop()

			runEntitlementLifecycleOnce()
			for range ticker.C {
				runEntitlementLifecycleOnce()
			}
		})
	})
}

func runEntitlementLifecycleOnce() {
	if !entitlementLifecycleRunning.CompareAndSwap(false, true) {
		return
	}
	defer entitlementLifecycleRunning.Store(false)

	ctx := context.Background()
	for {
		count, err := model.RefreshDueEntitlementStates(entitlementLifecycleBatchSize)
		if err != nil {
			logger.LogWarn(ctx, fmt.Sprintf("entitlement state refresh failed: %v", err))
			return
		}
		if count < entitlementLifecycleBatchSize {
			break
		}
	}
	for {
		count, err := model.ExpirePendingProductOrders(entitlementLifecycleBatchSize)
		if err != nil {
			logger.LogWarn(ctx, fmt.Sprintf("product order expiration failed: %v", err))
			return
		}
		if count < entitlementLifecycleBatchSize {
			break
		}
	}
	for {
		count, err := model.ReleaseDueReferralRewards(entitlementLifecycleBatchSize)
		if err != nil {
			logger.LogWarn(ctx, fmt.Sprintf("referral reward release failed: %v", err))
			return
		}
		if count < entitlementLifecycleBatchSize {
			break
		}
	}
}
