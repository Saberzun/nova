package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestGroupColumnsAllowLongGroupNames(t *testing.T) {
	statement := &gorm.Statement{DB: DB}
	require.NoError(t, statement.Parse(&Channel{}))
	field := statement.Schema.LookUpField("Group")
	require.NotNil(t, field)
	assert.Equal(t, "varchar(255)", field.TagSettings["TYPE"])
}
