package service

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
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
		count, err := model.ExpireCorporateTransferApplications(entitlementLifecycleBatchSize)
		if err != nil {
			logger.LogWarn(ctx, fmt.Sprintf("corporate transfer expiration failed: %v", err))
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
	attachments, err := model.ListDueCorporateEvidencePurges(entitlementLifecycleBatchSize)
	if err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("corporate evidence retention scan failed: %v", err))
		return
	}
	storageRoot := common.GetEnvOrDefaultString("CORPORATE_TRANSFER_STORAGE_PATH", "./data/corporate-transfer")
	for _, attachment := range attachments {
		cleanKey := filepath.Clean(attachment.StorageKey)
		if cleanKey == "." || filepath.IsAbs(cleanKey) || strings.HasPrefix(cleanKey, "..") {
			logger.LogWarn(ctx, fmt.Sprintf("corporate evidence has unsafe storage key: attachment=%d", attachment.Id))
			continue
		}
		path := filepath.Join(storageRoot, cleanKey)
		if removeErr := os.Remove(path); removeErr != nil && !os.IsNotExist(removeErr) {
			logger.LogWarn(ctx, fmt.Sprintf("corporate evidence purge failed: attachment=%d error=%v", attachment.Id, removeErr))
			continue
		}
		if markErr := model.MarkCorporateEvidencePurged(attachment.Id); markErr != nil {
			logger.LogWarn(ctx, fmt.Sprintf("corporate evidence purge mark failed: attachment=%d error=%v", attachment.Id, markErr))
		}
	}
}
