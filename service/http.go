package service

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"

	"github.com/gin-gonic/gin"
)

func CloseResponseBodyGracefully(httpResponse *http.Response) {
	if httpResponse == nil || httpResponse.Body == nil {
		return
	}
	err := httpResponse.Body.Close()
	if err != nil {
		common.SysError("failed to close response body: " + err.Error())
	}
}

// ShouldCopyUpstreamHeader checks whether a given upstream response header
// should be copied to the client response. It returns false for Content-Length
// (managed separately) and X-Oneapi-Request-Id (to preserve the local instance
// ID). When the upstream header is X-Oneapi-Request-Id, the value is captured
// into the Gin context for later logging.
func ShouldCopyUpstreamHeader(c *gin.Context, k string, v []string) bool {
	if strings.EqualFold(k, "Content-Length") {
		return false
	}
	if isUpstreamRequestIDHeader(k) {
		if c != nil && len(v) > 0 {
			if c.GetString(common.UpstreamRequestIdKey) == "" {
				c.Set(common.UpstreamRequestIdKey, v[0])
			}
		}
		return false
	}
	return true
}

func isUpstreamRequestIDHeader(name string) bool {
	for _, candidate := range []string{
		common.RequestIdKey,
		"X-Request-Id",
		"Request-Id",
		"X-Amzn-Requestid",
		"X-Goog-Request-Id",
	} {
		if strings.EqualFold(name, candidate) {
			return true
		}
	}
	return false
}

// CaptureUpstreamResponseMetadata keeps provider diagnostics server-side.
// Request IDs are never copied back to clients by ShouldCopyUpstreamHeader.
func CaptureUpstreamResponseMetadata(c *gin.Context, resp *http.Response) {
	if c == nil || resp == nil {
		return
	}
	c.Set(common.UpstreamStatusCodeKey, resp.StatusCode)
	for name, values := range resp.Header {
		if isUpstreamRequestIDHeader(name) && len(values) > 0 && values[0] != "" {
			if c.GetString(common.UpstreamRequestIdKey) == "" {
				c.Set(common.UpstreamRequestIdKey, values[0])
			}
			break
		}
	}
	if retryAfter := resp.Header.Get("Retry-After"); retryAfter != "" {
		c.Set(common.UpstreamRetryAfterKey, retryAfter)
	}
}

func IOCopyBytesGracefully(c *gin.Context, src *http.Response, data []byte) {
	if c.Writer == nil {
		return
	}

	body := io.NopCloser(bytes.NewBuffer(data))

	// We shouldn't set the header before we parse the response body, because the parse part may fail.
	// And then we will have to send an error response, but in this case, the header has already been set.
	// So the httpClient will be confused by the response.
	// For example, Postman will report error, and we cannot check the response at all.
	if src != nil {
		for k, v := range src.Header {
			if !ShouldCopyUpstreamHeader(c, k, v) {
				continue
			}
			c.Writer.Header().Set(k, v[0])
		}
	}

	// set Content-Length header manually BEFORE calling WriteHeader
	c.Writer.Header().Set("Content-Length", fmt.Sprintf("%d", len(data)))

	// Write header with status code (this sends the headers)
	if src != nil {
		c.Writer.WriteHeader(src.StatusCode)
	} else {
		c.Writer.WriteHeader(http.StatusOK)
	}

	_, err := io.Copy(c.Writer, body)
	if err != nil {
		logger.LogError(c, fmt.Sprintf("failed to copy response body: %s", err.Error()))
	}
	c.Writer.Flush()
}
