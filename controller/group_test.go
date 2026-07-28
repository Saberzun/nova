package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func TestResolveGroupSelectionState(t *testing.T) {
	tests := []struct {
		name                  string
		policyTableAvailable  bool
		policyConfigured      bool
		fundingType           string
		inUserUsableGroups    bool
		hasEntitlementQuota   bool
		userQuota             int
		wantSelectable        bool
		wantUnavailableReason string
	}{
		{
			name:                 "configured subscription with quota",
			policyTableAvailable: true,
			policyConfigured:     true,
			fundingType:          model.EntitlementAssetSubscription,
			hasEntitlementQuota:  true,
			wantSelectable:       true,
		},
		{
			name:                  "configured subscription without quota",
			policyTableAvailable:  true,
			policyConfigured:      true,
			fundingType:           model.EntitlementAssetSubscription,
			wantUnavailableReason: groupUnavailableQuota,
		},
		{
			name:                  "configured stored value without quota",
			policyTableAvailable:  true,
			policyConfigured:      true,
			fundingType:           model.EntitlementAssetStoredValue,
			wantUnavailableReason: groupUnavailableQuota,
		},
		{
			name:                 "configured system wallet with balance",
			policyTableAvailable: true,
			policyConfigured:     true,
			fundingType:          model.EntitlementAssetSystemWallet,
			inUserUsableGroups:   true,
			userQuota:            100,
			wantSelectable:       true,
		},
		{
			name:                  "configured system wallet without balance",
			policyTableAvailable:  true,
			policyConfigured:      true,
			fundingType:           model.EntitlementAssetSystemWallet,
			inUserUsableGroups:    true,
			wantUnavailableReason: groupUnavailableQuota,
		},
		{
			name:                  "missing policy is visible but unavailable",
			policyTableAvailable:  true,
			inUserUsableGroups:    true,
			userQuota:             100,
			wantUnavailableReason: groupUnavailableFundingSource,
		},
		{
			name:               "rolling upgrade keeps legacy group usable",
			inUserUsableGroups: true,
			userQuota:          100,
			wantSelectable:     true,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			selectable, reason := resolveGroupSelectionState(
				test.policyTableAvailable,
				test.policyConfigured,
				test.fundingType,
				test.inUserUsableGroups,
				test.hasEntitlementQuota,
				test.userQuota,
			)
			require.Equal(t, test.wantSelectable, selectable)
			require.Equal(t, test.wantUnavailableReason, reason)
		})
	}
}
