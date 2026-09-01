import assert from 'node:assert/strict'
import { test } from 'node:test'

import { formatAccessGroupLabel } from '../store-catalog'

test('formats configured access group ratios for the store', () => {
  assert.equal(
    formatAccessGroupLabel('gpt-mix-sub', { 'gpt-mix-sub': 1.3 }),
    'gpt-mix-sub x1.3'
  )
  assert.equal(
    formatAccessGroupLabel('gpt-pro-paygo', { 'gpt-pro-paygo': 0.3 }),
    'gpt-pro-paygo x0.3'
  )
})

test('keeps groups readable when a ratio is unavailable', () => {
  assert.equal(formatAccessGroupLabel('custom-group', {}), 'custom-group')
})
