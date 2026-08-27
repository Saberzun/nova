/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'node:test'

import { BUSINESS_BRAND } from '../business-brand'

function readPngSize(path: string): [number, number] {
  const image = readFileSync(path)
  assert.deepEqual(
    [...image.subarray(0, 8)],
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  )
  return [image.readUInt32BE(16), image.readUInt32BE(20)]
}

describe('itokenify business brand', () => {
  test('uses the supplied PNG logo asset', () => {
    assert.equal(BUSINESS_BRAND.logo, '/itokenify-logo.png')

    const logo = readFileSync('public/itokenify-logo.png')
    assert.deepEqual(
      [...logo.subarray(0, 8)],
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
    )
  })

  test('publishes the itokenify favicon for desktop and mobile browsers', () => {
    const html = readFileSync('index.html', 'utf8')
    const defaultFavicon = readFileSync('public/favicon.ico')
    const brandedFavicon = readFileSync('public/itokenify-tab.ico')

    assert.match(html, /rel="icon"[^>]+href="\/favicon\.ico\?v=itokenify-/)
    assert.match(
      html,
      /rel="icon"[^>]+type="image\/png"[^>]+sizes="32x32"[^>]+href="\/favicon-32x32\.png\?v=itokenify-/
    )
    assert.match(
      html,
      /rel="apple-touch-icon"[^>]+sizes="180x180"[^>]+href="\/apple-touch-icon\.png\?v=itokenify-/
    )
    assert.match(html, /rel="manifest"[^>]+href="\/site-manifest\.json\?v=/)
    assert.deepEqual(defaultFavicon, brandedFavicon)
    assert.deepEqual(readPngSize('public/favicon-32x32.png'), [32, 32])
    assert.deepEqual(readPngSize('public/apple-touch-icon.png'), [180, 180])
    assert.deepEqual(
      readPngSize('public/android-chrome-192x192.png'),
      [192, 192]
    )
    assert.deepEqual(
      readPngSize('public/android-chrome-512x512.png'),
      [512, 512]
    )
  })
})
