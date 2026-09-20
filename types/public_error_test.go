/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

package types

import (
	"context"
	"errors"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestProjectUpstreamErrorHidesProviderAccountDetails(t *testing.T) {
	original := WithOpenAIError(OpenAIError{
		Message: "余额不足或低于网关最低可用余额，请充值后再试",
		Type:    "insufficient_balance",
		Code:    "billing_hard_limit_reached",
	}, http.StatusPaymentRequired)

	publicErr := ProjectUpstreamError(original)

	require.Equal(t, http.StatusBadGateway, publicErr.StatusCode)
	require.Equal(t, ErrorCodeUpstreamServiceError, publicErr.GetErrorCode())
	require.Equal(t, "上游服务异常，请稍后重试", publicErr.Error())
	require.Equal(t, "余额不足或低于网关最低可用余额，请充值后再试", original.Error(), "projection must not mutate the internal error")
}

func TestSetMessageUpdatesProtocolErrorBody(t *testing.T) {
	projected := ProjectUpstreamError(NewOpenAIError(errors.New("provider secret"), "unknown", http.StatusBadGateway))
	projected.SetMessage("上游服务异常，请稍后重试 (request id: local-id)")

	require.Equal(t, "上游服务异常，请稍后重试 (request id: local-id)", projected.ToOpenAIError().Message)
}

func TestProjectUpstreamErrorUsesObservedStatusBeforeChannelMapping(t *testing.T) {
	original := NewOpenAIError(errors.New("provider limit"), "unknown", http.StatusBadRequest)

	projected := ProjectUpstreamErrorWithStatus(original, http.StatusTooManyRequests)

	require.Equal(t, http.StatusTooManyRequests, projected.StatusCode)
	require.Equal(t, ErrorCodeUpstreamRateLimited, projected.GetErrorCode())
}

func TestProjectUpstreamLegalRestrictionUsesObservedStatusBeforeChannelMapping(t *testing.T) {
	original := NewOpenAIError(errors.New("provider legal restriction"), "invalid_request_body", http.StatusBadRequest)

	projected := ProjectUpstreamErrorWithStatus(original, http.StatusUnavailableForLegalReasons)

	require.Equal(t, http.StatusUnavailableForLegalReasons, projected.StatusCode)
	require.Equal(t, ErrorCodeUpstreamLegalRestriction, projected.GetErrorCode())
	require.Equal(t, "请求因法律或地区合规限制无法处理", projected.Error())
}

func TestProjectUpstreamErrorKeepsOnlySafeRetrySemantics(t *testing.T) {
	testCases := []struct {
		name        string
		errorCode   ErrorCode
		statusCode  int
		message     string
		wantCode    ErrorCode
		wantStatus  int
		wantMessage string
	}{
		{
			name:        "legal restriction",
			errorCode:   "provider_policy",
			statusCode:  http.StatusUnavailableForLegalReasons,
			message:     "blocked in region by secret provider policy",
			wantCode:    ErrorCodeUpstreamLegalRestriction,
			wantStatus:  http.StatusUnavailableForLegalReasons,
			wantMessage: "请求因法律或地区合规限制无法处理",
		},
		{
			name:        "rate limit",
			errorCode:   "rate_limit_exceeded",
			statusCode:  http.StatusTooManyRequests,
			message:     "provider pool exhausted",
			wantCode:    ErrorCodeUpstreamRateLimited,
			wantStatus:  http.StatusTooManyRequests,
			wantMessage: "上游服务繁忙，请稍后重试",
		},
		{
			name:        "timeout",
			errorCode:   ErrorCodeDoRequestFailed,
			statusCode:  http.StatusGatewayTimeout,
			message:     "upstream timed out at secret-provider.example",
			wantCode:    ErrorCodeUpstreamTimeout,
			wantStatus:  http.StatusGatewayTimeout,
			wantMessage: "上游服务响应超时，请稍后重试",
		},
		{
			name:        "transport timeout",
			errorCode:   ErrorCodeDoRequestFailed,
			statusCode:  http.StatusInternalServerError,
			message:     context.DeadlineExceeded.Error(),
			wantCode:    ErrorCodeUpstreamTimeout,
			wantStatus:  http.StatusGatewayTimeout,
			wantMessage: "上游服务响应超时，请稍后重试",
		},
		{
			name:        "context length",
			errorCode:   "context_length_exceeded",
			statusCode:  http.StatusBadRequest,
			message:     "vendor model context window is 12345",
			wantCode:    ErrorCodeInvalidModelRequest,
			wantStatus:  http.StatusBadRequest,
			wantMessage: "请求不符合模型要求",
		},
		{
			name:        "content policy",
			errorCode:   "content_policy_violation",
			statusCode:  http.StatusBadRequest,
			message:     "provider moderation policy name",
			wantCode:    ErrorCodeContentPolicyRejected,
			wantStatus:  http.StatusBadRequest,
			wantMessage: "请求内容未通过安全检查",
		},
		{
			name:        "unknown bad request is denied by default",
			errorCode:   "invalid_request_error",
			statusCode:  http.StatusBadRequest,
			message:     "account route secret",
			wantCode:    ErrorCodeUpstreamServiceError,
			wantStatus:  http.StatusBadGateway,
			wantMessage: "上游服务异常，请稍后重试",
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			originalError := errors.New(testCase.message)
			var original *NewAPIError
			if testCase.name == "transport timeout" {
				original = NewErrorWithStatusCode(context.DeadlineExceeded, testCase.errorCode, testCase.statusCode)
			} else {
				original = NewOpenAIError(originalError, testCase.errorCode, testCase.statusCode)
			}

			publicErr := ProjectUpstreamError(original)

			require.Equal(t, testCase.wantStatus, publicErr.StatusCode)
			require.Equal(t, testCase.wantCode, publicErr.GetErrorCode())
			require.Equal(t, testCase.wantMessage, publicErr.Error())
		})
	}
}

func TestSanitizeUpstreamStreamPayloadDropsProviderDetails(t *testing.T) {
	payload := `{"type":"error","error":{"message":"balance=0 at secret-provider","type":"billing_error","code":"insufficient_balance","metadata":{"provider":"secret"}},"request_id":"upstream-id"}`

	got, sanitized := SanitizeUpstreamStreamPayload(payload, "local-request-id")

	require.True(t, sanitized)
	require.JSONEq(t, `{
		"type":"error",
		"error":{
			"message":"上游服务异常，请稍后重试 (request id: local-request-id)",
			"type":"upstream_error",
			"code":"upstream_service_error"
		}
	}`, got)
	require.NotContains(t, got, "secret-provider")
	require.NotContains(t, got, "upstream-id")
}

func TestSanitizeUpstreamStreamPayloadLeavesNormalChunksAlone(t *testing.T) {
	payload := `{"id":"chatcmpl-1","choices":[{"delta":{"content":"hello"}}]}`

	got, sanitized := SanitizeUpstreamStreamPayload(payload, "local-request-id")

	require.False(t, sanitized)
	require.Equal(t, payload, got)
}
