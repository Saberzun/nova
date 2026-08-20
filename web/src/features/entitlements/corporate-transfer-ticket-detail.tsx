import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Building2, ImagePlus, Landmark } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { SectionPageLayout } from '@/components/layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'

import {
  cancelCorporateTransfer,
  getCorporateTransferTicket,
  replyCorporateTransferTicket,
  uploadCorporateTransferEvidence,
} from './api'
import { AuthenticatedCorporateImage } from './components/authenticated-corporate-image'
import {
  corporateTransferIsTerminal,
  corporateTransferStatusKey,
} from './corporate-transfer-status'
import { formatDate } from './lib'
import type { CorporateCollectionChannel } from './types'

interface CorporateTransferTicketDetailProps {
  ticketNo: string
}

function CollectionChannelCard(props: { channel: CorporateCollectionChannel }) {
  const { t } = useTranslation()
  if (props.channel.channel_type === 'enterprise_wechat') {
    return (
      <div className='space-y-4 rounded-xl border p-5'>
        <div className='flex items-center gap-2 font-medium'>
          <Building2 className='size-5' />
          {props.channel.organization_name}
        </div>
        {props.channel.qr_code_attachment_id ? (
          <AuthenticatedCorporateImage
            path={`/api/store/corporate-transfers/collection-assets/${props.channel.qr_code_attachment_id}`}
            alt={t('Enterprise WeChat collection QR code')}
            className='mx-auto max-h-96 max-w-full rounded-xl border object-contain'
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
    <div className='space-y-3 rounded-xl border p-5'>
      <div className='flex items-center gap-2 font-medium'>
        <Landmark className='size-5' />
        {props.channel.organization_name}
      </div>
      <dl className='grid gap-3 text-sm sm:grid-cols-2'>
        <div>
          <dt className='text-muted-foreground'>{t('Account name')}</dt>
          <dd className='mt-1 font-medium'>{props.channel.account_name}</dd>
        </div>
        <div>
          <dt className='text-muted-foreground'>{t('Bank name')}</dt>
          <dd className='mt-1 font-medium'>{props.channel.bank_name}</dd>
        </div>
        <div>
          <dt className='text-muted-foreground'>{t('Bank account')}</dt>
          <dd className='mt-1 font-mono font-medium'>
            {props.channel.bank_account}
          </dd>
        </div>
        <div>
          <dt className='text-muted-foreground'>{t('Bank branch')}</dt>
          <dd className='mt-1 font-medium'>
            {props.channel.bank_branch || '—'}
          </dd>
        </div>
      </dl>
      {props.channel.instructions ? (
        <p className='text-muted-foreground text-sm whitespace-pre-wrap'>
          {props.channel.instructions}
        </p>
      ) : null}
    </div>
  )
}

export function CorporateTransferTicketDetail(
  props: CorporateTransferTicketDetailProps
) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [files, setFiles] = useState<File[]>([])
  const [reply, setReply] = useState('')
  const detail = useQuery({
    queryKey: ['corporate-transfer', 'ticket', props.ticketNo],
    queryFn: () => getCorporateTransferTicket(props.ticketNo),
  })
  const application = detail.data?.data?.application
  const enabledChannels = useMemo(
    () =>
      detail.data?.data?.collection.channels.filter(
        (channel) => channel.enabled
      ) ?? [],
    [detail.data?.data?.collection.channels]
  )
  const refresh = async () => {
    await queryClient.invalidateQueries({
      queryKey: ['corporate-transfer', 'ticket', props.ticketNo],
    })
    await queryClient.invalidateQueries({
      queryKey: ['corporate-transfer', 'tickets'],
    })
  }
  const upload = useMutation({
    mutationFn: async () => {
      if (!application) throw new Error(t('Ticket is unavailable'))
      const response = await uploadCorporateTransferEvidence(
        application.application_no,
        files
      )
      if (!response.success) {
        throw new Error(response.message || t('Upload failed'))
      }
    },
    onSuccess: async () => {
      setFiles([])
      await refresh()
      toast.success(t('Payment evidence submitted'))
    },
    onError: (error) => toast.error(error.message),
  })
  const sendReply = useMutation({
    mutationFn: async () => {
      if (!application) throw new Error(t('Ticket is unavailable'))
      const response = await replyCorporateTransferTicket(
        application.application_no,
        reply
      )
      if (!response.success) {
        throw new Error(response.message || t('Reply failed'))
      }
    },
    onSuccess: async () => {
      setReply('')
      await refresh()
    },
    onError: (error) => toast.error(error.message),
  })
  const cancel = useMutation({
    mutationFn: async () => {
      if (
        !application ||
        !window.confirm(t('I confirm that I have not paid'))
      ) {
        return
      }
      const response = await cancelCorporateTransfer(application.application_no)
      if (!response.success) {
        throw new Error(response.message || t('Operation failed'))
      }
    },
    onSuccess: refresh,
    onError: (error) => toast.error(error.message),
  })

  if (!application || !detail.data?.data) {
    return (
      <SectionPageLayout>
        <SectionPageLayout.Title>{t('Ticket')}</SectionPageLayout.Title>
        <SectionPageLayout.Content>
          <p className='text-muted-foreground'>
            {detail.isPending ? t('Loading...') : t('Ticket not found')}
          </p>
        </SectionPageLayout.Content>
      </SectionPageLayout>
    )
  }
  const canUpload =
    application.status === 'awaiting_evidence' ||
    application.status === 'needs_more_information'
  const canReply = !corporateTransferIsTerminal(application.status)

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>
        {detail.data.data.ticket.subject}
      </SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <Button variant='outline' onClick={() => navigate({ to: '/tickets' })}>
          {t('Back to tickets')}
        </Button>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <div className='mx-auto max-w-5xl space-y-5'>
          <Card>
            <CardContent className='grid gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-4'>
              <div>
                <p className='text-muted-foreground text-xs'>
                  {t('Application number')}
                </p>
                <p className='mt-1 font-mono text-sm'>
                  {application.application_no}
                </p>
              </div>
              <div>
                <p className='text-muted-foreground text-xs'>
                  {t('Order number')}
                </p>
                <p className='mt-1 font-mono text-sm'>
                  {application.order?.order_no}
                </p>
              </div>
              <div>
                <p className='text-muted-foreground text-xs'>{t('Status')}</p>
                <Badge className='mt-1' variant='secondary'>
                  {t(corporateTransferStatusKey(application.status))}
                </Badge>
              </div>
              <div>
                <p className='text-muted-foreground text-xs'>
                  {t('Cash payable')}
                </p>
                <p className='mt-1 font-semibold'>
                  {new Intl.NumberFormat(undefined, {
                    style: 'currency',
                    currency: 'CNY',
                  }).format((application.order?.cash_payable_cents ?? 0) / 100)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('Payment channels')}</CardTitle>
            </CardHeader>
            <CardContent>
              {detail.data.data.collection_outdated &&
              !corporateTransferIsTerminal(application.status) ? (
                <p className='mb-4 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-300'>
                  {t(
                    'Collection information has changed since this application was created. Confirm with an administrator before paying.'
                  )}
                </p>
              ) : null}
              {corporateTransferIsTerminal(application.status) ? (
                <p className='border-destructive/40 bg-destructive/5 text-destructive mb-4 rounded-xl border p-3 text-sm font-medium'>
                  {t(
                    'This application is closed. The collection information is retained for audit only; do not transfer money to it.'
                  )}
                </p>
              ) : null}
              <Tabs defaultValue={enabledChannels[0]?.channel_type}>
                <TabsList>
                  {enabledChannels.map((channel) => (
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
                {enabledChannels.map((channel) => (
                  <TabsContent
                    key={channel.channel_type}
                    value={channel.channel_type}
                    className='pt-4'
                  >
                    <CollectionChannelCard channel={channel} />
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('Payment evidence and messages')}</CardTitle>
            </CardHeader>
            <CardContent className='space-y-5'>
              {detail.data.data.messages.map((message) => (
                <div key={message.id} className='rounded-xl border p-4'>
                  <div className='flex items-center justify-between gap-3'>
                    <Badge variant='outline'>{t(message.sender_role)}</Badge>
                    <span className='text-muted-foreground text-xs'>
                      {formatDate(message.created_at)}
                    </span>
                  </div>
                  {message.body ? (
                    <p className='mt-3 text-sm whitespace-pre-wrap'>
                      {message.body}
                    </p>
                  ) : null}
                  {(message.attachments ?? []).length > 0 ? (
                    <div className='mt-4 grid gap-4 sm:grid-cols-2'>
                      {message.attachments?.map((attachment) => (
                        <AuthenticatedCorporateImage
                          key={attachment.id}
                          path={`/api/store/corporate-transfers/attachments/${attachment.id}`}
                          alt={attachment.original_name}
                          className='max-h-[560px] w-full rounded-xl border bg-black/5 object-contain'
                          openOriginal
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
              {canUpload ? (
                <div className='rounded-xl border border-dashed p-4'>
                  <label className='flex cursor-pointer items-center gap-3 font-medium'>
                    <ImagePlus className='size-5' />
                    {t('Select payment evidence')}
                    <input
                      className='sr-only'
                      type='file'
                      accept='image/jpeg,image/png,image/webp'
                      multiple
                      onChange={(event) =>
                        setFiles([...(event.target.files ?? [])].slice(0, 5))
                      }
                    />
                  </label>
                  <p className='text-muted-foreground mt-2 text-xs'>
                    {t('JPEG, PNG or WebP; up to 5 files and 5MB each')}
                  </p>
                  {files.length > 0 ? (
                    <p className='mt-3 text-sm'>
                      {files.map((file) => file.name).join(', ')}
                    </p>
                  ) : null}
                  <Button
                    className='mt-4'
                    disabled={files.length === 0 || upload.isPending}
                    onClick={() => upload.mutate()}
                  >
                    {t('Submit payment evidence')}
                  </Button>
                </div>
              ) : null}
              {canReply ? (
                <div className='space-y-3'>
                  <Textarea
                    value={reply}
                    maxLength={5000}
                    onChange={(event) => setReply(event.target.value)}
                    placeholder={t('Reply to administrator')}
                  />
                  <Button
                    variant='outline'
                    disabled={!reply.trim() || sendReply.isPending}
                    onClick={() => sendReply.mutate()}
                  >
                    {t('Send reply')}
                  </Button>
                </div>
              ) : null}
              {application.status === 'awaiting_evidence' ? (
                <Button
                  variant='destructive'
                  disabled={cancel.isPending}
                  onClick={() => cancel.mutate()}
                >
                  {t('Cancel unpaid application')}
                </Button>
              ) : null}
              {['cancelled', 'expired', 'rejected'].includes(
                application.status
              ) ? (
                <Button
                  variant='outline'
                  onClick={async () => {
                    if (application.order?.order_no) {
                      sessionStorage.setItem(
                        'corporate-transfer-prior-order',
                        application.order.order_no
                      )
                    }
                    await navigate({ to: '/store' })
                  }}
                >
                  {t('Create a new order')}
                </Button>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
