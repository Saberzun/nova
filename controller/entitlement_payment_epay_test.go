package controller

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestStoreOrderAmountMatches(t *testing.T) {
	tests := []struct {
		name             string
		totalAmountMinor int64
		paidAmount       string
		matches          bool
	}{
		{name: "exact cents", totalAmountMinor: 1234, paidAmount: "12.34", matches: true},
		{name: "equivalent decimal format", totalAmountMinor: 1000, paidAmount: "10.0", matches: true},
		{name: "underpayment", totalAmountMinor: 1000, paidAmount: "9.99", matches: false},
		{name: "invalid amount", totalAmountMinor: 1000, paidAmount: "invalid", matches: false},
		{name: "free order", totalAmountMinor: 0, paidAmount: "0.00", matches: false},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			assert.Equal(t, test.matches, storeOrderAmountMatches(test.totalAmountMinor, test.paidAmount))
		})
	}
}
