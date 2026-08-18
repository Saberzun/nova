package model

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"gorm.io/gorm"
)

const StoreNoticeMaxCharacters = 5000

var (
	ErrStoreNoticeConflict       = errors.New("store notice changed, reload and try again")
	ErrStoreNoticeNotPublished   = errors.New("store notice is not published")
	ErrStoreNoticeRevisionStale  = errors.New("store notice revision is no longer current")
	ErrStoreNoticeContentEmpty   = errors.New("store notice content cannot be empty")
	ErrStoreNoticeContentTooLong = errors.New("store notice content exceeds 5000 characters")
	ErrStoreNoticeUnsafeContent  = errors.New("store notice content contains unsupported HTML or embedded media")
)

var storeNoticeRawHTMLPattern = regexp.MustCompile(`(?i)</?[a-z][^>]*>`)

type StoreNoticeState struct {
	Id              int    `json:"id" gorm:"primaryKey;autoIncrement:false"`
	CurrentRevision int64  `json:"current_revision" gorm:"bigint;not null"`
	DraftContent    string `json:"draft_content" gorm:"type:text;not null"`
	DraftVersion    int64  `json:"draft_version" gorm:"bigint;not null"`
	DraftUpdatedBy  int    `json:"draft_updated_by" gorm:"index;not null"`
	DraftUpdatedAt  int64  `json:"draft_updated_at" gorm:"bigint;not null"`
}

type StoreNoticeRevision struct {
	Id          int    `json:"id"`
	Revision    int64  `json:"revision" gorm:"uniqueIndex;bigint;not null"`
	Content     string `json:"content" gorm:"type:text;not null"`
	ContentHash string `json:"content_hash" gorm:"type:char(64);not null"`
	Summary     string `json:"summary" gorm:"type:varchar(255);not null"`
	PublishedBy int    `json:"published_by" gorm:"index;not null"`
	PublishedAt int64  `json:"published_at" gorm:"bigint;index;not null"`
}

type StoreNoticeDismissal struct {
	Id          int   `json:"id"`
	UserId      int   `json:"user_id" gorm:"uniqueIndex:idx_store_notice_dismissal;index;not null"`
	Revision    int64 `json:"revision" gorm:"uniqueIndex:idx_store_notice_dismissal;bigint;index;not null"`
	DismissedAt int64 `json:"dismissed_at" gorm:"bigint;not null"`
}

type StoreNoticeView struct {
	Published   bool   `json:"published"`
	Revision    int64  `json:"revision"`
	Content     string `json:"content"`
	PublishedAt int64  `json:"published_at"`
	Dismissed   bool   `json:"dismissed"`
}

type StoreNoticeAdminView struct {
	CurrentRevision int64  `json:"current_revision"`
	CurrentContent  string `json:"current_content"`
	PublishedAt     int64  `json:"published_at"`
	DraftContent    string `json:"draft_content"`
	DraftVersion    int64  `json:"draft_version"`
	DraftUpdatedBy  int    `json:"draft_updated_by"`
	DraftUpdatedAt  int64  `json:"draft_updated_at"`
}

func validateStoreNoticeDraft(content string) error {
	if utf8.RuneCountInString(content) > StoreNoticeMaxCharacters {
		return ErrStoreNoticeContentTooLong
	}
	return nil
}

func validateStoreNoticePublication(content string) error {
	if err := validateStoreNoticeDraft(content); err != nil {
		return err
	}
	if strings.TrimSpace(content) == "" {
		return ErrStoreNoticeContentEmpty
	}
	if storeNoticeRawHTMLPattern.MatchString(content) || strings.Contains(content, "![") {
		return ErrStoreNoticeUnsafeContent
	}
	return nil
}

func storeNoticeDigest(content string) string {
	digest := sha256.Sum256([]byte(content))
	return hex.EncodeToString(digest[:])
}

func storeNoticeSummary(content string) string {
	fields := strings.Fields(content)
	runes := []rune(strings.Join(fields, " "))
	if len(runes) > 120 {
		runes = append(runes[:120], '…')
	}
	return string(runes)
}

func getStoreNoticeState(tx *gorm.DB) (StoreNoticeState, error) {
	var state StoreNoticeState
	result := tx.Where("id = ?", 1).Limit(1).Find(&state)
	return state, result.Error
}

func ensureStoreNoticeState(tx *gorm.DB) (StoreNoticeState, error) {
	state := StoreNoticeState{Id: 1}
	if err := tx.Where("id = ?", 1).FirstOrCreate(&state).Error; err != nil {
		return StoreNoticeState{}, err
	}
	return state, nil
}

func GetStoreNoticeForUser(userId int) (*StoreNoticeView, error) {
	state, err := getStoreNoticeState(DB)
	if err != nil {
		return nil, err
	}
	if state.CurrentRevision <= 0 {
		return &StoreNoticeView{}, nil
	}
	var revision StoreNoticeRevision
	if err := DB.Where("revision = ?", state.CurrentRevision).First(&revision).Error; err != nil {
		return nil, err
	}
	var dismissalCount int64
	if err := DB.Model(&StoreNoticeDismissal{}).
		Where("user_id = ? AND revision = ?", userId, revision.Revision).
		Count(&dismissalCount).Error; err != nil {
		return nil, err
	}
	return &StoreNoticeView{
		Published: true, Revision: revision.Revision, Content: revision.Content,
		PublishedAt: revision.PublishedAt, Dismissed: dismissalCount > 0,
	}, nil
}

func GetStoreNoticeAdmin() (*StoreNoticeAdminView, error) {
	state, err := getStoreNoticeState(DB)
	if err != nil {
		return nil, err
	}
	view := &StoreNoticeAdminView{
		CurrentRevision: state.CurrentRevision,
		DraftContent:    state.DraftContent, DraftVersion: state.DraftVersion,
		DraftUpdatedBy: state.DraftUpdatedBy, DraftUpdatedAt: state.DraftUpdatedAt,
	}
	if state.CurrentRevision <= 0 {
		return view, nil
	}
	var revision StoreNoticeRevision
	if err := DB.Where("revision = ?", state.CurrentRevision).First(&revision).Error; err != nil {
		return nil, err
	}
	view.CurrentContent = revision.Content
	view.PublishedAt = revision.PublishedAt
	return view, nil
}

func SaveStoreNoticeDraft(operatorId int, content string, expectedDraftVersion int64) (*StoreNoticeAdminView, error) {
	if err := validateStoreNoticeDraft(content); err != nil {
		return nil, err
	}
	now := time.Now().Unix()
	err := DB.Transaction(func(tx *gorm.DB) error {
		state, err := ensureStoreNoticeState(tx)
		if err != nil {
			return err
		}
		if state.DraftVersion != expectedDraftVersion {
			return ErrStoreNoticeConflict
		}
		result := tx.Model(&StoreNoticeState{}).
			Where("id = ? AND draft_version = ?", 1, expectedDraftVersion).
			Updates(map[string]interface{}{
				"draft_content": content, "draft_version": expectedDraftVersion + 1,
				"draft_updated_by": operatorId, "draft_updated_at": now,
			})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return ErrStoreNoticeConflict
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return GetStoreNoticeAdmin()
}

func PublishStoreNotice(operatorId int, expectedRevision int64, expectedDraftVersion int64) (*StoreNoticeRevision, error) {
	var published StoreNoticeRevision
	err := DB.Transaction(func(tx *gorm.DB) error {
		state, err := ensureStoreNoticeState(tx)
		if err != nil {
			return err
		}
		if state.CurrentRevision != expectedRevision || state.DraftVersion != expectedDraftVersion {
			return ErrStoreNoticeConflict
		}
		if err := validateStoreNoticePublication(state.DraftContent); err != nil {
			return err
		}
		now := time.Now().Unix()
		published = StoreNoticeRevision{
			Revision: expectedRevision + 1, Content: state.DraftContent,
			ContentHash: storeNoticeDigest(state.DraftContent), Summary: storeNoticeSummary(state.DraftContent),
			PublishedBy: operatorId, PublishedAt: now,
		}
		if err := tx.Create(&published).Error; err != nil {
			return err
		}
		result := tx.Model(&StoreNoticeState{}).
			Where("id = ? AND current_revision = ? AND draft_version = ?", 1, expectedRevision, expectedDraftVersion).
			Updates(map[string]interface{}{
				"current_revision": published.Revision, "draft_version": expectedDraftVersion + 1,
				"draft_updated_by": operatorId, "draft_updated_at": now,
			})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return ErrStoreNoticeConflict
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &published, nil
}

func DismissStoreNotice(userId int, revision int64) error {
	if userId <= 0 || revision <= 0 {
		return ErrStoreNoticeRevisionStale
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		state, err := getStoreNoticeState(lockForUpdate(tx))
		if err != nil {
			return err
		}
		if state.CurrentRevision <= 0 {
			return ErrStoreNoticeNotPublished
		}
		if state.CurrentRevision != revision {
			return ErrStoreNoticeRevisionStale
		}
		dismissal := StoreNoticeDismissal{UserId: userId, Revision: revision, DismissedAt: time.Now().Unix()}
		return tx.Where("user_id = ? AND revision = ?", userId, revision).FirstOrCreate(&dismissal).Error
	})
}
