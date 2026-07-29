/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { resolveApiBaseUrl } from '../lib/api-base-url'

describe('home API base URL', () => {
  test('uses the current public origin when the configured address is loopback', () => {
    assert.equal(
      resolveApiBaseUrl('http://localhost:3000', 'https://dev.itokenify.com'),
      'https://dev.itokenify.com'
    )
  })

  test('keeps an explicitly configured public API address', () => {
    assert.equal(
      resolveApiBaseUrl('https://api.itokenify.com/', 'https://itokenify.com'),
      'https://api.itokenify.com'
    )
  })

  test('keeps a loopback address during local development', () => {
    assert.equal(
      resolveApiBaseUrl('http://localhost:3000', 'http://localhost:5173'),
      'http://localhost:3000'
    )
  })
})
