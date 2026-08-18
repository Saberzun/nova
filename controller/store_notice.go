package controller

import (
	"errors"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

type storeNoticeDismissRequest struct {
	Revision int64 `json:"revision"`
}

type storeNoticeDraftRequest struct {
	Content              string `json:"content"`
	ExpectedDraftVersion int64  `json:"expected_draft_version"`
}

type storeNoticePublishRequest struct {
	ExpectedRevision     int64 `json:"expected_revision"`
	ExpectedDraftVersion int64 `json:"expected_draft_version"`
}

func GetStoreNotice(c *gin.Context) {
	notice, err := model.GetStoreNoticeForUser(c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, notice)
}

func DismissStoreNotice(c *gin.Context) {
	var request storeNoticeDismissRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.DismissStoreNotice(c.GetInt("id"), request.Revision); err != nil {
		common.ApiErrorMsg(c, storeNoticeErrorMessage(err))
		return
	}
	common.ApiSuccess(c, nil)
}

func AdminGetStoreNotice(c *gin.Context) {
	notice, err := model.GetStoreNoticeAdmin()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, notice)
}

func AdminSaveStoreNoticeDraft(c *gin.Context) {
	var request storeNoticeDraftRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiError(c, err)
		return
	}
	notice, err := model.SaveStoreNoticeDraft(c.GetInt("id"), request.Content, request.ExpectedDraftVersion)
	if err != nil {
		common.ApiErrorMsg(c, storeNoticeErrorMessage(err))
		return
	}
	recordManageAudit(c, "store.notice_draft_update", map[string]interface{}{
		"draft_version": notice.DraftVersion,
	})
	common.ApiSuccess(c, notice)
}

func AdminPublishStoreNotice(c *gin.Context) {
	var request storeNoticePublishRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiError(c, err)
		return
	}
	revision, err := model.PublishStoreNotice(c.GetInt("id"), request.ExpectedRevision, request.ExpectedDraftVersion)
	if err != nil {
		common.ApiErrorMsg(c, storeNoticeErrorMessage(err))
		return
	}
	recordManageAudit(c, "store.notice_publish", map[string]interface{}{
		"revision": revision.Revision, "content_hash": revision.ContentHash,
	})
	common.ApiSuccess(c, revision)
}

func storeNoticeErrorMessage(err error) string {
	switch {
	case errors.Is(err, model.ErrStoreNoticeConflict):
		return "商城须知已被其他管理员修改，请刷新后重试"
	case errors.Is(err, model.ErrStoreNoticeNotPublished):
		return "商城须知尚未发布"
	case errors.Is(err, model.ErrStoreNoticeRevisionStale):
		return "商城须知已更新，请查看最新内容"
	case errors.Is(err, model.ErrStoreNoticeContentEmpty):
		return "商城须知内容不能为空"
	case errors.Is(err, model.ErrStoreNoticeContentTooLong):
		return "商城须知内容不能超过 5000 个字符"
	case errors.Is(err, model.ErrStoreNoticeUnsafeContent):
		return "商城须知不支持原始 HTML 或嵌入式媒体"
	default:
		return err.Error()
	}
}
