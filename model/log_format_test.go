package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"

	"github.com/stretchr/testify/require"
)

// TestFormatUserLogsStripsQuotaSaturation verifies the admin-only quota
// saturation marker (nested under other.admin_info) is removed for non-admin
// log views, since formatUserLogs strips the whole admin_info object.
func TestFormatUserLogsStripsQuotaSaturation(t *testing.T) {
	other := common.MapToJsonStr(map[string]interface{}{
		"model_price": 0.004,
		"admin_info": map[string]interface{}{
			"quota_saturation": map[string]interface{}{
				"op":      "QuotaFromDecimal",
				"kind":    "overflow",
				"clamped": common.MaxQuota,
			},
		},
	})
	logs := []*Log{{Other: other}}

	formatUserLogs(logs, 0)

	parsed, err := common.StrToMap(logs[0].Other)
	require.NoError(t, err)
	_, hasAdminInfo := parsed["admin_info"]
	require.False(t, hasAdminInfo, "admin_info (and nested quota_saturation) must be stripped for non-admin views")
	// Non-admin billing fields remain visible.
	require.Contains(t, parsed, "model_price")
}

func TestFormatUserLogsHidesUpstreamRoutingDetails(t *testing.T) {
	logs := []*Log{{
		ChannelId:         39,
		ChannelName:       "private-provider",
		UpstreamRequestId: "provider-request-id",
		Other: common.MapToJsonStr(map[string]interface{}{
			"channel_id":   39,
			"channel_name": "private-provider",
			"channel_type": 14,
			"status_code":  402,
			"error_type":   "billing_error",
			"error_code":   "insufficient_balance",
			"request_path": "/v1/responses",
		}),
	}}

	formatUserLogs(logs, 0)

	require.Zero(t, logs[0].ChannelId)
	require.Empty(t, logs[0].ChannelName)
	require.Empty(t, logs[0].UpstreamRequestId)
	other, err := common.StrToMap(logs[0].Other)
	require.NoError(t, err)
	require.Equal(t, "/v1/responses", other["request_path"])
	require.NotContains(t, other, "channel_id")
	require.NotContains(t, other, "channel_name")
	require.NotContains(t, other, "channel_type")
	require.NotContains(t, other, "status_code")
	require.NotContains(t, other, "error_type")
	require.NotContains(t, other, "error_code")
}
