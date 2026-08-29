package openai

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNormalizeResponsesUsageRequiresCompleteConsistentFields(t *testing.T) {
	validZero := `{"type":"response.completed","response":{"usage":{"input_tokens":0,"output_tokens":0,"total_tokens":0}}}`
	var event dto.ResponsesStreamResponse
	require.NoError(t, common.UnmarshalJsonStr(validZero, &event))
	usage, valid, reason := normalizeResponsesUsage(validZero, event.Response.Usage)
	require.True(t, valid)
	require.Empty(t, reason)
	assert.Equal(t, 0, usage.TotalTokens)

	partial := `{"type":"response.completed","response":{"usage":{"input_tokens":2,"output_tokens":1}}}`
	require.NoError(t, common.UnmarshalJsonStr(partial, &event))
	_, valid, reason = normalizeResponsesUsage(partial, event.Response.Usage)
	assert.False(t, valid)
	assert.Equal(t, "usage_required_field_missing_or_invalid", reason)

	contradictory := `{"type":"response.completed","response":{"usage":{"input_tokens":2,"output_tokens":1,"total_tokens":9}}}`
	require.NoError(t, common.UnmarshalJsonStr(contradictory, &event))
	_, valid, reason = normalizeResponsesUsage(contradictory, event.Response.Usage)
	assert.False(t, valid)
	assert.Equal(t, "usage_counts_inconsistent", reason)

	details := `{"type":"response.completed","response":{"usage":{"input_tokens":1,"output_tokens":1,"total_tokens":2,"input_tokens_details":{"image_tokens":2}}}}`
	require.NoError(t, common.UnmarshalJsonStr(details, &event))
	_, valid, reason = normalizeResponsesUsage(details, event.Response.Usage)
	assert.False(t, valid)
	assert.Equal(t, "usage_input_details_exceed_total", reason)
}

func TestResponsesFallbackEligibleRequiresAllGates(t *testing.T) {
	oldEnabled := constant.ClientGoneFallbackEnabled
	oldCountToken := constant.CountToken
	constant.ClientGoneFallbackEnabled = true
	constant.CountToken = true
	t.Cleanup(func() {
		constant.ClientGoneFallbackEnabled = oldEnabled
		constant.CountToken = oldCountToken
	})

	info := newFallbackTestRelayInfo()
	info.SetEstimatePromptTokens(1)
	observer := newResponsesUsageObserver()
	info.StreamObserver = observer
	info.StreamStatus = relaycommon.NewStreamStatus()
	info.StreamStatus.SetEndReason(relaycommon.StreamEndReasonClientGone, context.Canceled)
	info.StreamStatus.FreezeCutoff()
	assert.True(t, responsesFallbackEligible(info, observer))

	info.RequestURLPath = "/v1/responses?trace=1"
	assert.True(t, responsesFallbackEligible(info, observer), "query parameters do not change the route")

	info.Request = &dto.OpenAIResponsesRequest{Input: []byte(`[{"type":"input_image","image_url":"https://example.com/a.png"}]`)}
	assert.False(t, responsesFallbackEligible(info, observer))

	info.Request = &dto.OpenAIResponsesRequest{Input: []byte(`[{"type":"item_reference","id":"resp_123"}]`), Stream: boolPointer(true)}
	assert.False(t, responsesFallbackEligible(info, observer))

	info.Request = &dto.OpenAIResponsesRequest{Input: []byte(`"hello"`), Tools: []byte(`[{"type":"web_search_preview"}]`), Stream: boolPointer(true)}
	assert.False(t, responsesFallbackEligible(info, observer))

	info.Request = &dto.OpenAIResponsesRequest{Input: []byte(`"hello"`), Tools: []byte(`[{"type":"function","name":"lookup"}]`), Stream: boolPointer(true)}
	assert.True(t, responsesFallbackEligible(info, observer))
}

func TestOaiResponsesStreamHandlerUsesInputFallbackOnlyAfterClientGone(t *testing.T) {
	oldEnabled := constant.ClientGoneFallbackEnabled
	oldCountToken := constant.CountToken
	oldStreamingTimeout := constant.StreamingTimeout
	constant.ClientGoneFallbackEnabled = true
	constant.CountToken = true
	constant.StreamingTimeout = 300
	t.Cleanup(func() {
		constant.ClientGoneFallbackEnabled = oldEnabled
		constant.CountToken = oldCountToken
		constant.StreamingTimeout = oldStreamingTimeout
	})

	requestContext, cancel := context.WithCancel(context.Background())
	cancel()
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil).WithContext(requestContext)
	info := newFallbackTestRelayInfo()
	info.SetEstimatePromptTokens(7)

	usage, newAPIError := OaiResponsesStreamHandler(c, info, &http.Response{Body: io.NopCloser(strings.NewReader(""))})
	require.Nil(t, newAPIError)
	require.NotNil(t, usage)
	assert.Equal(t, 7, usage.PromptTokens)
	assert.Equal(t, 0, usage.CompletionTokens)
	assert.Equal(t, 7, usage.TotalTokens)
	assert.True(t, common.GetContextKeyBool(c, constant.ContextKeyLocalCountTokens))
}

func TestResponsesUsageObserverFreezesObservedOutputAtCutoff(t *testing.T) {
	observer := newResponsesUsageObserver()
	observer.Observe(`{"type":"response.output_text.delta","delta":"hel","item_id":"item-1","content_index":0}`, 1)
	observer.Freeze(1)
	observer.Observe(`{"type":"response.output_text.delta","delta":"lo","item_id":"item-1","content_index":0}`, 2)
	_, output, _, _, uncertain, _, _, _, _, _ := observer.finalize()
	assert.False(t, uncertain)
	assert.Equal(t, "hel", output)
}

func TestResponsesFallbackDoesNotAdmitProviderFailure(t *testing.T) {
	oldEnabled := constant.ClientGoneFallbackEnabled
	oldCountToken := constant.CountToken
	constant.ClientGoneFallbackEnabled = true
	constant.CountToken = true
	t.Cleanup(func() {
		constant.ClientGoneFallbackEnabled = oldEnabled
		constant.CountToken = oldCountToken
	})

	info := newFallbackTestRelayInfo()
	info.SetEstimatePromptTokens(1)
	info.StreamStatus = relaycommon.NewStreamStatus()
	info.StreamStatus.SetEndReason(relaycommon.StreamEndReasonClientGone, context.Canceled)
	info.StreamStatus.FreezeCutoff()
	observer := newResponsesUsageObserver()
	observer.Observe(`{"type":"response.failed"}`, 1)
	observer.Freeze(1)
	assert.False(t, responsesFallbackEligible(info, observer))
}

func TestResponsesUsageObserverAccumulatesRefusalAndPreservesItemOrder(t *testing.T) {
	observer := newResponsesUsageObserver()
	observer.Observe(`{"type":"response.output_text.delta","delta":"A","item_id":"item-10"}`, 1)
	observer.Observe(`{"type":"response.refusal.delta","delta":"B","item_id":"item-2"}`, 2)
	observer.Observe(`{"type":"response.output_text.delta","delta":"C","item_id":"item-10"}`, 3)
	_, output, _, _, uncertain, _, _, _, _, _ := observer.finalize()
	assert.False(t, uncertain)
	assert.Equal(t, "ABC", output)
}

func TestStreamStatusCutoffAndObservationShareOneBoundary(t *testing.T) {
	status := relaycommon.NewStreamStatus()
	observer := newResponsesUsageObserver()
	require.True(t, status.ObserveEvent(observer, `{"type":"response.output_text.delta","delta":"before","item_id":"item-1"}`))
	status.FreezeCutoffWithObserver(observer)
	assert.False(t, status.ObserveEvent(observer, `{"type":"response.output_text.delta","delta":"after","item_id":"item-1"}`))
	_, output, _, _, _, _, _, _, _, _ := observer.finalize()
	assert.Equal(t, "before", output)
}

func TestLegacyResponsesFallbackRemainsAvailableWhenGuardIsDisabled(t *testing.T) {
	info := newFallbackTestRelayInfo()
	info.SetEstimatePromptTokens(4)
	info.UpstreamModelName = "custom-test"
	observer := newResponsesUsageObserver()
	observer.Observe(`{"type":"response.output_text.delta","delta":"hello","item_id":"item-1"}`, 1)
	usage := observer.legacyFallbackUsage(info)
	assert.Equal(t, 4, usage.PromptTokens)
	assert.Positive(t, usage.CompletionTokens)
	assert.Equal(t, usage.PromptTokens+usage.CompletionTokens, usage.TotalTokens)
}

func TestOaiResponsesStreamHandlerPreservesLegacyBillingWhenGuardDisabled(t *testing.T) {
	oldEnabled := constant.ClientGoneFallbackEnabled
	oldStreamingTimeout := constant.StreamingTimeout
	constant.ClientGoneFallbackEnabled = false
	constant.StreamingTimeout = 300
	t.Cleanup(func() {
		constant.ClientGoneFallbackEnabled = oldEnabled
		constant.StreamingTimeout = oldStreamingTimeout
	})

	for _, terminal := range []string{
		`{"type":"response.completed","response":{"usage":{"input_tokens":0,"output_tokens":0,"total_tokens":0}}}`,
		`{"type":"response.failed"}`,
	} {
		t.Run(terminal, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
			info := newFallbackTestRelayInfo()
			info.SetEstimatePromptTokens(4)
			info.UpstreamModelName = "custom-test"
			body := strings.Join([]string{
				`data: {"type":"response.output_text.delta","delta":"hello","item_id":"item-1"}`,
				"data: " + terminal,
				"data: [DONE]",
				"",
			}, "\n")
			usage, apiErr := OaiResponsesStreamHandler(c, info, &http.Response{Body: io.NopCloser(strings.NewReader(body))})
			require.Nil(t, apiErr)
			require.NotNil(t, usage)
			assert.Equal(t, 4, usage.PromptTokens)
			assert.Positive(t, usage.CompletionTokens)
		})
	}
}

func newFallbackTestRelayInfo() *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		IsStream:               true,
		RelayMode:              relayconstant.RelayModeResponses,
		RelayFormat:            types.RelayFormatOpenAIResponses,
		RequestURLPath:         "/v1/responses",
		OriginModelName:        "gpt-test",
		Request:                &dto.OpenAIResponsesRequest{Input: []byte(`"hello"`), Stream: boolPointer(true)},
		RequestConversionChain: []types.RelayFormat{types.RelayFormatOpenAIResponses},
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "gpt-test",
		},
	}
}

func boolPointer(value bool) *bool {
	return &value
}
