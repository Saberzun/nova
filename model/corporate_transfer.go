package model

import (
	"crypto/sha256"
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

const (
	PaymentProviderCorporateTransfer = "corporate_transfer"
	PaymentMethodCorporateTransfer   = "corporate_transfer"

	CorporateChannelEnterpriseWechat = "enterprise_wechat"
	CorporateChannelBank             = "corporate_bank"

	CorporateTransferAwaitingEvidence = "awaiting_evidence"
	CorporateTransferUnderReview      = "under_review"
	CorporateTransferNeedsMoreInfo    = "needs_more_information"
	CorporateTransferApproved         = "approved"
	CorporateTransferFulfilled        = "fulfilled"
	CorporateTransferCancelled        = "cancelled"
	CorporateTransferExpired          = "expired"
	CorporateTransferRejected         = "rejected"

	CorporateTransferEvidenceTimeout = int64(24 * 60 * 60)

	TicketStatusOpen   = "open"
	TicketStatusClosed = "closed"

	TicketSenderUser   = "user"
	TicketSenderAdmin  = "admin"
	TicketSenderSystem = "system"

	TicketAttachmentKindPaymentEvidence = "payment_evidence"
	TicketAttachmentKindReply           = "reply"
)

var (
	ErrCorporateCollectionUnavailable = errors.New("corporate transfer collection information is unavailable")
	ErrCorporateTransferConflict      = errors.New("corporate transfer idempotency conflict")
	ErrCorporateTransferNotApprovable = errors.New("corporate transfer is not approvable")
)

type CorporateCollectionChannel struct {
	ChannelType        string `json:"channel_type"`
	Enabled            bool   `json:"enabled"`
	DisplayName        string `json:"display_name"`
	OrganizationName   string `json:"organization_name"`
	QrCodeAttachmentId int    `json:"qr_code_attachment_id,omitempty"`
	AccountName        string `json:"account_name,omitempty"`
	BankName           string `json:"bank_name,omitempty"`
	BankAccount        string `json:"bank_account,omitempty"`
	BankBranch         string `json:"bank_branch,omitempty"`
	Instructions       string `json:"instructions,omitempty"`
}

type CorporateCollectionSnapshot struct {
	Revision int                          `json:"revision"`
	Channels []CorporateCollectionChannel `json:"channels"`
}

type CorporateCollectionState struct {
	Id                int    `json:"id"`
	DraftJSON         string `json:"draft_json" gorm:"type:text"`
	CurrentRevisionId int    `json:"current_revision_id" gorm:"index"`
	CurrentRevision   int    `json:"current_revision"`
	UpdatedBy         int    `json:"updated_by" gorm:"index"`
	UpdatedAt         int64  `json:"updated_at" gorm:"bigint"`
}

type CorporateCollectionRevision struct {
	Id           int    `json:"id"`
	Revision     int    `json:"revision" gorm:"uniqueIndex;not null"`
	SnapshotJSON string `json:"snapshot_json" gorm:"type:text;not null"`
	Digest       string `json:"digest" gorm:"type:char(64);not null"`
	PublishedBy  int    `json:"published_by" gorm:"index;not null"`
	PublishedAt  int64  `json:"published_at" gorm:"bigint;index"`
}

type CorporateCollectionAsset struct {
	Id           int    `json:"id"`
	UploaderId   int    `json:"uploader_id" gorm:"index;not null"`
	StorageKey   string `json:"-" gorm:"type:varchar(255);uniqueIndex;not null"`
	OriginalName string `json:"original_name" gorm:"type:varchar(255);not null"`
	ContentType  string `json:"content_type" gorm:"type:varchar(64);not null"`
	ByteSize     int64  `json:"byte_size" gorm:"bigint;not null"`
	SHA256       string `json:"sha256" gorm:"type:char(64);not null"`
	CreatedAt    int64  `json:"created_at" gorm:"bigint;index"`
}

type CorporateTransferApplication struct {
	Id                     int           `json:"id"`
	ApplicationNo          string        `json:"application_no" gorm:"type:varchar(64);uniqueIndex;not null"`
	OrderId                int           `json:"order_id" gorm:"uniqueIndex;not null"`
	TicketId               int           `json:"ticket_id" gorm:"uniqueIndex;not null"`
	UserId                 int           `json:"user_id" gorm:"index;not null"`
	Status                 string        `json:"status" gorm:"type:varchar(32);index;not null"`
	CollectionRevisionId   int           `json:"collection_revision_id" gorm:"index;not null"`
	CollectionSnapshotJSON string        `json:"collection_snapshot_json" gorm:"type:text;not null"`
	EvidenceDeadlineAt     int64         `json:"evidence_deadline_at" gorm:"bigint;index"`
	EvidenceSubmittedAt    int64         `json:"evidence_submitted_at" gorm:"bigint"`
	ReviewerId             int           `json:"reviewer_id" gorm:"index"`
	ReviewedAt             int64         `json:"reviewed_at" gorm:"bigint"`
	ApprovedAt             int64         `json:"approved_at" gorm:"bigint"`
	FulfilledAt            int64         `json:"fulfilled_at" gorm:"bigint"`
	UserVisibleReason      string        `json:"user_visible_reason" gorm:"type:text"`
	InternalNote           string        `json:"-" gorm:"type:text"`
	PriorOrderNo           string        `json:"prior_order_no" gorm:"type:varchar(64)"`
	Version                int           `json:"version" gorm:"not null"`
	CreatedAt              int64         `json:"created_at" gorm:"bigint;index"`
	UpdatedAt              int64         `json:"updated_at" gorm:"bigint"`
	Order                  ProductOrder  `json:"order,omitempty" gorm:"foreignKey:OrderId"`
	Ticket                 SupportTicket `json:"ticket,omitempty" gorm:"foreignKey:TicketId"`
}

type SupportTicket struct {
	Id                     int    `json:"id"`
	TicketNo               string `json:"ticket_no" gorm:"type:varchar(64);uniqueIndex;not null"`
	UserId                 int    `json:"user_id" gorm:"index;not null"`
	TicketType             string `json:"ticket_type" gorm:"type:varchar(32);index;not null"`
	Subject                string `json:"subject" gorm:"type:varchar(255);not null"`
	Status                 string `json:"status" gorm:"type:varchar(32);index;not null"`
	RelatedOrderId         int    `json:"related_order_id" gorm:"index"`
	RelatedApplicationId   int    `json:"related_application_id" gorm:"index"`
	LastUserReadMessageId  int    `json:"last_user_read_message_id"`
	LastAdminReadMessageId int    `json:"last_admin_read_message_id"`
	ClosedAt               int64  `json:"closed_at" gorm:"bigint"`
	CreatedAt              int64  `json:"created_at" gorm:"bigint;index"`
	UpdatedAt              int64  `json:"updated_at" gorm:"bigint;index"`
}

type SupportTicketMessage struct {
	Id           int                       `json:"id"`
	TicketId     int                       `json:"ticket_id" gorm:"index;not null"`
	SenderUserId int                       `json:"sender_user_id" gorm:"index"`
	SenderRole   string                    `json:"sender_role" gorm:"type:varchar(16);index;not null"`
	Body         string                    `json:"body" gorm:"type:text"`
	Internal     bool                      `json:"internal" gorm:"index"`
	Hidden       bool                      `json:"hidden" gorm:"index"`
	HiddenReason string                    `json:"-" gorm:"type:text"`
	CreatedAt    int64                     `json:"created_at" gorm:"bigint;index"`
	Attachments  []SupportTicketAttachment `json:"attachments,omitempty" gorm:"foreignKey:MessageId"`
}

type SupportTicketAttachment struct {
	Id           int    `json:"id"`
	TicketId     int    `json:"ticket_id" gorm:"index;not null"`
	MessageId    int    `json:"message_id" gorm:"index;not null"`
	UploaderId   int    `json:"uploader_id" gorm:"index;not null"`
	Kind         string `json:"kind" gorm:"type:varchar(32);index"`
	StorageKey   string `json:"-" gorm:"type:varchar(255);uniqueIndex;not null"`
	OriginalName string `json:"original_name" gorm:"type:varchar(255);not null"`
	ContentType  string `json:"content_type" gorm:"type:varchar(64);not null"`
	ByteSize     int64  `json:"byte_size" gorm:"bigint;not null"`
	SHA256       string `json:"sha256" gorm:"type:char(64);index;not null"`
	CreatedAt    int64  `json:"created_at" gorm:"bigint;index"`
	PurgedAt     int64  `json:"purged_at" gorm:"bigint;index"`
}

type CorporateReceiptVerification struct {
	Id                int    `json:"id"`
	ApplicationId     int    `json:"application_id" gorm:"index;not null"`
	Channel           string `json:"channel" gorm:"type:varchar(32);uniqueIndex:idx_corporate_receipt_reference,priority:1;not null"`
	ExternalReference string `json:"external_reference" gorm:"type:varchar(128);uniqueIndex:idx_corporate_receipt_reference,priority:2;not null"`
	AmountCents       int64  `json:"amount_cents" gorm:"bigint;not null"`
	ReceivedAt        int64  `json:"received_at" gorm:"bigint;index;not null"`
	PayerName         string `json:"payer_name" gorm:"type:varchar(255)"`
	AdminNote         string `json:"admin_note" gorm:"type:text"`
	Status            string `json:"status" gorm:"type:varchar(16);index;not null"`
	VoidedBy          int    `json:"voided_by" gorm:"index"`
	VoidedAt          int64  `json:"voided_at" gorm:"bigint"`
	VoidReason        string `json:"void_reason" gorm:"type:text"`
	CreatedBy         int    `json:"created_by" gorm:"index;not null"`
	CreatedAt         int64  `json:"created_at" gorm:"bigint;index"`
}

type CorporateTransferIdempotency struct {
	Id             int    `json:"id"`
	UserId         int    `json:"user_id" gorm:"uniqueIndex:idx_corporate_transfer_idempotency,priority:1;not null"`
	IdempotencyKey string `json:"idempotency_key" gorm:"type:varchar(128);uniqueIndex:idx_corporate_transfer_idempotency,priority:2;not null"`
	RequestHash    string `json:"request_hash" gorm:"type:char(64);not null"`
	OrderId        int    `json:"order_id" gorm:"index;not null"`
	ApplicationId  int    `json:"application_id" gorm:"index;not null"`
	TicketId       int    `json:"ticket_id" gorm:"index;not null"`
	CreatedAt      int64  `json:"created_at" gorm:"bigint"`
}

type CorporateTransferRefund struct {
	Id                int    `json:"id"`
	ApplicationId     int    `json:"application_id" gorm:"index;not null"`
	OrderId           int    `json:"order_id" gorm:"index;not null"`
	AmountCents       int64  `json:"amount_cents" gorm:"bigint;not null"`
	Channel           string `json:"channel" gorm:"type:varchar(32);not null"`
	ExternalReference string `json:"external_reference" gorm:"type:varchar(128);uniqueIndex;not null"`
	RefundedAt        int64  `json:"refunded_at" gorm:"bigint;index;not null"`
	Reason            string `json:"reason" gorm:"type:text;not null"`
	OperatorId        int    `json:"operator_id" gorm:"index;not null"`
	CreatedAt         int64  `json:"created_at" gorm:"bigint"`
}

func corporateTimestamp() int64 { return common.GetTimestamp() }

func (s *CorporateCollectionState) BeforeCreate(_ *gorm.DB) error {
	s.UpdatedAt = corporateTimestamp()
	return nil
}
func (s *CorporateCollectionRevision) BeforeCreate(_ *gorm.DB) error {
	s.PublishedAt = corporateTimestamp()
	return nil
}
func (a *CorporateCollectionAsset) BeforeCreate(_ *gorm.DB) error {
	a.CreatedAt = corporateTimestamp()
	return nil
}
func (a *CorporateTransferApplication) BeforeCreate(_ *gorm.DB) error {
	now := corporateTimestamp()
	a.CreatedAt, a.UpdatedAt = now, now
	if a.Version == 0 {
		a.Version = 1
	}
	return nil
}
func (t *SupportTicket) BeforeCreate(_ *gorm.DB) error {
	now := corporateTimestamp()
	t.CreatedAt, t.UpdatedAt = now, now
	if t.Status == "" {
		t.Status = TicketStatusOpen
	}
	return nil
}
func (m *SupportTicketMessage) BeforeCreate(_ *gorm.DB) error {
	m.CreatedAt = corporateTimestamp()
	return nil
}
func (a *SupportTicketAttachment) BeforeCreate(_ *gorm.DB) error {
	a.CreatedAt = corporateTimestamp()
	return nil
}
func (r *CorporateReceiptVerification) BeforeCreate(_ *gorm.DB) error {
	r.CreatedAt = corporateTimestamp()
	if r.Status == "" {
		r.Status = "active"
	}
	return nil
}
func (i *CorporateTransferIdempotency) BeforeCreate(_ *gorm.DB) error {
	i.CreatedAt = corporateTimestamp()
	return nil
}
func (r *CorporateTransferRefund) BeforeCreate(_ *gorm.DB) error {
	r.CreatedAt = corporateTimestamp()
	return nil
}

type CreateCorporateTransferOrderParams struct {
	UserId              int
	SKUId               int
	Quantity            int
	RechargeAmountMinor int64
	GiftDiscountCents   int64
	IdempotencyKey      string
	PriorOrderNo        string
}

type CorporateTransferCreation struct {
	Order       ProductOrder                 `json:"order"`
	Application CorporateTransferApplication `json:"application"`
	Ticket      SupportTicket                `json:"ticket"`
}

func normalizeCorporateChannels(channels []CorporateCollectionChannel) ([]CorporateCollectionChannel, error) {
	seen := map[string]bool{}
	normalized := make([]CorporateCollectionChannel, 0, len(channels))
	for _, channel := range channels {
		channel.ChannelType = strings.TrimSpace(channel.ChannelType)
		if channel.ChannelType != CorporateChannelEnterpriseWechat && channel.ChannelType != CorporateChannelBank {
			return nil, errors.New("unsupported corporate collection channel")
		}
		if seen[channel.ChannelType] {
			return nil, errors.New("duplicate corporate collection channel")
		}
		seen[channel.ChannelType] = true
		channel.DisplayName = strings.TrimSpace(channel.DisplayName)
		channel.OrganizationName = strings.TrimSpace(channel.OrganizationName)
		channel.AccountName = strings.TrimSpace(channel.AccountName)
		channel.BankName = strings.TrimSpace(channel.BankName)
		channel.BankAccount = strings.TrimSpace(channel.BankAccount)
		channel.BankBranch = strings.TrimSpace(channel.BankBranch)
		channel.Instructions = strings.TrimSpace(channel.Instructions)
		if channel.Enabled {
			if channel.DisplayName == "" || channel.OrganizationName == "" {
				return nil, errors.New("enabled corporate collection channel is incomplete")
			}
			if channel.ChannelType == CorporateChannelEnterpriseWechat && channel.QrCodeAttachmentId <= 0 {
				return nil, errors.New("enterprise wechat collection QR code is required")
			}
			if channel.ChannelType == CorporateChannelBank && (channel.AccountName == "" || channel.BankName == "" || channel.BankAccount == "") {
				return nil, errors.New("corporate bank collection information is incomplete")
			}
		}
		normalized = append(normalized, channel)
	}
	return normalized, nil
}

func GetCorporateCollectionConfiguration() (*CorporateCollectionState, *CorporateCollectionRevision, error) {
	var state CorporateCollectionState
	result := DB.Order("id asc").Limit(1).Find(&state)
	if result.Error != nil {
		return nil, nil, result.Error
	}
	if result.RowsAffected == 0 {
		state.Id = 1
	}
	if state.CurrentRevisionId == 0 {
		return &state, nil, nil
	}
	var revision CorporateCollectionRevision
	if err := DB.Where("id = ?", state.CurrentRevisionId).First(&revision).Error; err != nil {
		return nil, nil, err
	}
	return &state, &revision, nil
}

func GetCorporateCollectionAvailability() (bool, int, error) {
	_, revision, err := GetCorporateCollectionConfiguration()
	if err != nil {
		return false, 0, err
	}
	if revision == nil {
		return false, 0, nil
	}
	var snapshot CorporateCollectionSnapshot
	if err := common.UnmarshalJsonStr(revision.SnapshotJSON, &snapshot); err != nil {
		return false, 0, err
	}
	for _, channel := range snapshot.Channels {
		if channel.Enabled {
			return true, revision.Revision, nil
		}
	}
	return false, revision.Revision, nil
}

func SaveCorporateCollectionDraft(channels []CorporateCollectionChannel, operatorId int) error {
	normalized, err := normalizeCorporateChannels(channels)
	if err != nil {
		return err
	}
	payload, err := common.Marshal(normalized)
	if err != nil {
		return err
	}
	now := corporateTimestamp()
	return DB.Transaction(func(tx *gorm.DB) error {
		var state CorporateCollectionState
		result := lockForUpdate(tx).Order("id asc").Limit(1).Find(&state)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			state = CorporateCollectionState{DraftJSON: string(payload), UpdatedBy: operatorId}
			return tx.Create(&state).Error
		}
		return tx.Model(&state).Updates(map[string]interface{}{"draft_json": string(payload), "updated_by": operatorId, "updated_at": now}).Error
	})
}

func PublishCorporateCollectionDraft(operatorId int, expectedRevision int) (*CorporateCollectionRevision, error) {
	var published CorporateCollectionRevision
	err := DB.Transaction(func(tx *gorm.DB) error {
		var state CorporateCollectionState
		if err := lockForUpdate(tx).Order("id asc").First(&state).Error; err != nil {
			return err
		}
		if state.CurrentRevision != expectedRevision {
			return errors.New("corporate collection configuration changed; reload and retry")
		}
		var channels []CorporateCollectionChannel
		if err := common.UnmarshalJsonStr(state.DraftJSON, &channels); err != nil {
			return err
		}
		normalized, err := normalizeCorporateChannels(channels)
		if err != nil {
			return err
		}
		enabled := 0
		for _, channel := range normalized {
			if channel.Enabled {
				enabled++
			}
		}
		if enabled == 0 {
			return ErrCorporateCollectionUnavailable
		}
		snapshot := CorporateCollectionSnapshot{Revision: state.CurrentRevision + 1, Channels: normalized}
		payload, err := common.Marshal(snapshot)
		if err != nil {
			return err
		}
		digest := fmt.Sprintf("%x", sha256.Sum256(payload))
		published = CorporateCollectionRevision{Revision: snapshot.Revision, SnapshotJSON: string(payload), Digest: digest, PublishedBy: operatorId}
		if err := tx.Create(&published).Error; err != nil {
			return err
		}
		return tx.Model(&state).Updates(map[string]interface{}{"current_revision_id": published.Id, "current_revision": published.Revision, "updated_by": operatorId, "updated_at": corporateTimestamp()}).Error
	})
	if err != nil {
		return nil, err
	}
	return &published, nil
}

func loadCorporateTransferCreation(idempotency *CorporateTransferIdempotency) (*CorporateTransferCreation, error) {
	if idempotency == nil {
		return nil, gorm.ErrRecordNotFound
	}
	var creation CorporateTransferCreation
	if err := DB.Preload("Items").Where("id = ?", idempotency.OrderId).First(&creation.Order).Error; err != nil {
		return nil, err
	}
	if err := DB.Where("id = ?", idempotency.ApplicationId).First(&creation.Application).Error; err != nil {
		return nil, err
	}
	if err := DB.Where("id = ?", idempotency.TicketId).First(&creation.Ticket).Error; err != nil {
		return nil, err
	}
	return &creation, nil
}

func CreateCorporateTransferOrder(params CreateCorporateTransferOrderParams) (*CorporateTransferCreation, error) {
	params.IdempotencyKey = strings.TrimSpace(params.IdempotencyKey)
	if params.IdempotencyKey == "" || len(params.IdempotencyKey) > 128 {
		return nil, errors.New("invalid idempotency key")
	}
	hashPayload, err := common.Marshal([]interface{}{params.SKUId, params.Quantity, params.RechargeAmountMinor, params.GiftDiscountCents, strings.TrimSpace(params.PriorOrderNo)})
	if err != nil {
		return nil, err
	}
	requestHash := fmt.Sprintf("%x", sha256.Sum256(hashPayload))
	if priorOrderNo := strings.TrimSpace(params.PriorOrderNo); priorOrderNo != "" {
		var prior ProductOrder
		if err := DB.Where("order_no = ? AND user_id = ? AND payment_provider = ?", priorOrderNo, params.UserId, PaymentProviderCorporateTransfer).First(&prior).Error; err != nil {
			return nil, errors.New("invalid prior corporate transfer order")
		}
		if prior.Status != ProductOrderStatusCancelled {
			return nil, errors.New("prior corporate transfer order is not terminated")
		}
	}
	var existing CorporateTransferIdempotency
	result := DB.Where("user_id = ? AND idempotency_key = ?", params.UserId, params.IdempotencyKey).Limit(1).Find(&existing)
	if result.Error != nil {
		return nil, result.Error
	}
	if result.RowsAffected > 0 {
		if existing.RequestHash != requestHash {
			return nil, ErrCorporateTransferConflict
		}
		return loadCorporateTransferCreation(&existing)
	}
	var revision CorporateCollectionRevision
	var state CorporateCollectionState
	if err := DB.Order("id asc").First(&state).Error; err != nil || state.CurrentRevisionId == 0 {
		return nil, ErrCorporateCollectionUnavailable
	}
	if err := DB.Where("id = ?", state.CurrentRevisionId).First(&revision).Error; err != nil {
		return nil, err
	}
	var snapshot CorporateCollectionSnapshot
	if err := common.UnmarshalJsonStr(revision.SnapshotJSON, &snapshot); err != nil {
		return nil, err
	}
	enabled := 0
	for _, channel := range snapshot.Channels {
		if channel.Enabled {
			enabled++
		}
	}
	if enabled == 0 {
		return nil, ErrCorporateCollectionUnavailable
	}
	var creation CorporateTransferCreation
	order, err := createProductOrderWithGiftAndHook(params.UserId, params.SKUId, params.Quantity, params.RechargeAmountMinor, params.GiftDiscountCents, func(tx *gorm.DB, order *ProductOrder) error {
		now := getDBTimestampTx(tx)
		order.ExpiresAt = now + CorporateTransferEvidenceTimeout
		order.PaymentProvider = PaymentProviderCorporateTransfer
		order.PaymentMethod = PaymentMethodCorporateTransfer
		if err := tx.Model(&ProductOrder{}).Where("id = ?", order.Id).Updates(map[string]interface{}{
			"payment_provider": PaymentProviderCorporateTransfer,
			"payment_method":   PaymentMethodCorporateTransfer,
			"expires_at":       order.ExpiresAt,
		}).Error; err != nil {
			return err
		}
		ticket := SupportTicket{TicketNo: fmt.Sprintf("TK-%d-%s", now, common.GetRandomString(10)), UserId: params.UserId, TicketType: PaymentProviderCorporateTransfer, Subject: fmt.Sprintf("对公转账凭证：%s", order.OrderNo), Status: TicketStatusOpen, RelatedOrderId: order.Id}
		if err := tx.Create(&ticket).Error; err != nil {
			return err
		}
		application := CorporateTransferApplication{ApplicationNo: fmt.Sprintf("CT-%d-%s", now, common.GetRandomString(10)), OrderId: order.Id, TicketId: ticket.Id, UserId: params.UserId, Status: CorporateTransferAwaitingEvidence, CollectionRevisionId: revision.Id, CollectionSnapshotJSON: revision.SnapshotJSON, EvidenceDeadlineAt: order.ExpiresAt, PriorOrderNo: strings.TrimSpace(params.PriorOrderNo)}
		if err := tx.Create(&application).Error; err != nil {
			return err
		}
		if err := tx.Model(&ticket).Update("related_application_id", application.Id).Error; err != nil {
			return err
		}
		message := SupportTicketMessage{TicketId: ticket.Id, SenderRole: TicketSenderSystem, Body: "订单已创建，请完成转账后上传支付凭证。"}
		if err := tx.Create(&message).Error; err != nil {
			return err
		}
		idempotency := CorporateTransferIdempotency{UserId: params.UserId, IdempotencyKey: params.IdempotencyKey, RequestHash: requestHash, OrderId: order.Id, ApplicationId: application.Id, TicketId: ticket.Id}
		if err := tx.Create(&idempotency).Error; err != nil {
			return err
		}
		creation.Application, creation.Ticket = application, ticket
		return nil
	})
	if err != nil {
		var raced CorporateTransferIdempotency
		if lookup := DB.Where("user_id = ? AND idempotency_key = ?", params.UserId, params.IdempotencyKey).Limit(1).Find(&raced); lookup.Error == nil && lookup.RowsAffected > 0 {
			if raced.RequestHash != requestHash {
				return nil, ErrCorporateTransferConflict
			}
			return loadCorporateTransferCreation(&raced)
		}
		return nil, err
	}
	creation.Order = *order
	return &creation, nil
}

func cancelCorporateTransferTx(tx *gorm.DB, application *CorporateTransferApplication, order *ProductOrder, status string, reason string) error {
	if application.Status == CorporateTransferFulfilled || application.Status == CorporateTransferApproved {
		return errors.New("fulfilled corporate transfer cannot be cancelled")
	}
	if order.Status != ProductOrderStatusPending {
		return fmt.Errorf("order cannot be cancelled from status %s", order.Status)
	}
	if err := releaseGiftTx(tx, order, reason); err != nil {
		return err
	}
	if err := restoreProductOrderStockTx(tx, order); err != nil {
		return err
	}
	now := getDBTimestampTx(tx)
	if err := tx.Model(order).Updates(map[string]interface{}{"status": ProductOrderStatusCancelled, "status_reason": strings.TrimSpace(reason), "cancelled_at": now, "stock_restored": order.StockRestored, "updated_at": now}).Error; err != nil {
		return err
	}
	if err := tx.Model(application).Updates(map[string]interface{}{"status": status, "user_visible_reason": strings.TrimSpace(reason), "reviewed_at": now, "updated_at": now, "version": gorm.Expr("version + 1")}).Error; err != nil {
		return err
	}
	if err := tx.Create(&SupportTicketMessage{TicketId: application.TicketId, SenderRole: TicketSenderSystem, Body: strings.TrimSpace(reason)}).Error; err != nil {
		return err
	}
	return tx.Model(&SupportTicket{}).Where("id = ?", application.TicketId).Updates(map[string]interface{}{"status": TicketStatusClosed, "closed_at": now, "updated_at": now}).Error
}

func CancelCorporateTransfer(applicationNo string, userId int, reason string) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		var application CorporateTransferApplication
		if err := lockForUpdate(tx).Where("application_no = ?", strings.TrimSpace(applicationNo)).First(&application).Error; err != nil {
			return err
		}
		if userId > 0 && application.UserId != userId {
			return gorm.ErrRecordNotFound
		}
		if application.Status != CorporateTransferAwaitingEvidence {
			return errors.New("corporate transfer can no longer be cancelled by the user")
		}
		var order ProductOrder
		if err := lockForUpdate(tx).Preload("Items").Where("id = ?", application.OrderId).First(&order).Error; err != nil {
			return err
		}
		return cancelCorporateTransferTx(tx, &application, &order, CorporateTransferCancelled, reason)
	})
}

func ExpireCorporateTransferApplications(limit int) (int, error) {
	if limit <= 0 {
		limit = 100
	}
	var ids []int
	now := GetDBTimestamp()
	if err := DB.Model(&CorporateTransferApplication{}).Where("status = ? AND evidence_deadline_at > 0 AND evidence_deadline_at <= ?", CorporateTransferAwaitingEvidence, now).Order("id asc").Limit(limit).Pluck("id", &ids).Error; err != nil {
		return 0, err
	}
	expired := 0
	for _, id := range ids {
		err := DB.Transaction(func(tx *gorm.DB) error {
			var application CorporateTransferApplication
			if err := lockForUpdate(tx).Where("id = ?", id).First(&application).Error; err != nil {
				return err
			}
			if application.Status != CorporateTransferAwaitingEvidence || application.EvidenceDeadlineAt > getDBTimestampTx(tx) {
				return nil
			}
			var order ProductOrder
			if err := lockForUpdate(tx).Preload("Items").Where("id = ?", application.OrderId).First(&order).Error; err != nil {
				return err
			}
			return cancelCorporateTransferTx(tx, &application, &order, CorporateTransferExpired, "payment evidence deadline expired")
		})
		if err != nil {
			return expired, err
		}
		expired++
	}
	return expired, nil
}

func AddCorporateReceipt(applicationNo string, adminId int, receipt CorporateReceiptVerification) (*CorporateReceiptVerification, error) {
	receipt.Channel = strings.TrimSpace(receipt.Channel)
	receipt.ExternalReference = strings.ToUpper(strings.TrimSpace(receipt.ExternalReference))
	if (receipt.Channel != CorporateChannelEnterpriseWechat && receipt.Channel != CorporateChannelBank) || receipt.ExternalReference == "" || receipt.AmountCents <= 0 || receipt.ReceivedAt <= 0 {
		return nil, errors.New("invalid corporate receipt")
	}
	err := DB.Transaction(func(tx *gorm.DB) error {
		var application CorporateTransferApplication
		if err := lockForUpdate(tx).Where("application_no = ?", strings.TrimSpace(applicationNo)).First(&application).Error; err != nil {
			return err
		}
		if application.Status != CorporateTransferUnderReview && application.Status != CorporateTransferNeedsMoreInfo {
			return ErrCorporateTransferNotApprovable
		}
		var existingChannel string
		if err := tx.Model(&CorporateReceiptVerification{}).Where("application_id = ? AND status = ?", application.Id, "active").Limit(1).Pluck("channel", &existingChannel).Error; err != nil {
			return err
		}
		if existingChannel != "" && existingChannel != receipt.Channel {
			return errors.New("mixed corporate transfer channels are not supported")
		}
		receipt.ApplicationId, receipt.CreatedBy, receipt.Status = application.Id, adminId, "active"
		return tx.Create(&receipt).Error
	})
	if err != nil {
		return nil, err
	}
	return &receipt, nil
}

func VoidCorporateReceipt(receiptId int, adminId int, reason string) error {
	reason = strings.TrimSpace(reason)
	if reason == "" {
		return errors.New("void reason is required")
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		var receipt CorporateReceiptVerification
		if err := lockForUpdate(tx).Where("id = ?", receiptId).First(&receipt).Error; err != nil {
			return err
		}
		var application CorporateTransferApplication
		if err := lockForUpdate(tx).Where("id = ?", receipt.ApplicationId).First(&application).Error; err != nil {
			return err
		}
		if application.Status == CorporateTransferApproved || application.Status == CorporateTransferFulfilled {
			return errors.New("approved receipt cannot be voided")
		}
		if receipt.Status == "voided" {
			return nil
		}
		return tx.Model(&receipt).Updates(map[string]interface{}{"status": "voided", "voided_by": adminId, "voided_at": getDBTimestampTx(tx), "void_reason": reason}).Error
	})
}

func ApproveCorporateTransfer(applicationNo string, adminId int) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		var application CorporateTransferApplication
		if err := lockForUpdate(tx).Where("application_no = ?", strings.TrimSpace(applicationNo)).First(&application).Error; err != nil {
			return err
		}
		if application.Status == CorporateTransferFulfilled {
			return nil
		}
		if application.UserId == adminId {
			return errors.New("administrator cannot approve their own order")
		}
		if application.Status != CorporateTransferUnderReview {
			return ErrCorporateTransferNotApprovable
		}
		var order ProductOrder
		if err := lockForUpdate(tx).Where("id = ?", application.OrderId).First(&order).Error; err != nil {
			return err
		}
		if order.PaymentProvider != PaymentProviderCorporateTransfer || order.Status != ProductOrderStatusPending {
			return ErrPaymentMethodMismatch
		}
		var receipts []CorporateReceiptVerification
		if err := tx.Where("application_id = ? AND status = ?", application.Id, "active").Order("id asc").Find(&receipts).Error; err != nil {
			return err
		}
		if len(receipts) == 0 {
			return errors.New("no verified corporate receipt")
		}
		var total int64
		channel := receipts[0].Channel
		for _, receipt := range receipts {
			if receipt.Channel != channel {
				return errors.New("mixed corporate transfer channels are not supported")
			}
			if receipt.AmountCents > order.PayableCashCents()-total {
				return errors.New("corporate receipt total exceeds cash payable")
			}
			total += receipt.AmountCents
		}
		if total != order.PayableCashCents() {
			return fmt.Errorf("verified receipt total %d does not equal cash payable %d", total, order.PayableCashCents())
		}
		payload, err := common.Marshal(receipts)
		if err != nil {
			return err
		}
		now := getDBTimestampTx(tx)
		if err := tx.Model(&application).Updates(map[string]interface{}{"status": CorporateTransferApproved, "reviewer_id": adminId, "reviewed_at": now, "approved_at": now, "updated_at": now, "version": gorm.Expr("version + 1")}).Error; err != nil {
			return err
		}
		if err := completeProductOrderWithProviderTx(tx, order.OrderNo, receipts[0].ExternalReference, PaymentProviderCorporateTransfer, PaymentMethodCorporateTransfer, string(payload)); err != nil {
			return err
		}
		if err := tx.Model(&application).Updates(map[string]interface{}{"status": CorporateTransferFulfilled, "fulfilled_at": now, "updated_at": now, "version": gorm.Expr("version + 1")}).Error; err != nil {
			return err
		}
		resultMessage := fmt.Sprintf("到账核验完成：订单 %s，到账金额 ¥%.2f，权益已发放。", order.OrderNo, float64(total)/100)
		if err := tx.Create(&SupportTicketMessage{TicketId: application.TicketId, SenderRole: TicketSenderSystem, Body: resultMessage}).Error; err != nil {
			return err
		}
		return tx.Model(&SupportTicket{}).Where("id = ?", application.TicketId).Updates(map[string]interface{}{"status": TicketStatusClosed, "closed_at": now, "updated_at": now}).Error
	})
}

func SubmitCorporateTransferEvidence(applicationNo string, userId int, body string, attachments []SupportTicketAttachment) (*SupportTicketMessage, error) {
	var message SupportTicketMessage
	err := DB.Transaction(func(tx *gorm.DB) error {
		var application CorporateTransferApplication
		if err := lockForUpdate(tx).Where("application_no = ? AND user_id = ?", strings.TrimSpace(applicationNo), userId).First(&application).Error; err != nil {
			return err
		}
		if application.Status != CorporateTransferAwaitingEvidence && application.Status != CorporateTransferNeedsMoreInfo {
			return errors.New("corporate transfer is not accepting evidence")
		}
		var existingCount int64
		if err := tx.Model(&SupportTicketAttachment{}).
			Where("ticket_id = ?", application.TicketId).
			Where("kind = ? OR kind = ? OR kind IS NULL", "", TicketAttachmentKindPaymentEvidence).
			Count(&existingCount).Error; err != nil {
			return err
		}
		if len(attachments) == 0 || len(attachments) > 5 || existingCount+int64(len(attachments)) > 10 {
			return errors.New("invalid payment evidence count")
		}
		message = SupportTicketMessage{TicketId: application.TicketId, SenderUserId: userId, SenderRole: TicketSenderUser, Body: strings.TrimSpace(body)}
		if err := tx.Create(&message).Error; err != nil {
			return err
		}
		for index := range attachments {
			attachments[index].Kind = TicketAttachmentKindPaymentEvidence
			attachments[index].TicketId = application.TicketId
			attachments[index].MessageId = message.Id
			attachments[index].UploaderId = userId
			if err := tx.Create(&attachments[index]).Error; err != nil {
				return err
			}
		}
		now := getDBTimestampTx(tx)
		if err := tx.Model(&application).Updates(map[string]interface{}{"status": CorporateTransferUnderReview, "evidence_submitted_at": now, "user_visible_reason": "", "updated_at": now, "version": gorm.Expr("version + 1")}).Error; err != nil {
			return err
		}
		return tx.Model(&SupportTicket{}).Where("id = ?", application.TicketId).Updates(map[string]interface{}{"status": TicketStatusOpen, "updated_at": now}).Error
	})
	if err != nil {
		return nil, err
	}
	message.Attachments = attachments
	return &message, nil
}

func AppendCorporateTransferTicketMessage(applicationNo string, senderId int, senderRole string, body string, internal bool, attachments []SupportTicketAttachment) (*SupportTicketMessage, error) {
	body = strings.TrimSpace(body)
	if (body == "" && len(attachments) == 0) || len([]rune(body)) > 5000 || len(attachments) > 5 {
		return nil, errors.New("invalid ticket message")
	}
	returnMessage := &SupportTicketMessage{}
	err := DB.Transaction(func(tx *gorm.DB) error {
		var application CorporateTransferApplication
		query := lockForUpdate(tx).Where("application_no = ?", strings.TrimSpace(applicationNo))
		if senderRole == TicketSenderUser {
			query = query.Where("user_id = ?", senderId)
			internal = false
		}
		if err := query.First(&application).Error; err != nil {
			return err
		}
		var ticket SupportTicket
		if err := lockForUpdate(tx).Where("id = ?", application.TicketId).First(&ticket).Error; err != nil {
			return err
		}
		now := getDBTimestampTx(tx)
		message := SupportTicketMessage{TicketId: application.TicketId, SenderUserId: senderId, SenderRole: senderRole, Body: body, Internal: internal}
		if err := tx.Create(&message).Error; err != nil {
			return err
		}
		for index := range attachments {
			attachments[index].Kind = TicketAttachmentKindReply
			attachments[index].TicketId = application.TicketId
			attachments[index].MessageId = message.Id
			attachments[index].UploaderId = senderId
			if err := tx.Create(&attachments[index]).Error; err != nil {
				return err
			}
		}
		updates := map[string]interface{}{"updated_at": now}
		if ticket.Status != TicketStatusOpen {
			updates["status"] = TicketStatusOpen
			updates["closed_at"] = 0
		}
		if err := tx.Model(&ticket).Updates(updates).Error; err != nil {
			return err
		}
		message.Attachments = attachments
		*returnMessage = message
		return nil
	})
	if err != nil {
		return nil, err
	}
	return returnMessage, nil
}

func GetCorporateTransferAttachmentForUser(id int, userId int) (*SupportTicketAttachment, error) {
	var attachment SupportTicketAttachment
	err := DB.Model(&SupportTicketAttachment{}).
		Joins("JOIN support_ticket_messages ON support_ticket_messages.id = support_ticket_attachments.message_id").
		Joins("JOIN support_tickets ON support_tickets.id = support_ticket_attachments.ticket_id").
		Where("support_ticket_attachments.id = ? AND support_ticket_attachments.purged_at = ?", id, 0).
		Where("support_tickets.user_id = ? AND support_ticket_messages.internal = ?", userId, false).
		First(&attachment).Error
	if err != nil {
		return nil, err
	}
	return &attachment, nil
}

func SetCorporateTransferTicketOpen(applicationNo string, adminId int, open bool) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		var application CorporateTransferApplication
		if err := lockForUpdate(tx).Where("application_no = ?", strings.TrimSpace(applicationNo)).First(&application).Error; err != nil {
			return err
		}
		now := getDBTimestampTx(tx)
		status := TicketStatusClosed
		closedAt := now
		body := "工单已由管理员关闭。"
		if open {
			status, closedAt, body = TicketStatusOpen, 0, "工单已由管理员重新打开，仅用于继续沟通，不改变支付审核结果。"
		}
		if err := tx.Model(&SupportTicket{}).Where("id = ?", application.TicketId).Updates(map[string]interface{}{"status": status, "closed_at": closedAt, "updated_at": now}).Error; err != nil {
			return err
		}
		return tx.Create(&SupportTicketMessage{TicketId: application.TicketId, SenderUserId: adminId, SenderRole: TicketSenderSystem, Body: body}).Error
	})
}

func TransitionCorporateTransferReview(applicationNo string, adminId int, targetStatus string, userVisibleReason string, internalNote string) error {
	userVisibleReason = strings.TrimSpace(userVisibleReason)
	if targetStatus != CorporateTransferNeedsMoreInfo && targetStatus != CorporateTransferRejected {
		return errors.New("unsupported corporate transfer review transition")
	}
	if userVisibleReason == "" {
		return errors.New("user-visible reason is required")
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		var application CorporateTransferApplication
		if err := lockForUpdate(tx).Where("application_no = ?", strings.TrimSpace(applicationNo)).First(&application).Error; err != nil {
			return err
		}
		if application.Status != CorporateTransferUnderReview && application.Status != CorporateTransferNeedsMoreInfo {
			return ErrCorporateTransferNotApprovable
		}
		now := getDBTimestampTx(tx)
		if targetStatus == CorporateTransferRejected {
			var order ProductOrder
			if err := lockForUpdate(tx).Preload("Items").Where("id = ?", application.OrderId).First(&order).Error; err != nil {
				return err
			}
			if err := cancelCorporateTransferTx(tx, &application, &order, CorporateTransferRejected, userVisibleReason); err != nil {
				return err
			}
			return tx.Model(&application).Updates(map[string]interface{}{"reviewer_id": adminId, "internal_note": strings.TrimSpace(internalNote), "reviewed_at": now}).Error
		}
		if err := tx.Model(&application).Updates(map[string]interface{}{"status": targetStatus, "reviewer_id": adminId, "user_visible_reason": userVisibleReason, "internal_note": strings.TrimSpace(internalNote), "reviewed_at": now, "updated_at": now, "version": gorm.Expr("version + 1")}).Error; err != nil {
			return err
		}
		message := SupportTicketMessage{TicketId: application.TicketId, SenderUserId: adminId, SenderRole: TicketSenderAdmin, Body: userVisibleReason}
		return tx.Create(&message).Error
	})
}

func MarkCorporateTicketRead(ticketNo string, userId int, admin bool) error {
	var ticket SupportTicket
	query := DB.Where("ticket_no = ?", strings.TrimSpace(ticketNo))
	if !admin {
		query = query.Where("user_id = ?", userId)
	}
	if err := query.First(&ticket).Error; err != nil {
		return err
	}
	var lastMessageId int
	if err := DB.Model(&SupportTicketMessage{}).Where("ticket_id = ?", ticket.Id).Select("COALESCE(MAX(id), 0)").Scan(&lastMessageId).Error; err != nil {
		return err
	}
	column := "last_user_read_message_id"
	if admin {
		column = "last_admin_read_message_id"
	}
	return DB.Model(&ticket).Update(column, lastMessageId).Error
}

func CountUnreadCorporateTransferTickets(userId int, admin bool) (int64, error) {
	query := DB.Model(&SupportTicket{}).Where("ticket_type = ?", PaymentProviderCorporateTransfer)
	if admin {
		query = query.Where("EXISTS (?)", DB.Model(&SupportTicketMessage{}).Select("1").Where("support_ticket_messages.ticket_id = support_tickets.id AND support_ticket_messages.id > support_tickets.last_admin_read_message_id AND support_ticket_messages.sender_role = ?", TicketSenderUser))
	} else {
		query = query.Where("user_id = ?", userId).Where("EXISTS (?)", DB.Model(&SupportTicketMessage{}).Select("1").Where("support_ticket_messages.ticket_id = support_tickets.id AND support_ticket_messages.id > support_tickets.last_user_read_message_id AND support_ticket_messages.sender_role IN ? AND support_ticket_messages.internal = ?", []string{TicketSenderAdmin, TicketSenderSystem}, false))
	}
	var count int64
	return count, query.Count(&count).Error
}

func ListDueCorporateEvidencePurges(limit int) ([]SupportTicketAttachment, error) {
	if limit <= 0 {
		limit = 100
	}
	var attachments []SupportTicketAttachment
	cutoff := GetDBTimestamp() - int64(2*365*24*60*60)
	err := DB.Where("purged_at = ? AND created_at > 0 AND created_at <= ?", 0, cutoff).Order("id asc").Limit(limit).Find(&attachments).Error
	return attachments, err
}

func MarkCorporateEvidencePurged(id int) error {
	return DB.Model(&SupportTicketAttachment{}).Where("id = ? AND purged_at = ?", id, 0).Update("purged_at", GetDBTimestamp()).Error
}

func RegisterCorporateTransferRefund(applicationNo string, operatorId int, refund CorporateTransferRefund) (*CorporateTransferRefund, error) {
	refund.Channel = strings.TrimSpace(refund.Channel)
	refund.ExternalReference = strings.ToUpper(strings.TrimSpace(refund.ExternalReference))
	refund.Reason = strings.TrimSpace(refund.Reason)
	if (refund.Channel != CorporateChannelEnterpriseWechat && refund.Channel != CorporateChannelBank) || refund.ExternalReference == "" || refund.AmountCents <= 0 || refund.RefundedAt <= 0 || refund.Reason == "" {
		return nil, errors.New("invalid corporate transfer refund registration")
	}
	err := DB.Transaction(func(tx *gorm.DB) error {
		var application CorporateTransferApplication
		if err := lockForUpdate(tx).Where("application_no = ?", strings.TrimSpace(applicationNo)).First(&application).Error; err != nil {
			return err
		}
		if application.Status != CorporateTransferFulfilled {
			return errors.New("only fulfilled corporate transfers can be refunded")
		}
		var order ProductOrder
		if err := lockForUpdate(tx).Where("id = ?", application.OrderId).First(&order).Error; err != nil {
			return err
		}
		if order.Status != ProductOrderStatusFulfilled {
			return errors.New("corporate transfer order is not refundable")
		}
		if refund.AmountCents != order.CashPaidCents {
			return errors.New("refund amount must equal the cash paid amount")
		}
		refund.ApplicationId, refund.OrderId, refund.OperatorId = application.Id, order.Id, operatorId
		if err := tx.Create(&refund).Error; err != nil {
			return err
		}
		if err := refundProductOrderTx(tx, order.OrderNo, operatorId, refund.Reason); err != nil {
			return err
		}
		return tx.Create(&SupportTicketMessage{TicketId: application.TicketId, SenderRole: TicketSenderSystem, Body: fmt.Sprintf("退款已登记：¥%.2f，退款流水 %s。", float64(refund.AmountCents)/100, refund.ExternalReference)}).Error
	})
	if err != nil {
		return nil, err
	}
	return &refund, nil
}
