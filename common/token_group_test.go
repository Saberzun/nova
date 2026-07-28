package common

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNormalizeTokenGroups(t *testing.T) {
	value, err := NormalizeTokenGroups(" gpt-mix-sub, gpt-pro-paygo,gpt-mix-sub ")
	require.NoError(t, err)
	assert.Equal(t, "gpt-mix-sub,gpt-pro-paygo", value)
	assert.Equal(t, []string{"gpt-mix-sub", "gpt-pro-paygo"}, ParseTokenGroups(value))
}

func TestNormalizeTokenGroupsRejectsAutoCombination(t *testing.T) {
	_, err := NormalizeTokenGroups("auto,gpt-pro-paygo")
	require.Error(t, err)
}

func TestNormalizeTokenGroupsLimits(t *testing.T) {
	_, err := NormalizeTokenGroups(strings.Repeat("a", MaxTokenGroupNameLength+1))
	require.Error(t, err)

	groups := make([]string, MaxTokenGroupCount+1)
	for i := range groups {
		groups[i] = strings.Repeat("a", i+1)
	}
	_, err = NormalizeTokenGroups(strings.Join(groups, ","))
	require.Error(t, err)
}
