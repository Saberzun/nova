package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func resetStoreNoticeFixtures(t *testing.T) {
	t.Helper()
	require.NoError(t, DB.AutoMigrate(&StoreNoticeState{}, &StoreNoticeRevision{}, &StoreNoticeDismissal{}))
	tables := []interface{}{&StoreNoticeDismissal{}, &StoreNoticeRevision{}, &StoreNoticeState{}}
	for _, table := range tables {
		require.NoError(t, DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Unscoped().Delete(table).Error)
	}
	t.Cleanup(func() {
		for _, table := range tables {
			_ = DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Unscoped().Delete(table).Error
		}
	})
}

func TestStoreNoticePublicationAndAccountDismissalFollowRevision(t *testing.T) {
	resetStoreNoticeFixtures(t)

	view, err := GetStoreNoticeForUser(101)
	require.NoError(t, err)
	assert.False(t, view.Published)

	admin, err := SaveStoreNoticeDraft(1, "# 使用须知\n\n请先了解分组规则。", 0)
	require.NoError(t, err)
	assert.EqualValues(t, 1, admin.DraftVersion)
	first, err := PublishStoreNotice(1, 0, admin.DraftVersion)
	require.NoError(t, err)
	assert.EqualValues(t, 1, first.Revision)
	assert.Len(t, first.ContentHash, 64)

	view, err = GetStoreNoticeForUser(101)
	require.NoError(t, err)
	assert.True(t, view.Published)
	assert.False(t, view.Dismissed)
	assert.Equal(t, first.Content, view.Content)

	require.NoError(t, DismissStoreNotice(101, first.Revision))
	require.NoError(t, DismissStoreNotice(101, first.Revision))
	view, err = GetStoreNoticeForUser(101)
	require.NoError(t, err)
	assert.True(t, view.Dismissed)

	admin, err = GetStoreNoticeAdmin()
	require.NoError(t, err)
	admin, err = SaveStoreNoticeDraft(2, "# 新须知\n\n规则已经更新。", admin.DraftVersion)
	require.NoError(t, err)
	second, err := PublishStoreNotice(2, first.Revision, admin.DraftVersion)
	require.NoError(t, err)
	assert.EqualValues(t, 2, second.Revision)

	view, err = GetStoreNoticeForUser(101)
	require.NoError(t, err)
	assert.False(t, view.Dismissed)
	assert.EqualValues(t, 2, view.Revision)
	var revisionCount int64
	require.NoError(t, DB.Model(&StoreNoticeRevision{}).Count(&revisionCount).Error)
	assert.EqualValues(t, 2, revisionCount)
}

func TestStoreNoticeRejectsStaleAndInvalidPublication(t *testing.T) {
	resetStoreNoticeFixtures(t)

	admin, err := SaveStoreNoticeDraft(1, "", 0)
	require.NoError(t, err)
	_, err = PublishStoreNotice(1, 0, admin.DraftVersion)
	assert.ErrorIs(t, err, ErrStoreNoticeContentEmpty)

	_, err = SaveStoreNoticeDraft(1, strings.Repeat("界", StoreNoticeMaxCharacters+1), admin.DraftVersion)
	assert.ErrorIs(t, err, ErrStoreNoticeContentTooLong)
	require.NoError(t, DB.Model(&StoreNoticeState{}).Where("id = ?", 1).Updates(map[string]interface{}{
		"draft_content": "<script>alert(1)</script>", "draft_version": admin.DraftVersion + 1,
	}).Error)
	_, err = PublishStoreNotice(1, 0, admin.DraftVersion+1)
	assert.ErrorIs(t, err, ErrStoreNoticeUnsafeContent)

	admin, err = SaveStoreNoticeDraft(1, "有效内容", admin.DraftVersion+1)
	require.NoError(t, err)
	_, err = SaveStoreNoticeDraft(2, "覆盖内容", admin.DraftVersion-1)
	assert.ErrorIs(t, err, ErrStoreNoticeConflict)
	_, err = PublishStoreNotice(1, 1, admin.DraftVersion)
	assert.ErrorIs(t, err, ErrStoreNoticeConflict)
	require.ErrorIs(t, DismissStoreNotice(100, 99), ErrStoreNoticeNotPublished)
}
