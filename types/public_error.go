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
	"fmt"
	"net"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

const (
	publicInvalidModelRequestMessage = "请求不符合模型要求"
	publicContentPolicyMessage       = "请求内容未通过安全检查"
	publicUpstreamRateLimitedMessage = "上游服务繁忙，请稍后重试"
	publicUpstreamTimeoutMessage     = "上游服务响应超时，请稍后重试"
	publicUpstreamServiceMessage     = "上游服务异常，请稍后重试"
)

var safeUpstreamRequestErrorCodes = map[ErrorCode]struct{}{
	"context_length_exceeded": {},
	"invalid_parameter":       {},
	"invalid_request_body":    {},
	"max_tokens_exceeded":     {},
	"unsupported_parameter":   {},
}

var safeUpstreamContentErrorCodes = map[ErrorCode]struct{}{
	"content_filter":              {},
	"content_policy_violation":    {},
	"moderation_blocked":          {},
	"prompt_blocked":              {},
	ErrorCodeViolationFeeGrokCSAM: {},
}

// ProjectUpstreamError returns a provider-neutral error suitable for clients.
// The original error remains untouched for retry, billing, channel health and
// administrator diagnostics. Unknown upstream failures are denied by default.
func ProjectUpstreamError(original *NewAPIError) *NewAPIError {
	return ProjectUpstreamErrorWithStatus(original, 0)
}

// ProjectUpstreamErrorWithStatus accepts the status observed directly from
// the provider, before any administrator-configured status-code mapping.
func ProjectUpstreamErrorWithStatus(original *NewAPIError, upstreamStatusCode int) *NewAPIError {
	if original == nil {
		return nil
	}
	if upstreamStatusCode == 0 {
		upstreamStatusCode = original.StatusCode
	}

	statusCode := http.StatusBadGateway
	publicCode := ErrorCodeUpstreamServiceError
	message := publicUpstreamServiceMessage

	if _, ok := safeUpstreamRequestErrorCodes[original.GetErrorCode()]; ok {
		statusCode = http.StatusBadRequest
		publicCode = ErrorCodeInvalidModelRequest
		message = publicInvalidModelRequestMessage
	} else if _, ok := safeUpstreamContentErrorCodes[original.GetErrorCode()]; ok {
		statusCode = http.StatusBadRequest
		publicCode = ErrorCodeContentPolicyRejected
		message = publicContentPolicyMessage
	} else if upstreamStatusCode == http.StatusTooManyRequests || original.GetErrorCode() == "rate_limit_exceeded" {
		statusCode = http.StatusTooManyRequests
		publicCode = ErrorCodeUpstreamRateLimited
		message = publicUpstreamRateLimitedMessage
	} else if isUpstreamTimeout(original, upstreamStatusCode) {
		statusCode = http.StatusGatewayTimeout
		publicCode = ErrorCodeUpstreamTimeout
		message = publicUpstreamTimeoutMessage
	}

	return WithOpenAIError(OpenAIError{
		Message: message,
		Type:    "upstream_error",
		Code:    string(publicCode),
	}, statusCode, ErrOptionWithSkipRetry())
}

func isUpstreamTimeout(original *NewAPIError, upstreamStatusCode int) bool {
	if upstreamStatusCode == http.StatusGatewayTimeout || errors.Is(original, context.DeadlineExceeded) {
		return true
	}
	var networkError net.Error
	return errors.As(original, &networkError) && networkError.Timeout()
}

// SanitizeUpstreamStreamPayload rewrites only JSON error events. Successful
// chunks are returned byte-for-byte so streaming compatibility is unaffected.
func SanitizeUpstreamStreamPayload(data string, requestID string) (string, bool) {
	trimmed := strings.TrimSpace(data)
	if trimmed == "" || trimmed == "[DONE]" || !strings.HasPrefix(trimmed, "{") {
		return data, false
	}

	var payload map[string]interface{}
	if err := common.UnmarshalJsonStr(trimmed, &payload); err != nil {
		return data, false
	}

	errorMap, envelope := findStreamError(payload)
	if errorMap == nil {
		return data, false
	}

	errorCode := ErrorCode(stringValue(errorMap["code"]))
	projected := ProjectUpstreamError(NewOpenAIError(errors.New("upstream stream error"), errorCode, 0))
	safeError := map[string]interface{}{
		"message": common.MessageWithRequestId(projected.Error(), requestID),
		"type":    "upstream_error",
		"code":    projected.GetErrorCode(),
	}

	var safePayload map[string]interface{}
	switch envelope {
	case "response":
		safePayload = map[string]interface{}{
			"type": "response.failed",
			"response": map[string]interface{}{
				"status": "failed",
				"error":  safeError,
			},
		}
	case "top-level":
		safePayload = map[string]interface{}{
			"type":    "error",
			"message": safeError["message"],
			"code":    safeError["code"],
		}
	default:
		safePayload = map[string]interface{}{"error": safeError}
		if payloadType, ok := payload["type"].(string); ok && payloadType == "error" {
			safePayload["type"] = "error"
		}
	}
	if sequenceNumber, ok := payload["sequence_number"]; ok {
		safePayload["sequence_number"] = sequenceNumber
	}

	encoded, err := common.Marshal(safePayload)
	if err != nil {
		return data, false
	}
	return string(encoded), true
}

func findStreamError(payload map[string]interface{}) (map[string]interface{}, string) {
	if errorMap, ok := payload["error"].(map[string]interface{}); ok {
		return errorMap, "error"
	}
	if response, ok := payload["response"].(map[string]interface{}); ok {
		if errorMap, ok := response["error"].(map[string]interface{}); ok {
			return errorMap, "response"
		}
	}
	if payloadType, _ := payload["type"].(string); payloadType == "error" {
		if _, hasMessage := payload["message"]; hasMessage {
			return payload, "top-level"
		}
	}
	return nil, ""
}

func stringValue(value interface{}) string {
	if value == nil {
		return ""
	}
	return fmt.Sprint(value)
}
