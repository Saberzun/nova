package controller

import (
	"crypto/sha256"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

const (
	corporateTransferMaxFileBytes    = int64(5 * 1024 * 1024)
	corporateTransferMaxRequestBytes = int64(26 * 1024 * 1024)
)

func corporateTransferStorageRoot() string {
	return common.GetEnvOrDefaultString("CORPORATE_TRANSFER_STORAGE_PATH", "./data/corporate-transfer")
}

func detectCorporateImage(data []byte) (string, string, bool) {
	if len(data) >= 8 && string(data[:8]) == "\x89PNG\r\n\x1a\n" {
		return "image/png", ".png", true
	}
	if len(data) >= 3 && data[0] == 0xff && data[1] == 0xd8 && data[2] == 0xff {
		return "image/jpeg", ".jpg", true
	}
	if len(data) >= 12 && string(data[:4]) == "RIFF" && string(data[8:12]) == "WEBP" {
		return "image/webp", ".webp", true
	}
	return "", "", false
}

type savedCorporateImage struct {
	StorageKey   string
	OriginalName string
	ContentType  string
	ByteSize     int64
	SHA256       string
	Path         string
}

func saveCorporateImage(fileHeader *multipart.FileHeader, namespace string) (*savedCorporateImage, error) {
	if fileHeader == nil || fileHeader.Size <= 0 || fileHeader.Size > corporateTransferMaxFileBytes {
		return nil, errors.New("图片大小必须在 5MB 以内")
	}
	file, err := fileHeader.Open()
	if err != nil {
		return nil, err
	}
	defer file.Close()
	data, err := io.ReadAll(io.LimitReader(file, corporateTransferMaxFileBytes+1))
	if err != nil {
		return nil, err
	}
	if int64(len(data)) > corporateTransferMaxFileBytes {
		return nil, errors.New("图片大小必须在 5MB 以内")
	}
	contentType, extension, ok := detectCorporateImage(data)
	if !ok {
		return nil, errors.New("仅支持 JPEG、PNG 或 WebP 图片")
	}
	storageKey := filepath.Join(namespace, common.GetRandomString(32)+extension)
	root := corporateTransferStorageRoot()
	fullPath := filepath.Join(root, storageKey)
	if err := os.MkdirAll(filepath.Dir(fullPath), 0700); err != nil {
		return nil, err
	}
	if err := os.WriteFile(fullPath, data, 0600); err != nil {
		return nil, err
	}
	digest := fmt.Sprintf("%x", sha256.Sum256(data))
	return &savedCorporateImage{StorageKey: storageKey, OriginalName: filepath.Base(fileHeader.Filename), ContentType: contentType, ByteSize: int64(len(data)), SHA256: digest, Path: fullPath}, nil
}

func removeSavedCorporateImages(images []*savedCorporateImage) {
	for _, image := range images {
		if image != nil {
			_ = os.Remove(image.Path)
		}
	}
}

func serveCorporateImage(c *gin.Context, storageKey string, contentType string, originalName string) {
	cleanKey := filepath.Clean(storageKey)
	if cleanKey == "." || filepath.IsAbs(cleanKey) || strings.HasPrefix(cleanKey, "..") {
		c.Status(http.StatusNotFound)
		return
	}
	path := filepath.Join(corporateTransferStorageRoot(), cleanKey)
	file, err := os.Open(path)
	if err != nil {
		c.Status(http.StatusNotFound)
		return
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil {
		c.Status(http.StatusNotFound)
		return
	}
	c.Header("Content-Type", contentType)
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=%q", filepath.Base(originalName)))
	c.Header("X-Content-Type-Options", "nosniff")
	c.Header("Cache-Control", "private, no-store")
	http.ServeContent(c.Writer, c.Request, filepath.Base(originalName), info.ModTime(), file)
}

type createCorporateTransferRequest struct {
	SKUId             int    `json:"sku_id"`
	Quantity          int    `json:"quantity"`
	AmountMinor       int64  `json:"amount_minor"`
	GiftDiscountCents int64  `json:"gift_discount_cents"`
	PriorOrderNo      string `json:"prior_order_no"`
}

func CreateCorporateTransferOrder(c *gin.Context) {
	var request createCorporateTransferRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiError(c, err)
		return
	}
	if request.Quantity == 0 {
		request.Quantity = 1
	}
	creation, err := model.CreateCorporateTransferOrder(model.CreateCorporateTransferOrderParams{UserId: c.GetInt("id"), SKUId: request.SKUId, Quantity: request.Quantity, RechargeAmountMinor: request.AmountMinor, GiftDiscountCents: request.GiftDiscountCents, IdempotencyKey: c.GetHeader("Idempotency-Key"), PriorOrderNo: request.PriorOrderNo})
	if err != nil {
		if errors.Is(err, model.ErrCorporateCollectionUnavailable) {
			common.ApiErrorMsg(c, "对公转账暂不可用，管理员尚未发布收款信息")
			return
		}
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, creation)
}

func GetCorporateTransferAvailability(c *gin.Context) {
	available, revision, err := model.GetCorporateCollectionAvailability()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"available": available, "revision": revision})
}

func ListCorporateTransferTickets(c *gin.Context) {
	var tickets []model.SupportTicket
	if err := model.DB.Where("user_id = ? AND ticket_type = ?", c.GetInt("id"), model.PaymentProviderCorporateTransfer).Order("updated_at desc, id desc").Find(&tickets).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	items := make([]gin.H, 0, len(tickets))
	for _, ticket := range tickets {
		var application model.CorporateTransferApplication
		if err := model.DB.Select("application_no", "status", "evidence_deadline_at", "user_visible_reason").Where("id = ?", ticket.RelatedApplicationId).First(&application).Error; err != nil {
			common.ApiError(c, err)
			return
		}
		items = append(items, gin.H{"ticket": ticket, "application": application})
	}
	common.ApiSuccess(c, items)
}

func GetCorporateTransferUnreadCount(c *gin.Context) {
	count, err := model.CountUnreadCorporateTransferTickets(c.GetInt("id"), false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"count": count})
}

func corporateTransferTicketDetail(c *gin.Context, admin bool) {
	var ticket model.SupportTicket
	query := model.DB.Where("ticket_no = ? AND ticket_type = ?", c.Param("ticket_no"), model.PaymentProviderCorporateTransfer)
	if !admin {
		query = query.Where("user_id = ?", c.GetInt("id"))
	}
	if err := query.First(&ticket).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	var application model.CorporateTransferApplication
	if err := model.DB.Preload("Order.Items").Where("id = ?", ticket.RelatedApplicationId).First(&application).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	var messages []model.SupportTicketMessage
	messageQuery := model.DB.Preload("Attachments").Where("ticket_id = ? AND hidden = ?", ticket.Id, false)
	if !admin {
		messageQuery = messageQuery.Where("internal = ?", false)
	}
	if err := messageQuery.Order("id asc").Find(&messages).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	var snapshot model.CorporateCollectionSnapshot
	if err := common.UnmarshalJsonStr(application.CollectionSnapshotJSON, &snapshot); err != nil {
		common.ApiError(c, err)
		return
	}
	response := gin.H{"ticket": ticket, "application": application, "messages": messages, "collection": snapshot}
	var collectionState model.CorporateCollectionState
	if err := model.DB.Order("id asc").Limit(1).Find(&collectionState).Error; err == nil {
		response["collection_outdated"] = collectionState.CurrentRevisionId != application.CollectionRevisionId
	}
	if admin {
		var receipts []model.CorporateReceiptVerification
		if err := model.DB.Where("application_id = ?", application.Id).Order("id asc").Find(&receipts).Error; err != nil {
			common.ApiError(c, err)
			return
		}
		response["receipts"] = receipts
	}
	_ = model.MarkCorporateTicketRead(ticket.TicketNo, c.GetInt("id"), admin)
	common.ApiSuccess(c, response)
}

func GetCorporateTransferTicket(c *gin.Context)      { corporateTransferTicketDetail(c, false) }
func AdminGetCorporateTransferTicket(c *gin.Context) { corporateTransferTicketDetail(c, true) }

func UploadCorporateTransferEvidence(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, corporateTransferMaxRequestBytes)
	form, err := c.MultipartForm()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	files := form.File["files"]
	if len(files) == 0 || len(files) > 5 {
		common.ApiErrorMsg(c, "每次必须上传 1 到 5 张支付凭证")
		return
	}
	saved := make([]*savedCorporateImage, 0, len(files))
	attachments := make([]model.SupportTicketAttachment, 0, len(files))
	for _, file := range files {
		image, saveErr := saveCorporateImage(file, "evidence")
		if saveErr != nil {
			removeSavedCorporateImages(saved)
			common.ApiError(c, saveErr)
			return
		}
		saved = append(saved, image)
		attachments = append(attachments, model.SupportTicketAttachment{StorageKey: image.StorageKey, OriginalName: image.OriginalName, ContentType: image.ContentType, ByteSize: image.ByteSize, SHA256: image.SHA256})
	}
	body := ""
	if values := form.Value["message"]; len(values) > 0 {
		body = values[0]
	}
	message, err := model.SubmitCorporateTransferEvidence(c.Param("application_no"), c.GetInt("id"), body, attachments)
	if err != nil {
		removeSavedCorporateImages(saved)
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, message)
}

type ticketReplyRequest struct {
	Body     string `json:"body"`
	Internal bool   `json:"internal"`
}

func appendCorporateTransferReply(c *gin.Context, senderRole string, internal bool) (*model.SupportTicketMessage, error) {
	var body string
	var attachments []model.SupportTicketAttachment
	saved := make([]*savedCorporateImage, 0)
	if strings.HasPrefix(c.ContentType(), "multipart/") {
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, corporateTransferMaxRequestBytes)
		form, err := c.MultipartForm()
		if err != nil {
			return nil, err
		}
		if values := form.Value["body"]; len(values) > 0 {
			body = values[0]
		}
		if values := form.Value["internal"]; len(values) > 0 && senderRole == model.TicketSenderAdmin {
			internal = values[0] == "true"
		}
		files := form.File["files"]
		if len(files) > 5 {
			return nil, errors.New("最多只能附加 5 张图片")
		}
		for _, file := range files {
			image, saveErr := saveCorporateImage(file, "reply")
			if saveErr != nil {
				removeSavedCorporateImages(saved)
				return nil, saveErr
			}
			saved = append(saved, image)
			attachments = append(attachments, model.SupportTicketAttachment{StorageKey: image.StorageKey, OriginalName: image.OriginalName, ContentType: image.ContentType, ByteSize: image.ByteSize, SHA256: image.SHA256})
		}
	} else {
		var request ticketReplyRequest
		if err := c.ShouldBindJSON(&request); err != nil {
			return nil, err
		}
		body = request.Body
		if senderRole == model.TicketSenderAdmin {
			internal = request.Internal
		} else {
			internal = false
		}
	}
	message, err := model.AppendCorporateTransferTicketMessage(c.Param("application_no"), c.GetInt("id"), senderRole, body, internal, attachments)
	if err != nil {
		removeSavedCorporateImages(saved)
		return nil, err
	}
	return message, nil
}

func ReplyCorporateTransferTicket(c *gin.Context) {
	message, err := appendCorporateTransferReply(c, model.TicketSenderUser, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, message)
}

func CancelCorporateTransfer(c *gin.Context) {
	if err := model.CancelCorporateTransfer(c.Param("application_no"), c.GetInt("id"), "cancelled by user before payment"); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func GetCorporateTransferAttachment(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var attachment model.SupportTicketAttachment
	if c.GetInt("role") < common.RoleAdminUser {
		userAttachment, err := model.GetCorporateTransferAttachmentForUser(id, c.GetInt("id"))
		if err != nil {
			c.Status(http.StatusNotFound)
			return
		}
		attachment = *userAttachment
	} else {
		if err := model.DB.Where("id = ? AND purged_at = ?", id, 0).First(&attachment).Error; err != nil {
			c.Status(http.StatusNotFound)
			return
		}
	}
	serveCorporateImage(c, attachment.StorageKey, attachment.ContentType, attachment.OriginalName)
}

func GetCorporateCollectionAsset(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var asset model.CorporateCollectionAsset
	if err := model.DB.Where("id = ?", id).First(&asset).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	if c.GetInt("role") < common.RoleAdminUser {
		var applications []model.CorporateTransferApplication
		if err := model.DB.Select("collection_snapshot_json").Where("user_id = ?", c.GetInt("id")).Find(&applications).Error; err != nil {
			c.Status(http.StatusNotFound)
			return
		}
		authorized := false
		for _, application := range applications {
			var snapshot model.CorporateCollectionSnapshot
			if common.UnmarshalJsonStr(application.CollectionSnapshotJSON, &snapshot) != nil {
				continue
			}
			for _, channel := range snapshot.Channels {
				if channel.QrCodeAttachmentId == id {
					authorized = true
					break
				}
			}
			if authorized {
				break
			}
		}
		if !authorized {
			c.Status(http.StatusNotFound)
			return
		}
	}
	serveCorporateImage(c, asset.StorageKey, asset.ContentType, asset.OriginalName)
}

func AdminListCorporateTransfers(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	query := model.DB.Model(&model.CorporateTransferApplication{})
	if status := strings.TrimSpace(c.Query("status")); status != "" {
		query = query.Where("status = ?", status)
	}
	if keyword := strings.TrimSpace(c.Query("keyword")); keyword != "" {
		pattern := "%" + keyword + "%"
		orderIds := model.DB.Model(&model.ProductOrder{}).Select("id").Where("order_no LIKE ?", pattern)
		applicationIds := model.DB.Model(&model.CorporateReceiptVerification{}).Select("application_id").Where("external_reference LIKE ?", pattern)
		query = query.Where("application_no LIKE ? OR prior_order_no LIKE ? OR order_id IN (?) OR id IN (?)", pattern, pattern, orderIds, applicationIds)
	}
	if userId, _ := strconv.Atoi(c.Query("user_id")); userId > 0 {
		query = query.Where("user_id = ?", userId)
	}
	if channel := strings.TrimSpace(c.Query("channel")); channel != "" {
		applicationIds := model.DB.Model(&model.CorporateReceiptVerification{}).Select("application_id").Where("channel = ?", channel)
		query = query.Where("id IN (?)", applicationIds)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	var applications []model.CorporateTransferApplication
	if err := query.Preload("Order.Items").Preload("Ticket").Order("id desc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&applications).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(applications)
	common.ApiSuccess(c, pageInfo)
}

func AdminReplyCorporateTransferTicket(c *gin.Context) {
	message, err := appendCorporateTransferReply(c, model.TicketSenderAdmin, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "corporate_transfer.ticket_reply", map[string]interface{}{"application_no": c.Param("application_no"), "internal": message.Internal})
	common.ApiSuccess(c, message)
}

func AdminSetCorporateTransferTicketOpen(c *gin.Context) {
	var request struct {
		Open bool `json:"open"`
	}
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.SetCorporateTransferTicketOpen(c.Param("application_no"), c.GetInt("id"), request.Open); err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "corporate_transfer.ticket_state", map[string]interface{}{"application_no": c.Param("application_no"), "open": request.Open})
	common.ApiSuccess(c, nil)
}

type reviewTransitionRequest struct {
	Reason       string `json:"reason"`
	InternalNote string `json:"internal_note"`
}

func AdminRequestCorporateTransferInfo(c *gin.Context) {
	adminTransitionCorporateTransfer(c, model.CorporateTransferNeedsMoreInfo)
}
func AdminRejectCorporateTransfer(c *gin.Context) {
	adminTransitionCorporateTransfer(c, model.CorporateTransferRejected)
}

func adminTransitionCorporateTransfer(c *gin.Context, status string) {
	var request reviewTransitionRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.TransitionCorporateTransferReview(c.Param("application_no"), c.GetInt("id"), status, request.Reason, request.InternalNote); err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "corporate_transfer."+status, map[string]interface{}{"application_no": c.Param("application_no"), "reason": request.Reason})
	common.ApiSuccess(c, nil)
}

func AdminAddCorporateReceipt(c *gin.Context) {
	var receipt model.CorporateReceiptVerification
	if err := c.ShouldBindJSON(&receipt); err != nil {
		common.ApiError(c, err)
		return
	}
	created, err := model.AddCorporateReceipt(c.Param("application_no"), c.GetInt("id"), receipt)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "corporate_transfer.receipt_add", map[string]interface{}{"application_no": c.Param("application_no"), "receipt_id": created.Id, "amount_cents": created.AmountCents})
	common.ApiSuccess(c, created)
}

func AdminVoidCorporateReceipt(c *gin.Context) {
	var request reviewTransitionRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiError(c, err)
		return
	}
	id, _ := strconv.Atoi(c.Param("receipt_id"))
	if err := model.VoidCorporateReceipt(id, c.GetInt("id"), request.Reason); err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "corporate_transfer.receipt_void", map[string]interface{}{"receipt_id": id, "reason": request.Reason})
	common.ApiSuccess(c, nil)
}

func AdminApproveCorporateTransfer(c *gin.Context) {
	if err := model.ApproveCorporateTransfer(c.Param("application_no"), c.GetInt("id")); err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "corporate_transfer.approve", map[string]interface{}{"application_no": c.Param("application_no")})
	common.ApiSuccess(c, nil)
}

func AdminRegisterCorporateTransferRefund(c *gin.Context) {
	var refund model.CorporateTransferRefund
	if err := c.ShouldBindJSON(&refund); err != nil {
		common.ApiError(c, err)
		return
	}
	created, err := model.RegisterCorporateTransferRefund(c.Param("application_no"), c.GetInt("id"), refund)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "corporate_transfer.refund_register", map[string]interface{}{"application_no": c.Param("application_no"), "refund_id": created.Id, "amount_cents": created.AmountCents})
	common.ApiSuccess(c, created)
}

type corporateCollectionRequest struct {
	Channels         []model.CorporateCollectionChannel `json:"channels"`
	ExpectedRevision int                                `json:"expected_revision"`
}

func AdminGetCorporateCollection(c *gin.Context) {
	state, revision, err := model.GetCorporateCollectionConfiguration()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	response := gin.H{"state": state, "published": revision}
	if state.DraftJSON != "" {
		var draft []model.CorporateCollectionChannel
		if common.UnmarshalJsonStr(state.DraftJSON, &draft) == nil {
			response["draft"] = draft
		}
	}
	if revision != nil {
		var snapshot model.CorporateCollectionSnapshot
		if common.UnmarshalJsonStr(revision.SnapshotJSON, &snapshot) == nil {
			response["published_snapshot"] = snapshot
		}
	}
	common.ApiSuccess(c, response)
}

func AdminSaveCorporateCollection(c *gin.Context) {
	var request corporateCollectionRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.SaveCorporateCollectionDraft(request.Channels, c.GetInt("id")); err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "corporate_transfer.collection_draft", nil)
	common.ApiSuccess(c, nil)
}

func AdminPublishCorporateCollection(c *gin.Context) {
	var request corporateCollectionRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiError(c, err)
		return
	}
	revision, err := model.PublishCorporateCollectionDraft(c.GetInt("id"), request.ExpectedRevision)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "corporate_transfer.collection_publish", map[string]interface{}{"revision": revision.Revision})
	common.ApiSuccess(c, revision)
}

func AdminUploadCorporateCollectionAsset(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, corporateTransferMaxFileBytes+1024*1024)
	file, err := c.FormFile("file")
	if err != nil {
		common.ApiError(c, err)
		return
	}
	image, err := saveCorporateImage(file, "collection")
	if err != nil {
		common.ApiError(c, err)
		return
	}
	asset := model.CorporateCollectionAsset{UploaderId: c.GetInt("id"), StorageKey: image.StorageKey, OriginalName: image.OriginalName, ContentType: image.ContentType, ByteSize: image.ByteSize, SHA256: image.SHA256}
	if err := model.DB.Create(&asset).Error; err != nil {
		_ = os.Remove(image.Path)
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "corporate_transfer.collection_asset_upload", map[string]interface{}{"asset_id": asset.Id})
	common.ApiSuccess(c, asset)
}
