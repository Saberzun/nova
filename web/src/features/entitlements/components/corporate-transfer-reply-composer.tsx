import { ImagePlus } from 'lucide-react'
import React, { useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

import {
  canSendCorporateTicketReply,
  mergeCorporateReplyFiles,
} from '../corporate-transfer-conversation'

void React

export function CorporateTransferReplyComposer(props: {
  value: string
  files: File[]
  pending: boolean
  placeholder: string
  onValueChange: (value: string) => void
  onFilesChange: (files: File[]) => void
  onSubmit: () => void
  submitLabel: string
  secondarySubmitLabel?: string
  onSecondarySubmit?: () => void
  trailingAction?: ReactNode
}) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const addFiles = (incoming: File[]) =>
    props.onFilesChange(mergeCorporateReplyFiles(props.files, incoming))
  const canSend = canSendCorporateTicketReply(props.value, props.files)

  return (
    <div
      className='bg-background space-y-3 rounded-xl border p-4'
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault()
        addFiles([...event.dataTransfer.files])
      }}
    >
      <Textarea
        value={props.value}
        maxLength={5000}
        placeholder={props.placeholder}
        onChange={(event) => props.onValueChange(event.target.value)}
        onPaste={(event) => addFiles([...event.clipboardData.files])}
      />
      <div className='text-muted-foreground flex items-center justify-between text-xs'>
        <span>{t('You can paste or drop images here')}</span>
        <span>{props.value.length}/5000</span>
      </div>
      <input
        ref={inputRef}
        className='sr-only'
        type='file'
        accept='image/jpeg,image/png,image/webp'
        multiple
        onChange={(event) => addFiles([...(event.target.files ?? [])])}
      />
      {props.files.length > 0 ? (
        <div className='flex flex-wrap gap-2'>
          {props.files.map((file, index) => (
            <button
              type='button'
              key={`${file.name}-${file.lastModified}`}
              className='bg-muted rounded-md px-2 py-1 text-xs'
              onClick={() =>
                props.onFilesChange(
                  props.files.filter((_, itemIndex) => itemIndex !== index)
                )
              }
            >
              {file.name} ×
            </button>
          ))}
        </div>
      ) : null}
      <div className='flex flex-wrap gap-2'>
        <Button
          type='button'
          variant='outline'
          disabled={props.pending}
          onClick={() => inputRef.current?.click()}
        >
          <ImagePlus className='size-4' aria-hidden='true' />
          {t('Image')}
        </Button>
        <Button
          variant='outline'
          disabled={!canSend || props.pending}
          onClick={props.onSubmit}
        >
          {props.submitLabel}
        </Button>
        {props.secondarySubmitLabel && props.onSecondarySubmit ? (
          <Button
            variant='outline'
            disabled={!canSend || props.pending}
            onClick={props.onSecondarySubmit}
          >
            {props.secondarySubmitLabel}
          </Button>
        ) : null}
        {props.trailingAction}
      </div>
    </div>
  )
}
