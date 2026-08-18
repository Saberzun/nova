package controller

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestNormalizeAPIBaseURL(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		input     string
		expected  string
		wantError bool
	}{
		{name: "https", input: "https://api.itokenify.com/", expected: "https://api.itokenify.com"},
		{name: "http", input: " http://localhost:3000/// ", expected: "http://localhost:3000"},
		{name: "missing scheme", input: "api.itokenify.com", wantError: true},
		{name: "unsupported scheme", input: "ftp://api.itokenify.com", wantError: true},
		{name: "missing host", input: "https:///v1", wantError: true},
		{name: "query", input: "https://api.itokenify.com?key=value", wantError: true},
		{name: "fragment", input: "https://api.itokenify.com#v1", wantError: true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			actual, err := normalizeAPIBaseURL(test.input)
			if test.wantError {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			require.Equal(t, test.expected, actual)
		})
	}
}
