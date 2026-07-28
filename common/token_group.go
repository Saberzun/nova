package common

import (
	"errors"
	"strings"
)

const (
	MaxTokenGroupCount      = 32
	MaxTokenGroupNameLength = 64
)

// ParseTokenGroups returns the ordered, de-duplicated groups stored in a token's
// legacy group field. A single group remains fully backward compatible, while
// multiple explicit groups are stored as a canonical comma-separated value.
func ParseTokenGroups(value string) []string {
	parts := strings.Split(value, ",")
	groups := make([]string, 0, len(parts))
	seen := make(map[string]struct{}, len(parts))
	for _, part := range parts {
		group := strings.TrimSpace(part)
		if group == "" {
			continue
		}
		if _, exists := seen[group]; exists {
			continue
		}
		seen[group] = struct{}{}
		groups = append(groups, group)
	}
	return groups
}

func NormalizeTokenGroups(value string) (string, error) {
	groups := ParseTokenGroups(value)
	if len(groups) > MaxTokenGroupCount {
		return "", errors.New("API Key 最多可选择 32 个分组")
	}

	hasAuto := false
	for _, group := range groups {
		if len(group) > MaxTokenGroupNameLength {
			return "", errors.New("API Key 分组名称长度不能超过 64 个字符")
		}
		if group == "auto" {
			hasAuto = true
		}
	}
	if hasAuto && len(groups) > 1 {
		return "", errors.New("自动分组不能与其他分组同时选择")
	}
	return strings.Join(groups, ","), nil
}

func IsMultiTokenGroup(value string) bool {
	return len(ParseTokenGroups(value)) > 1
}
