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
import { Check, Copy, Globe2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { useStatus } from '@/hooks/use-status'

const DEFAULT_API_BASE_URL = 'https://api.itokenify.com'

function normalizeApiBaseUrl(value: unknown): string {
  if (typeof value !== 'string' || !/^https?:\/\//i.test(value)) {
    return DEFAULT_API_BASE_URL
  }
  return value.replace(/\/+$/, '') || DEFAULT_API_BASE_URL
}

export function ApiBaseUrlPanel() {
  const { t } = useTranslation()
  const { status } = useStatus()
  const apiBaseUrl = normalizeApiBaseUrl(
    status?.api_base_url ?? status?.data?.api_base_url
  )
  const { copiedText, copyToClipboard } = useCopyToClipboard({
    successMessage: t('Base URL copied'),
  })
  const isCopied = copiedText === apiBaseUrl

  return (
    <div className='h-full overflow-auto py-1'>
      <div className='max-w-3xl space-y-4'>
        <div>
          <h3 className='text-lg font-semibold'>Base URL</h3>
          <p className='text-muted-foreground mt-1 text-sm'>
            {t('Use the following address as the API endpoint in your client.')}
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className='flex items-start gap-3'>
              <div className='bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg'>
                <Globe2 className='size-5' />
              </div>
              <div className='min-w-0'>
                <CardTitle>{t('itokenify API')}</CardTitle>
                <CardDescription>
                  {t('Recommended API endpoint')}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className='space-y-3'>
            <div className='bg-muted/60 flex items-center gap-2 rounded-lg border px-3 py-2.5'>
              <code className='min-w-0 flex-1 overflow-x-auto text-sm font-medium whitespace-nowrap'>
                {apiBaseUrl}
              </code>
              <Button
                type='button'
                variant='outline'
                size='sm'
                className='shrink-0 gap-1.5'
                onClick={() => copyToClipboard(apiBaseUrl)}
              >
                {isCopied ? (
                  <Check className='text-success size-4' />
                ) : (
                  <Copy className='size-4' />
                )}
                {isCopied ? t('Copied') : t('Copy')}
              </Button>
            </div>
            <p className='text-muted-foreground text-sm'>
              {t(
                'For OpenAI-compatible clients, the API path is usually Base URL plus /v1.'
              )}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
