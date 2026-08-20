package model

import (
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func resetCorporateTransferFixtures(t *testing.T) {
	t.Helper()
	require.NoError(t, DB.AutoMigrate(
		&AccessGroupPolicy{}, &EntitlementType{}, &EntitlementTypeGroup{}, &EntitlementTypeChangeLog{},
		&Product{}, &ProductSKU{}, &ProductOrder{}, &ProductOrderItem{}, &Entitlement{},
		&GiftSettings{}, &GiftAccount{}, &GiftLedgerEntry{}, &GiftHold{}, &ReferralProfile{}, &ReferralRewardEvent{},
		&CorporateCollectionState{}, &CorporateCollectionRevision{}, &CorporateCollectionAsset{},
		&CorporateTransferApplication{}, &SupportTicket{}, &SupportTicketMessage{}, &SupportTicketAttachment{},
		&CorporateReceiptVerification{}, &CorporateTransferIdempotency{}, &CorporateTransferRefund{},
	))
	tables := []interface{}{
		&CorporateTransferRefund{}, &CorporateReceiptVerification{}, &SupportTicketAttachment{},
		&SupportTicketMessage{}, &CorporateTransferIdempotency{}, &CorporateTransferApplication{},
		&SupportTicket{}, &CorporateCollectionRevision{}, &CorporateCollectionState{}, &CorporateCollectionAsset{},
		&ReferralRewardEvent{}, &ReferralProfile{}, &GiftHold{}, &GiftLedgerEntry{}, &GiftAccount{}, &GiftSettings{},
		&Entitlement{}, &ProductOrderItem{}, &ProductOrder{}, &ProductSKU{}, &Product{},
		&EntitlementTypeChangeLog{}, &EntitlementTypeGroup{}, &EntitlementType{}, &AccessGroupPolicy{},
	}
	for _, table := range tables {
		require.NoError(t, DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Unscoped().Delete(table).Error)
	}
	t.Cleanup(func() {
		for _, table := range tables {
			_ = DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Unscoped().Delete(table).Error
		}
	})
}

func seedCorporateTransferStore(t *testing.T) ProductSKU {
	t.Helper()
	suffix := time.Now().UnixNano()
	entitlementType := seedEntitlementType(t, fmt.Sprintf("corporate-sub-%d", suffix), EntitlementAssetSubscription, fmt.Sprintf("corporate-group-%d", suffix))
	product := Product{Code: fmt.Sprintf("corporate-product-%d", suffix), Name: "Corporate subscription", Category: ProductCategorySubscription, Status: ProductStatusActive}
	require.NoError(t, DB.Create(&product).Error)
	sku := ProductSKU{Code: fmt.Sprintf("corporate-sku-%d", suffix), ProductId: product.Id, EntitlementTypeId: entitlementType.Id, Name: "Corporate SKU", PriceAmountMinor: 10_000, Currency: "CNY", GrantTotalQuota: 1_000_000, ValiditySeconds: 30 * 86400, ActivationPolicy: ActivationPolicyImmediate, Status: ProductStatusActive}
	require.NoError(t, DB.Create(&sku).Error)
	asset := CorporateCollectionAsset{UploaderId: 1, StorageKey: fmt.Sprintf("test/%d.png", suffix), OriginalName: "wechat.png", ContentType: "image/png", ByteSize: 10, SHA256: fmt.Sprintf("%064d", suffix)}
	require.NoError(t, DB.Create(&asset).Error)
	require.NoError(t, SaveCorporateCollectionDraft([]CorporateCollectionChannel{{ChannelType: CorporateChannelEnterpriseWechat, Enabled: true, DisplayName: "企业微信", OrganizationName: "itokenify", QrCodeAttachmentId: asset.Id}}, 1))
	_, err := PublishCorporateCollectionDraft(1, 0)
	require.NoError(t, err)
	return sku
}

func createCorporateTransferFixture(t *testing.T, userId int, sku ProductSKU, key string) *CorporateTransferCreation {
	t.Helper()
	creation, err := CreateCorporateTransferOrder(CreateCorporateTransferOrderParams{UserId: userId, SKUId: sku.Id, Quantity: 1, IdempotencyKey: key})
	require.NoError(t, err)
	return creation
}

func TestCorporateTransferCreationIsAtomicAndIdempotent(t *testing.T) {
	resetCorporateTransferFixtures(t)
	sku := seedCorporateTransferStore(t)
	first := createCorporateTransferFixture(t, 91001, sku, "corporate-idempotency")
	second := createCorporateTransferFixture(t, 91001, sku, "corporate-idempotency")

	assert.Equal(t, first.Order.Id, second.Order.Id)
	assert.Equal(t, first.Application.Id, second.Application.Id)
	assert.Equal(t, first.Ticket.Id, second.Ticket.Id)
	assert.Equal(t, PaymentProviderCorporateTransfer, first.Order.PaymentProvider)
	assert.Equal(t, CorporateTransferAwaitingEvidence, first.Application.Status)
	assert.EqualValues(t, CorporateTransferEvidenceTimeout, first.Application.EvidenceDeadlineAt-first.Order.CreatedAt)
	userUnread, err := CountUnreadCorporateTransferTickets(91001, false)
	require.NoError(t, err)
	assert.EqualValues(t, 1, userUnread)
	require.NoError(t, MarkCorporateTicketRead(first.Ticket.TicketNo, 91001, false))
	userUnread, err = CountUnreadCorporateTransferTickets(91001, false)
	require.NoError(t, err)
	assert.Zero(t, userUnread)

	_, err = CreateCorporateTransferOrder(CreateCorporateTransferOrderParams{UserId: 91001, SKUId: sku.Id, Quantity: 2, IdempotencyKey: "corporate-idempotency"})
	assert.ErrorIs(t, err, ErrCorporateTransferConflict)
	var orderCount, applicationCount, ticketCount int64
	require.NoError(t, DB.Model(&ProductOrder{}).Count(&orderCount).Error)
	require.NoError(t, DB.Model(&CorporateTransferApplication{}).Count(&applicationCount).Error)
	require.NoError(t, DB.Model(&SupportTicket{}).Count(&ticketCount).Error)
	assert.EqualValues(t, 1, orderCount)
	assert.EqualValues(t, 1, applicationCount)
	assert.EqualValues(t, 1, ticketCount)
}

func TestCorporateCollectionAvailabilityRequiresPublishedEnabledChannel(t *testing.T) {
	resetCorporateTransferFixtures(t)

	available, revision, err := GetCorporateCollectionAvailability()
	require.NoError(t, err)
	assert.False(t, available)
	assert.Zero(t, revision)

	seedCorporateTransferStore(t)
	available, revision, err = GetCorporateCollectionAvailability()
	require.NoError(t, err)
	assert.True(t, available)
	assert.Equal(t, 1, revision)
}

func TestCorporateTransferApprovalRequiresExactUniqueReceiptsAndFulfillsOnce(t *testing.T) {
	resetCorporateTransferFixtures(t)
	sku := seedCorporateTransferStore(t)
	creation := createCorporateTransferFixture(t, 91002, sku, "corporate-approval")
	_, err := SubmitCorporateTransferEvidence(creation.Application.ApplicationNo, 91002, "", []SupportTicketAttachment{{StorageKey: "evidence/a.png", OriginalName: "a.png", ContentType: "image/png", ByteSize: 10, SHA256: fmt.Sprintf("%064d", 1)}})
	require.NoError(t, err)
	adminUnread, err := CountUnreadCorporateTransferTickets(0, true)
	require.NoError(t, err)
	assert.EqualValues(t, 1, adminUnread)

	_, err = AddCorporateReceipt(creation.Application.ApplicationNo, 1, CorporateReceiptVerification{Channel: CorporateChannelEnterpriseWechat, ExternalReference: " wx-unique-001 ", AmountCents: 4_000, ReceivedAt: GetDBTimestamp()})
	require.NoError(t, err)
	err = ApproveCorporateTransfer(creation.Application.ApplicationNo, 1)
	require.Error(t, err)
	_, err = AddCorporateReceipt(creation.Application.ApplicationNo, 1, CorporateReceiptVerification{Channel: CorporateChannelEnterpriseWechat, ExternalReference: "wx-unique-002", AmountCents: 6_000, ReceivedAt: GetDBTimestamp()})
	require.NoError(t, err)
	require.NoError(t, ApproveCorporateTransfer(creation.Application.ApplicationNo, 1))
	require.NoError(t, ApproveCorporateTransfer(creation.Application.ApplicationNo, 1))

	var order ProductOrder
	require.NoError(t, DB.Where("id = ?", creation.Order.Id).First(&order).Error)
	assert.Equal(t, ProductOrderStatusFulfilled, order.Status)
	assert.EqualValues(t, 10_000, order.CashPaidCents)
	var entitlementCount int64
	require.NoError(t, DB.Model(&Entitlement{}).Where("source_type = ? AND source_id = ?", "order", order.Id).Count(&entitlementCount).Error)
	assert.EqualValues(t, 1, entitlementCount)
	var application CorporateTransferApplication
	require.NoError(t, DB.Where("id = ?", creation.Application.Id).First(&application).Error)
	assert.Equal(t, CorporateTransferFulfilled, application.Status)

	other := createCorporateTransferFixture(t, 91003, sku, "corporate-duplicate-receipt")
	_, err = SubmitCorporateTransferEvidence(other.Application.ApplicationNo, 91003, "", []SupportTicketAttachment{{StorageKey: "evidence/b.png", OriginalName: "b.png", ContentType: "image/png", ByteSize: 10, SHA256: fmt.Sprintf("%064d", 2)}})
	require.NoError(t, err)
	_, err = AddCorporateReceipt(other.Application.ApplicationNo, 1, CorporateReceiptVerification{Channel: CorporateChannelEnterpriseWechat, ExternalReference: "wx-unique-001", AmountCents: 10_000, ReceivedAt: GetDBTimestamp()})
	require.Error(t, err)

	refund, err := RegisterCorporateTransferRefund(creation.Application.ApplicationNo, 1, CorporateTransferRefund{AmountCents: 10_000, Channel: CorporateChannelEnterpriseWechat, ExternalReference: "refund-001", RefundedAt: GetDBTimestamp(), Reason: "customer refund completed"})
	require.NoError(t, err)
	assert.Equal(t, "REFUND-001", refund.ExternalReference)
	require.NoError(t, DB.Where("id = ?", creation.Order.Id).First(&order).Error)
	assert.Equal(t, ProductOrderStatusRefunded, order.Status)
	_, err = RegisterCorporateTransferRefund(creation.Application.ApplicationNo, 1, CorporateTransferRefund{AmountCents: 10_000, Channel: CorporateChannelEnterpriseWechat, ExternalReference: "refund-002", RefundedAt: GetDBTimestamp(), Reason: "duplicate"})
	require.Error(t, err)
}

func TestCorporateTransferExpiryTerminatesOrderAndTicket(t *testing.T) {
	resetCorporateTransferFixtures(t)
	sku := seedCorporateTransferStore(t)
	creation := createCorporateTransferFixture(t, 91004, sku, "corporate-expiry")
	require.NoError(t, DB.Model(&CorporateTransferApplication{}).Where("id = ?", creation.Application.Id).Update("evidence_deadline_at", GetDBTimestamp()-1).Error)

	count, err := ExpireCorporateTransferApplications(10)
	require.NoError(t, err)
	assert.Equal(t, 1, count)
	var application CorporateTransferApplication
	var order ProductOrder
	var ticket SupportTicket
	require.NoError(t, DB.Where("id = ?", creation.Application.Id).First(&application).Error)
	require.NoError(t, DB.Where("id = ?", creation.Order.Id).First(&order).Error)
	require.NoError(t, DB.Where("id = ?", creation.Ticket.Id).First(&ticket).Error)
	assert.Equal(t, CorporateTransferExpired, application.Status)
	assert.Equal(t, ProductOrderStatusCancelled, order.Status)
	assert.Equal(t, TicketStatusClosed, ticket.Status)
}

func TestCorporateTransferReplyReopensOnlyTheTicket(t *testing.T) {
	resetCorporateTransferFixtures(t)
	sku := seedCorporateTransferStore(t)
	creation := createCorporateTransferFixture(t, 91005, sku, "corporate-reply-reopen")
	require.NoError(t, SetCorporateTransferTicketOpen(creation.Application.ApplicationNo, 1, false))

	attachment := SupportTicketAttachment{StorageKey: "reply/image.png", OriginalName: "image.png", ContentType: "image/png", ByteSize: 10, SHA256: fmt.Sprintf("%064d", 3)}
	message, err := AppendCorporateTransferTicketMessage(creation.Application.ApplicationNo, 91005, TicketSenderUser, "", true, []SupportTicketAttachment{attachment})
	require.NoError(t, err)
	require.Len(t, message.Attachments, 1)
	assert.False(t, message.Internal)
	assert.Equal(t, "reply", message.Attachments[0].Kind)
	evidence := make([]SupportTicketAttachment, 5)
	for index := range evidence {
		evidence[index] = SupportTicketAttachment{StorageKey: fmt.Sprintf("evidence/%d.png", index), OriginalName: fmt.Sprintf("%d.png", index), ContentType: "image/png", ByteSize: 10, SHA256: fmt.Sprintf("%064d", index+10)}
	}
	evidenceMessage, err := SubmitCorporateTransferEvidence(creation.Application.ApplicationNo, 91005, "", evidence)
	require.NoError(t, err)
	require.Len(t, evidenceMessage.Attachments, 5)
	assert.Equal(t, "payment_evidence", evidenceMessage.Attachments[0].Kind)

	var ticket SupportTicket
	var application CorporateTransferApplication
	var order ProductOrder
	require.NoError(t, DB.Where("id = ?", creation.Ticket.Id).First(&ticket).Error)
	require.NoError(t, DB.Where("id = ?", creation.Application.Id).First(&application).Error)
	require.NoError(t, DB.Where("id = ?", creation.Order.Id).First(&order).Error)
	assert.Equal(t, TicketStatusOpen, ticket.Status)
	assert.Zero(t, ticket.ClosedAt)
	assert.Equal(t, CorporateTransferUnderReview, application.Status)
	assert.Equal(t, ProductOrderStatusPending, order.Status)
}

func TestCorporateTransferTerminalReplyReopensCommunicationOnly(t *testing.T) {
	resetCorporateTransferFixtures(t)
	sku := seedCorporateTransferStore(t)
	creation := createCorporateTransferFixture(t, 91006, sku, "corporate-terminal-reply")
	require.NoError(t, CancelCorporateTransfer(creation.Application.ApplicationNo, 91006, "cancelled for test"))

	_, err := AppendCorporateTransferTicketMessage(creation.Application.ApplicationNo, 91006, TicketSenderUser, "please reopen", false, nil)
	require.NoError(t, err)

	var ticket SupportTicket
	var application CorporateTransferApplication
	require.NoError(t, DB.Where("id = ?", creation.Ticket.Id).First(&ticket).Error)
	require.NoError(t, DB.Where("id = ?", creation.Application.Id).First(&application).Error)
	assert.Equal(t, TicketStatusOpen, ticket.Status)
	assert.Equal(t, CorporateTransferCancelled, application.Status)
}

func TestCorporateTransferInternalAttachmentIsNotVisibleToShopper(t *testing.T) {
	resetCorporateTransferFixtures(t)
	sku := seedCorporateTransferStore(t)
	creation := createCorporateTransferFixture(t, 91007, sku, "corporate-internal-attachment")
	publicMessage, err := AppendCorporateTransferTicketMessage(creation.Application.ApplicationNo, 1, TicketSenderAdmin, "public", false, []SupportTicketAttachment{{StorageKey: "reply/public.png", OriginalName: "public.png", ContentType: "image/png", ByteSize: 10, SHA256: fmt.Sprintf("%064d", 30)}})
	require.NoError(t, err)
	internalMessage, err := AppendCorporateTransferTicketMessage(creation.Application.ApplicationNo, 1, TicketSenderAdmin, "internal", true, []SupportTicketAttachment{{StorageKey: "reply/internal.png", OriginalName: "internal.png", ContentType: "image/png", ByteSize: 10, SHA256: fmt.Sprintf("%064d", 31)}})
	require.NoError(t, err)

	visible, err := GetCorporateTransferAttachmentForUser(publicMessage.Attachments[0].Id, 91007)
	require.NoError(t, err)
	assert.Equal(t, publicMessage.Attachments[0].Id, visible.Id)
	_, err = GetCorporateTransferAttachmentForUser(internalMessage.Attachments[0].Id, 91007)
	require.Error(t, err)
	_, err = GetCorporateTransferAttachmentForUser(publicMessage.Attachments[0].Id, 99999)
	require.Error(t, err)
}
