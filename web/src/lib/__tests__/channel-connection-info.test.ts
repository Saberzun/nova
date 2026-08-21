/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import {
  buildCCSwitchImportUrl,
  encodeChannelConnectionInfoFromStatus,
} from '../channel-connection-info'

const productionStatus = {
  api_base_url: 'https://api.itokenify.com/',
  server_address: 'http://localhost:3000',
}

describe('API connection information', () => {
  test('copy connection info uses the configured public API address', () => {
    assert.equal(
      encodeChannelConnectionInfoFromStatus(
        'sk-test',
        productionStatus,
        'https://itokenify.com'
      ),
      JSON.stringify({
        _type: 'newapi_channel_conn',
        key: 'sk-test',
        url: 'https://api.itokenify.com',
      })
    )
  })

  test('CC Switch uses the API address for requests and the site address for its homepage', () => {
    const importUrl = buildCCSwitchImportUrl({
      app: 'codex',
      name: 'My Codex',
      models: { model: 'gpt-5.4' },
      apiKey: 'sk-test',
      status: productionStatus,
      currentOrigin: 'https://itokenify.com',
    })
    const url = new URL(importUrl)

    assert.equal(url.protocol, 'ccswitch:')
    assert.equal(url.hostname, 'v1')
    assert.equal(url.pathname, '/import')
    assert.equal(
      url.searchParams.get('endpoint'),
      'https://api.itokenify.com/v1'
    )
    assert.equal(url.searchParams.get('homepage'), 'https://itokenify.com')
    assert.equal(url.searchParams.get('apiKey'), 'sk-test')
    assert.equal(url.searchParams.get('model'), 'gpt-5.4')
  })
})
