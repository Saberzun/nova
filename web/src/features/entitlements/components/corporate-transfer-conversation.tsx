import { Building2, Landmark } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import {
  corporateTicketParticipantKey,
  corporateTransferLocalizedText,
  partitionCorporateTicketAttachments,
  type CorporateTicketViewerRole,
} from '../corporate-transfer-conversation'
import { corporateTransferStatusKey } from '../corporate-transfer-status'
import { formatDate } from '../lib'
import type {
  CorporateCollectionChannel,
  CorporateCollectionSnapshot,
  CorporateTransferApplication,
  SupportTicketMessage,
} from '../types'
import { AuthenticatedCorporateImage } from './authenticated-corporate-image'

export function CollectionChannelCard(props: {
  channel: CorporateCollectionChannel
}) {
  const { t } = useTranslation()
  if (props.channel.channel_type === 'enterprise_wechat') {
    return (
      <div className='bg-background space-y-4 rounded-xl border p-4'>
        <div className='flex items-center gap-2 font-medium'>
          <Building2 className='size-5' aria-hidden='true' />
          {props.channel.organization_name}
        </div>
        {props.channel.qr_code_attachment_id ? (
          <AuthenticatedCorporateImage
            path={`/api/store/corporate-transfers/collection-assets/${props.channel.qr_code_attachment_id}`}
            alt={t('Enterprise WeChat collection QR code')}
            className='mx-auto max-h-60 max-w-full rounded-xl border object-contain'
          />
        ) : null}
        {props.channel.instructions ? (
          <p className='text-muted-foreground text-sm whitespace-pre-wrap'>
            {props.channel.instructions}
          </p>
        ) : null}
      </div>
    )
  }
  return (
    <div className='bg-background space-y-3 rounded-xl border p-4'>
      <div className='flex items-center gap-2 font-medium'>
        <Landmark className='size-5' aria-hidden='true' />
        {props.channel.organization_name}
      </div>
      <div className='bg-muted/50 rounded-lg p-3 text-sm whitespace-pre-wrap'>
        {[
          [t('Account name'), props.channel.account_name],
          [t('Bank name'), props.channel.bank_name],
          [t('Bank account'), props.channel.bank_account],
          [t('Bank branch'), props.channel.bank_branch],
        ]
          .filter(([, value]) => value)
          .map(([label, value]) => `${label}: ${value}`)
          .join('\n')}
      </div>
      {props.channel.instructions ? (
        <p className='text-muted-foreground text-sm whitespace-pre-wrap'>
          {props.channel.instructions}
        </p>
      ) : null}
    </div>
  )
}

export function CorporateTransferPaymentPrompt(props: {
  application: CorporateTransferApplication
  collection: CorporateCollectionSnapshot
  collectionOutdated?: boolean
  terminal: boolean
  evidenceAction?: ReactNode
}) {
  const { t } = useTranslation()
  const channels = props.collection.channels.filter(
    (channel) => channel.enabled
  )
  const order = props.application.order
  return (
    <Card className='border-primary/20 bg-primary/[0.02]'>
      <CardHeader className='pb-3'>
        <CardTitle className='text-base'>{t('Payment application')}</CardTitle>
        <p className='text-muted-foreground text-sm'>
          {t(
            'Please verify the order details and complete the transfer before uploading payment evidence.'
          )}
        </p>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='bg-background grid gap-3 rounded-xl border p-4 text-sm sm:grid-cols-2'>
          <div className='sm:col-span-2'>
            <p className='text-muted-foreground text-xs'>{t('Product')}</p>
            <p className='mt-1 font-medium'>
              {order?.items
                ?.map((item) => item.sku_name || item.product_name)
                .join(', ') || '—'}
            </p>
          </div>
          <div>
            <p className='text-muted-foreground text-xs'>{t('Order number')}</p>
            <p className='mt-1 font-mono'>{order?.order_no || '—'}</p>
          </div>
          <div>
            <p className='text-muted-foreground text-xs'>
              {t('Application number')}
            </p>
            <p className='mt-1 font-mono'>{props.application.application_no}</p>
          </div>
          <div>
            <p className='text-muted-foreground text-xs'>{t('Status')}</p>
            <Badge className='mt-1' variant='secondary'>
              {t(corporateTransferStatusKey(props.application.status))}
            </Badge>
          </div>
          <div>
            <p className='text-muted-foreground text-xs'>{t('Cash payable')}</p>
            <p className='mt-1 font-semibold'>
              {new Intl.NumberFormat(undefined, {
                style: 'currency',
                currency: 'CNY',
              }).format((order?.cash_payable_cents ?? 0) / 100)}
            </p>
          </div>
        </div>
        {props.collectionOutdated && !props.terminal ? (
          <p className='rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-300'>
            {t(
              'Collection information has changed since this application was created. Confirm with an administrator before paying.'
            )}
          </p>
        ) : null}
        {props.terminal ? (
          <p className='border-destructive/40 bg-destructive/5 text-destructive rounded-xl border p-3 text-sm font-medium'>
            {t(
              'This application is closed. The collection information is retained for audit only; do not transfer money to it.'
            )}
          </p>
        ) : null}
        {channels.length > 0 ? (
          <Tabs defaultValue={channels[0].channel_type}>
            <TabsList className='w-full justify-start'>
              {channels.map((channel) => (
                <TabsTrigger
                  key={channel.channel_type}
                  value={channel.channel_type}
                >
                  {channel.channel_type === 'enterprise_wechat'
                    ? t('Enterprise WeChat')
                    : t('Bank transfer')}
                </TabsTrigger>
              ))}
            </TabsList>
            {channels.map((channel) => (
              <TabsContent
                key={channel.channel_type}
                value={channel.channel_type}
                className='pt-3'
              >
                <CollectionChannelCard channel={channel} />
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <p className='rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-300'>
            {t(
              'No usable collection channel is available for this application.'
            )}
          </p>
        )}
        {props.evidenceAction}
      </CardContent>
    </Card>
  )
}

export function CorporateTransferMessageList(props: {
  messages: SupportTicketMessage[]
  viewerRole: CorporateTicketViewerRole
  application?: CorporateTransferApplication
}) {
  const { t } = useTranslation()
  return (
    <div className='space-y-4'>
      {props.messages.map((message) => {
        const mine = message.sender_role === props.viewerRole
        const attachments = partitionCorporateTicketAttachments(
          message.attachments
        )
        const label = t(
          corporateTicketParticipantKey(message, props.viewerRole)
        )
        const localizedBody = corporateTransferLocalizedText(message.body)
        let bubbleClassName = 'bg-muted'
        if (mine) {
          bubbleClassName = 'bg-primary text-primary-foreground'
        }
        if (message.internal) {
          bubbleClassName =
            'border border-amber-500/40 bg-amber-500/10 text-foreground'
        }
        return (
          <div
            key={message.id}
            className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`w-full max-w-[85%] space-y-2 rounded-2xl px-4 py-3 ${bubbleClassName}`}
            >
              <div className='flex items-center justify-between gap-3 text-xs opacity-75'>
                <span>{label}</span>
                <span>{formatDate(message.created_at)}</span>
              </div>
              {message.body ? (
                <p className='text-sm whitespace-pre-wrap'>
                  {localizedBody
                    ? t(localizedBody.key, localizedBody.values)
                    : message.body}
                </p>
              ) : null}
              {attachments.evidence.length > 0 ? (
                <div className='bg-background text-foreground space-y-3 rounded-xl border p-3'>
                  <div>
                    <p className='font-medium'>
                      {t('Payment evidence submitted')}
                    </p>
                    <p className='text-muted-foreground mt-1 text-xs'>
                      {t(
                        corporateTransferStatusKey(
                          props.application?.status ?? 'under_review'
                        )
                      )}
                    </p>
                  </div>
                  <dl className='grid gap-2 text-xs sm:grid-cols-2'>
                    <div>
                      <dt className='text-muted-foreground'>
                        {t('Order number')}
                      </dt>
                      <dd className='font-mono'>
                        {props.application?.order?.order_no || '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className='text-muted-foreground'>
                        {t('Uploaded by')}
                      </dt>
                      <dd>{label}</dd>
                    </div>
                    <div>
                      <dt className='text-muted-foreground'>
                        {t('Uploaded at')}
                      </dt>
                      <dd>{formatDate(message.created_at)}</dd>
                    </div>
                  </dl>
                  <div className='grid gap-2 sm:grid-cols-2'>
                    {attachments.evidence.map((attachment) => (
                      <AuthenticatedCorporateImage
                        key={attachment.id}
                        path={`/api/store/corporate-transfers/attachments/${attachment.id}`}
                        alt={attachment.original_name}
                        className='max-h-56 w-full rounded-lg border bg-black/5 object-contain'
                        openOriginal
                      />
                    ))}
                  </div>
                </div>
              ) : null}
              {attachments.replies.length > 0 ? (
                <div className='grid gap-2 sm:grid-cols-2'>
                  {attachments.replies.map((attachment) => (
                    <AuthenticatedCorporateImage
                      key={attachment.id}
                      path={`/api/store/corporate-transfers/attachments/${attachment.id}`}
                      alt={attachment.original_name}
                      className='max-h-56 w-full rounded-lg border bg-black/5 object-contain'
                      openOriginal
                    />
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        )
      })}
      {props.messages.length === 0 ? (
        <p className='text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm'>
          {t('No messages yet')}
        </p>
      ) : null}
    </div>
  )
}

export function CorporateTransferReviewResult(props: {
  application: CorporateTransferApplication
}) {
  const { t } = useTranslation()
  const localizedReason = corporateTransferLocalizedText(
    props.application.user_visible_reason
  )
  if (
    props.application.status === 'awaiting_evidence' ||
    props.application.status === 'under_review'
  ) {
    return null
  }
  return (
    <div className='flex justify-start'>
      <Card className='border-primary/20 w-full max-w-[85%]'>
        <CardHeader className='pb-3'>
          <CardTitle className='text-base'>{t('Review result')}</CardTitle>
        </CardHeader>
        <CardContent className='space-y-2 text-sm'>
          <div className='flex items-center justify-between gap-3'>
            <span className='text-muted-foreground'>{t('Status')}</span>
            <Badge variant='secondary'>
              {t(corporateTransferStatusKey(props.application.status))}
            </Badge>
          </div>
          {props.application.user_visible_reason ? (
            <p className='bg-muted/50 rounded-lg p-3 whitespace-pre-wrap'>
              {localizedReason
                ? t(localizedReason.key, localizedReason.values)
                : props.application.user_visible_reason}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
