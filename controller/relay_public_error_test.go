/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

package controller

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestRespondTaskErrorFiltersOnlyUpstreamErrors(t *testing.T) {
	t.Run("upstream error is provider neutral", func(t *testing.T) {
		recorder := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(recorder)
		c.Set(common.RequestIdKey, "local-request-id")

		respondTaskError(c, &dto.TaskError{
			Code:       "insufficient_balance",
			Message:    "provider account balance is zero",
			StatusCode: http.StatusPaymentRequired,
			Error:      errors.New("provider account balance is zero"),
		}, true)

		require.Equal(t, http.StatusBadGateway, recorder.Code)
		require.Contains(t, recorder.Body.String(), "upstream_service_error")
		require.Contains(t, recorder.Body.String(), "local-request-id")
		require.NotContains(t, recorder.Body.String(), "provider account")
	})

	t.Run("local error remains unchanged", func(t *testing.T) {
		recorder := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(recorder)

		respondTaskError(c, &dto.TaskError{
			Code:       "access_denied",
			Message:    "本地权限不足",
			StatusCode: http.StatusForbidden,
			LocalError: true,
			Error:      errors.New("本地权限不足"),
		}, false)

		require.Equal(t, http.StatusForbidden, recorder.Code)
		require.Contains(t, recorder.Body.String(), "本地权限不足")
	})
}
