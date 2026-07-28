package controller

import (
	"net/http"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
)

const (
	groupUnavailableFundingSource = "该分组未配置资金来源"
	groupUnavailableQuota         = "暂无可消费额度"
	groupUnavailablePermission    = "当前账户无权使用该分组"
)

func resolveGroupSelectionState(
	policyTableAvailable bool,
	policyConfigured bool,
	fundingType string,
	inUserUsableGroups bool,
	hasEntitlementQuota bool,
	userQuota int,
) (bool, string) {
	if !policyTableAvailable {
		if inUserUsableGroups && userQuota > 0 {
			return true, ""
		}
		if !inUserUsableGroups {
			return false, groupUnavailablePermission
		}
		return false, groupUnavailableQuota
	}
	if !policyConfigured {
		return false, groupUnavailableFundingSource
	}
	switch fundingType {
	case model.EntitlementAssetSubscription, model.EntitlementAssetStoredValue:
		if hasEntitlementQuota {
			return true, ""
		}
		return false, groupUnavailableQuota
	case model.EntitlementAssetSystemWallet:
		if !inUserUsableGroups {
			return false, groupUnavailablePermission
		}
		if userQuota <= 0 {
			return false, groupUnavailableQuota
		}
		return true, ""
	default:
		return false, groupUnavailableFundingSource
	}
}

func GetGroups(c *gin.Context) {
	groupNames := make([]string, 0)
	for groupName := range ratio_setting.GetGroupRatioCopy() {
		groupNames = append(groupNames, groupName)
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    groupNames,
	})
}

func GetUserGroups(c *gin.Context) {
	usableGroups := make(map[string]map[string]interface{})
	userGroup := ""
	userId := c.GetInt("id")
	userGroup, _ = model.GetUserGroup(userId, false)
	userQuota, quotaErr := model.GetUserQuota(userId, false)
	if quotaErr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": quotaErr.Error()})
		return
	}
	userUsableGroups := service.GetUserUsableGroups(userGroup)
	entitlementGroups, entitlementErr := model.GetUserEntitlementGroups(userId)
	if entitlementErr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": entitlementErr.Error()})
		return
	}
	entitlementGroupSet := make(map[string]struct{}, len(entitlementGroups))
	for _, groupName := range entitlementGroups {
		entitlementGroupSet[groupName] = struct{}{}
	}
	policyTableAvailable := model.AccessGroupPolicyTableAvailable()
	hasSelectableGroup := false
	for groupName := range ratio_setting.GetGroupRatioCopy() {
		if groupName == "auto" {
			continue
		}
		fundingType, policyConfigured, policyErr := model.GetAccessGroupFundingType(groupName)
		if policyErr != nil {
			continue
		}
		desc, inUserUsableGroups := userUsableGroups[groupName]
		if desc == "" {
			desc = setting.GetUsableGroupDescription(groupName)
		}
		_, hasEntitlementQuota := entitlementGroupSet[groupName]
		selectable, unavailableReason := resolveGroupSelectionState(
			policyTableAvailable,
			policyConfigured,
			fundingType,
			inUserUsableGroups,
			hasEntitlementQuota,
			userQuota,
		)
		groupData := map[string]interface{}{
			"ratio":              service.GetUserGroupRatio(userGroup, groupName),
			"desc":               desc,
			"selectable":         selectable,
			"unavailable_reason": unavailableReason,
		}
		if fundingType != "" {
			groupData["funding_type"] = fundingType
		}
		usableGroups[groupName] = groupData
		if selectable {
			hasSelectableGroup = true
		}
	}
	if _, ok := userUsableGroups["auto"]; ok {
		unavailableReason := ""
		if !hasSelectableGroup {
			unavailableReason = groupUnavailableQuota
		}
		usableGroups["auto"] = map[string]interface{}{
			"ratio":              "自动",
			"desc":               setting.GetUsableGroupDescription("auto"),
			"selectable":         hasSelectableGroup,
			"unavailable_reason": unavailableReason,
		}
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    usableGroups,
	})
}
