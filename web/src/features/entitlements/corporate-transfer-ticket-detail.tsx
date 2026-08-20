import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { ImagePlus, X } from 'lucide-react'
import { useRef, useState, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'

import {
  cancelCorporateTransfer,
  getCorporateTransferTicket,
  replyCorporateTransferTicket,
  uploadCorporateTransferEvidence,
} from './api'
import {
  CorporateTransferMessageList,
  CorporateTransferPaymentPrompt,
  CorporateTransferReviewResult,
} from './components/corporate-transfer-conversation'
import { CorporateTransferReplyComposer } from './components/corporate-transfer-reply-composer'
import { corporateTransferIsTerminal } from './corporate-transfer-status'

interface CorporateTransferTicketDetailProps {
  ticketNo: string
  embedded?: boolean
}

function EvidenceAction(props: {
  files: File[]
  setFiles: (files: File[]) => void
  inputRef: RefObject<HTMLInputElement | null>
  onSubmit: () => void
  pending: boolean
}) {
  const { t } = useTranslation()
  const addFiles = (incoming: File[]) => {
    props.setFiles(
      [
        ...props.files,
        ...incoming.filter((file) => file.type.startsWith('image/')),
      ].slice(0, 5)
    )
  }
  return (
    <div
      className='rounded-xl border border-dashed p-4'
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault()
        addFiles([...event.dataTransfer.files])
      }}
    >
      <input
        ref={props.inputRef}
        className='sr-only'
        type='file'
        accept='image/jpeg,image/png,image/webp'
        multiple
        onChange={(event) => addFiles([...(event.target.files ?? [])])}
      />
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <p className='font-medium'>{t('Upload payment evidence')}</p>
          <p className='text-muted-foreground mt-1 text-xs'>
            {t(
              'JPEG, PNG or WebP; up to 5 files and 5MB each. You can also drag images here.'
            )}
          </p>
        </div>
        <Button
          type='button'
          variant='outline'
          disabled={props.pending}
          onClick={() => props.inputRef.current?.click()}
        >
          <ImagePlus className='size-4' aria-hidden='true' />
          {t('Choose payment evidence')}
        </Button>
      </div>
      {props.files.length > 0 ? (
        <div className='mt-4 grid gap-2 sm:grid-cols-2'>
          {props.files.map((file, index) => (
            <div
              key={`${file.name}-${file.lastModified}`}
              className='bg-muted/50 flex items-center gap-2 rounded-lg px-3 py-2 text-sm'
            >
              <span className='min-w-0 flex-1 truncate'>{file.name}</span>
              <button
                type='button'
                className='text-muted-foreground hover:text-foreground rounded-md p-1'
                aria-label={t('Remove')}
                onClick={() =>
                  props.setFiles(
                    props.files.filter((_, itemIndex) => itemIndex !== index)
                  )
                }
              >
                <X className='size-4' aria-hidden='true' />
              </button>
            </div>
          ))}
        </div>
      ) : null}
      <Button
        className='mt-4'
        disabled={props.pending || props.files.length === 0}
        onClick={props.onSubmit}
      >
        {t('Submit payment evidence')}
      </Button>
    </div>
  )
}

export function CorporateTransferTicketDetail(
  props: CorporateTransferTicketDetailProps
) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([])
  const [replyFiles, setReplyFiles] = useState<File[]>([])
  const [reply, setReply] = useState('')
  const evidenceInputRef = useRef<HTMLInputElement>(null)
  const detail = useQuery({
    queryKey: ['corporate-transfer', 'ticket', props.ticketNo],
    queryFn: () => getCorporateTransferTicket(props.ticketNo),
  })
  const application = detail.data?.data?.application
  const refresh = async () => {
    await queryClient.invalidateQueries({
      queryKey: ['corporate-transfer', 'ticket', props.ticketNo],
    })
    await queryClient.invalidateQueries({
      queryKey: ['corporate-transfer', 'tickets'],
    })
    await queryClient.invalidateQueries({
      queryKey: ['corporate-transfer', 'unread'],
    })
    await queryClient.invalidateQueries({
      queryKey: ['entitlement-store', 'orders'],
    })
  }
  const upload = useMutation({
    mutationFn: async () => {
      if (!application) {
        throw new Error(t('Ticket is unavailable'))
      }
      const response = await uploadCorporateTransferEvidence(
        application.application_no,
        evidenceFiles
      )
      if (!response.success) {
        throw new Error(response.message || t('Upload failed'))
      }
    },
    onSuccess: async () => {
      setEvidenceFiles([])
      await refresh()
      toast.success(t('Payment evidence submitted'))
    },
    onError: (error) => toast.error(error.message),
  })
  const sendReply = useMutation({
    mutationFn: async () => {
      if (!application) {
        throw new Error(t('Ticket is unavailable'))
      }
      const response = await replyCorporateTransferTicket(
        application.application_no,
        reply,
        replyFiles
      )
      if (!response.success) {
        throw new Error(response.message || t('Reply failed'))
      }
    },
    onSuccess: async () => {
      setReply('')
      setReplyFiles([])
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
    const loadingState = (
      <p className='text-muted-foreground'>
        {detail.isPending ? t('Loading...') : t('Ticket not found')}
      </p>
    )
    if (props.embedded) return loadingState
    return (
      <SectionPageLayout>
        <SectionPageLayout.Title>{t('Ticket')}</SectionPageLayout.Title>
        <SectionPageLayout.Content>{loadingState}</SectionPageLayout.Content>
      </SectionPageLayout>
    )
  }
  const terminal = corporateTransferIsTerminal(application.status)
  const canUpload =
    application.status === 'awaiting_evidence' ||
    application.status === 'needs_more_information'
  const canReply = true
  const composer = canReply ? (
    <CorporateTransferReplyComposer
      value={reply}
      files={replyFiles}
      pending={sendReply.isPending}
      placeholder={t('Reply to administrator')}
      onValueChange={setReply}
      onFilesChange={setReplyFiles}
      onSubmit={() => sendReply.mutate()}
      submitLabel={t('Send reply')}
    />
  ) : null
  const conversation = (
    <div className='space-y-5'>
      <CorporateTransferPaymentPrompt
        application={application}
        collection={detail.data.data.collection}
        collectionOutdated={detail.data.data.collection_outdated}
        terminal={terminal}
        evidenceAction={
          canUpload ? (
            <EvidenceAction
              files={evidenceFiles}
              setFiles={setEvidenceFiles}
              inputRef={evidenceInputRef}
              onSubmit={() => upload.mutate()}
              pending={upload.isPending}
            />
          ) : null
        }
      />
      <div className='space-y-4'>
        <CorporateTransferMessageList
          messages={detail.data.data.messages}
          viewerRole='user'
          application={application}
        />
        <CorporateTransferReviewResult application={application} />
        {detail.data.data.ticket.status === 'closed' && canReply ? (
          <p className='rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-300'>
            {t(
              'This ticket is closed. Your reply will automatically reopen it.'
            )}
          </p>
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
        {['cancelled', 'expired', 'rejected'].includes(application.status) ? (
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
      </div>
    </div>
  )
  if (props.embedded) {
    return (
      <div className='flex h-full min-h-0 flex-col gap-4'>
        <div className='min-h-0 flex-1 overflow-y-auto pr-1'>
          {conversation}
        </div>
        <div className='shrink-0'>{composer}</div>
      </div>
    )
  }
  const content = (
    <div className='mx-auto max-w-3xl space-y-5'>
      {conversation}
      {composer}
    </div>
  )
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
      <SectionPageLayout.Content>{content}</SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
