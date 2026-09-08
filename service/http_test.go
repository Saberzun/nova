/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

package service

import (
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestCaptureUpstreamResponseMetadataKeepsRequestIDInternal(t *testing.T) {
	c, _ := gin.CreateTestContext(nil)
	resp := &http.Response{StatusCode: http.StatusOK, Header: http.Header{
		"X-Request-Id": []string{"provider-request-id"},
		"Retry-After":  []string{"12"},
	}}

	CaptureUpstreamResponseMetadata(c, resp)

	require.Equal(t, "provider-request-id", c.GetString(common.UpstreamRequestIdKey))
	require.Equal(t, "12", c.GetString(common.UpstreamRetryAfterKey))
	require.Equal(t, http.StatusOK, c.GetInt(common.UpstreamStatusCodeKey))
	require.False(t, ShouldCopyUpstreamHeader(c, "X-Request-Id", []string{"provider-request-id"}))
	require.True(t, ShouldCopyUpstreamHeader(c, "Content-Type", []string{"application/json"}))
}
