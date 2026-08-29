package service

import (
	"net/http/httptest"
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type recordingBillingSettler struct {
	preConsumed int
	settled     int
}

func (s *recordingBillingSettler) Settle(actualQuota int) error {
	s.settled = actualQuota
	return nil
}

func (s *recordingBillingSettler) Refund(_ *gin.Context) {}

func (s *recordingBillingSettler) NeedsRefund() bool { return true }

func (s *recordingBillingSettler) GetPreConsumedQuota() int { return s.preConsumed }

func (s *recordingBillingSettler) Reserve(targetQuota int) error {
	s.preConsumed = targetQuota
	return nil
}

func TestClientGoneFallbackUsesExistingSynchronousSettlement(t *testing.T) {
	settler := &recordingBillingSettler{preConsumed: 100}
	info := &relaycommon.RelayInfo{Billing: settler}
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	require.NoError(t, SettleBilling(ctx, info, 35))
	assert.Equal(t, 35, settler.settled)
}
