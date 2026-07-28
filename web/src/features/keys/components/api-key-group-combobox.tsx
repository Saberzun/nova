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
import {
  ArrowDown,
  ArrowUp,
  Check,
  GripVertical,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import { useMemo, useState, type DragEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export type ApiKeyGroupOption = {
  value: string
  label: string
  desc?: string
  ratio?: number | string
  fundingType?: string
}

type ApiKeyGroupComboboxProps = {
  options: ApiKeyGroupOption[]
  value?: string[]
  onValueChange: (value: string[]) => void
  placeholder?: string
  disabled?: boolean
}

function formatGroupRatio(
  ratio: ApiKeyGroupOption['ratio'],
  ratioLabel: string
) {
  if (ratio === undefined || ratio === null || ratio === '') return null
  return `${ratio}x ${ratioLabel}`
}

function getRatioBadgeClassName(ratio: ApiKeyGroupOption['ratio']) {
  if (typeof ratio !== 'number') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300'
  }

  if (ratio > 5) {
    return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300'
  }
  if (ratio > 3) {
    return 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/60 dark:bg-orange-950/40 dark:text-orange-300'
  }
  if (ratio > 1) {
    return 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300'
  }
  return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300'
}

function GroupRatioBadge({ ratio }: { ratio: ApiKeyGroupOption['ratio'] }) {
  const { t } = useTranslation()
  const label = formatGroupRatio(ratio, t('Ratio'))

  if (!label) return null

  return (
    <Badge
      variant='outline'
      className={cn(
        'shrink-0 text-[10px] sm:text-xs',
        getRatioBadgeClassName(ratio)
      )}
    >
      {label}
    </Badge>
  )
}

function FundingTypeBadge({ fundingType }: { fundingType?: string }) {
  const { t } = useTranslation()

  if (fundingType === 'subscription') {
    return (
      <Badge
        variant='outline'
        className='border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/40 dark:text-violet-300'
      >
        {t('Subscription quota')}
      </Badge>
    )
  }

  if (fundingType === 'stored_value') {
    return (
      <Badge
        variant='outline'
        className='border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900/60 dark:bg-cyan-950/40 dark:text-cyan-300'
      >
        {t('Recharge balance')}
      </Badge>
    )
  }

  return null
}

function GroupMeta({ option }: { option: ApiKeyGroupOption }) {
  return (
    <div className='min-w-0 flex-1'>
      <div className='flex flex-wrap items-center gap-1.5'>
        <span className='truncate text-sm font-medium'>{option.label}</span>
        <GroupRatioBadge ratio={option.ratio} />
        <FundingTypeBadge fundingType={option.fundingType} />
      </div>
      {option.desc && (
        <p className='text-muted-foreground mt-1 line-clamp-2 text-xs leading-5'>
          {option.desc}
        </p>
      )}
    </div>
  )
}

export function ApiKeyGroupCombobox({
  options,
  value,
  onValueChange,
  placeholder,
  disabled,
}: ApiKeyGroupComboboxProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const [draftValues, setDraftValues] = useState<string[]>([])
  const [draggedValue, setDraggedValue] = useState<string | null>(null)
  const selectedValues = value ?? []
  const optionMap = useMemo(
    () => new Map(options.map((option) => [option.value, option])),
    [options]
  )
  const selectedOptions = selectedValues
    .map((selectedValue) => optionMap.get(selectedValue))
    .filter((option): option is ApiKeyGroupOption => option !== undefined)
  const draftOptions = draftValues
    .map((selectedValue) => optionMap.get(selectedValue))
    .filter((option): option is ApiKeyGroupOption => option !== undefined)

  const filteredOptions = useMemo(() => {
    const search = searchValue.trim().toLowerCase()
    if (!search) return options

    return options.filter((option) => {
      const ratioText = String(option.ratio ?? '').toLowerCase()
      return (
        option.value.toLowerCase().includes(search) ||
        option.label.toLowerCase().includes(search) ||
        option.desc?.toLowerCase().includes(search) ||
        ratioText.includes(search)
      )
    })
  }, [options, searchValue])

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (nextOpen) {
      setDraftValues(selectedValues)
      setSearchValue('')
    } else {
      setDraggedValue(null)
    }
  }

  const addGroup = (groupValue: string) => {
    if (groupValue === 'auto') {
      setDraftValues(['auto'])
      return
    }
    setDraftValues((current) => [
      ...current.filter((item) => item !== 'auto'),
      ...(current.includes(groupValue) ? [] : [groupValue]),
    ])
  }

  const removeGroup = (groupValue: string) => {
    setDraftValues((current) => current.filter((item) => item !== groupValue))
  }

  const moveGroup = (groupValue: string, offset: number) => {
    setDraftValues((current) => {
      const currentIndex = current.indexOf(groupValue)
      const targetIndex = currentIndex + offset
      if (
        currentIndex < 0 ||
        targetIndex < 0 ||
        targetIndex >= current.length
      ) {
        return current
      }
      const next = [...current]
      const [item] = next.splice(currentIndex, 1)
      next.splice(targetIndex, 0, item)
      return next
    })
  }

  const handleDrop = (
    event: DragEvent<HTMLDivElement>,
    targetValue: string
  ) => {
    event.preventDefault()
    if (!draggedValue || draggedValue === targetValue) return
    setDraftValues((current) => {
      const sourceIndex = current.indexOf(draggedValue)
      const targetIndex = current.indexOf(targetValue)
      if (sourceIndex < 0 || targetIndex < 0) return current
      const next = [...current]
      const [item] = next.splice(sourceIndex, 1)
      next.splice(targetIndex, 0, item)
      return next
    })
    setDraggedValue(null)
  }

  const confirmSelection = () => {
    onValueChange(draftValues)
    setOpen(false)
  }

  return (
    <>
      <div className='bg-muted/30 rounded-xl border p-3 sm:p-4'>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div className='min-w-0'>
            <p className='text-sm font-medium'>{t('Group selection')}</p>
            <p className='text-muted-foreground mt-1 text-xs leading-5'>
              {t(
                'Choose the groups this API key can use and arrange their consumption priority.'
              )}
            </p>
          </div>
          <Button
            type='button'
            size='sm'
            disabled={disabled}
            onClick={() => handleOpenChange(true)}
          >
            {selectedOptions.length > 0
              ? t('Adjust groups')
              : placeholder || t('Select groups')}
          </Button>
        </div>

        {selectedOptions.length > 0 ? (
          <div className='mt-3 flex flex-wrap gap-2'>
            {selectedOptions.map((option, index) => (
              <Badge
                key={option.value}
                variant='secondary'
                className='gap-1.5 rounded-lg px-2.5 py-1.5'
              >
                <span className='text-muted-foreground tabular-nums'>
                  {index + 1}.
                </span>
                <span>{option.label}</span>
              </Badge>
            ))}
          </div>
        ) : (
          <div className='text-muted-foreground mt-3 rounded-lg border border-dashed px-3 py-2 text-xs'>
            {t('No groups selected')}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className='grid max-h-[min(760px,calc(100vh-2rem))] grid-rows-[auto_minmax(0,1fr)_auto] sm:max-w-[960px]'>
          <DialogHeader>
            <DialogTitle>{t('Group priority')}</DialogTitle>
            <DialogDescription>
              {t(
                'Select the groups this API key can use. Once a request selects a group, retries stay in that group.'
              )}
            </DialogDescription>
          </DialogHeader>

          <div className='grid min-h-0 gap-4 overflow-y-auto md:grid-cols-2 md:overflow-hidden'>
            <section className='flex min-h-[280px] flex-col overflow-hidden rounded-xl border'>
              <div className='border-b p-3'>
                <h3 className='text-sm font-semibold'>
                  {t('Available groups')}
                </h3>
                <div className='relative mt-2'>
                  <Search className='text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2' />
                  <Input
                    value={searchValue}
                    onChange={(event) => setSearchValue(event.target.value)}
                    placeholder={t('Search groups')}
                    className='pl-9'
                  />
                </div>
              </div>
              <div className='min-h-0 flex-1 space-y-2 overflow-y-auto p-3'>
                {filteredOptions.length > 0 ? (
                  filteredOptions.map((option) => {
                    const isSelected = draftValues.includes(option.value)
                    return (
                      <div
                        key={option.value}
                        className={cn(
                          'flex items-start gap-3 rounded-lg border p-3 transition-colors',
                          isSelected &&
                            'border-emerald-300 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/30'
                        )}
                      >
                        <GroupMeta option={option} />
                        <Button
                          type='button'
                          variant={isSelected ? 'secondary' : 'outline'}
                          size='sm'
                          disabled={isSelected}
                          onClick={() => addGroup(option.value)}
                          className='shrink-0'
                        >
                          {isSelected ? (
                            <Check className='size-3.5' />
                          ) : (
                            <Plus className='size-3.5' />
                          )}
                          {isSelected ? t('Added') : t('Add')}
                        </Button>
                      </div>
                    )
                  })
                ) : (
                  <div className='text-muted-foreground flex min-h-48 items-center justify-center text-sm'>
                    {t('No group found.')}
                  </div>
                )}
              </div>
            </section>

            <section className='flex min-h-[280px] flex-col overflow-hidden rounded-xl border'>
              <div className='border-b p-3'>
                <div className='flex flex-wrap items-baseline gap-x-2 gap-y-1'>
                  <h3 className='text-sm font-semibold'>
                    {t('Selected groups')}
                  </h3>
                  <span className='text-muted-foreground text-xs'>
                    {t('Higher groups are consumed first')}
                  </span>
                </div>
              </div>
              <div className='min-h-0 flex-1 space-y-2 overflow-y-auto p-3'>
                {draftOptions.length > 0 ? (
                  draftOptions.map((option, index) => (
                    <div
                      key={option.value}
                      draggable={draftOptions.length > 1}
                      onDragStart={() => setDraggedValue(option.value)}
                      onDragEnd={() => setDraggedValue(null)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => handleDrop(event, option.value)}
                      className={cn(
                        'flex items-start gap-3 rounded-lg border bg-background p-3 transition',
                        draggedValue === option.value && 'opacity-50'
                      )}
                    >
                      <div className='bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg border text-sm font-semibold tabular-nums'>
                        {String(index + 1).padStart(2, '0')}
                      </div>
                      <GroupMeta option={option} />
                      <div className='bg-muted/50 flex shrink-0 items-center rounded-lg border p-0.5'>
                        <Button
                          type='button'
                          variant='ghost'
                          size='icon-sm'
                          disabled={index === 0}
                          aria-label={t('Move up')}
                          title={t('Move up')}
                          onClick={() => moveGroup(option.value, -1)}
                        >
                          <ArrowUp className='size-3.5' />
                        </Button>
                        <Button
                          type='button'
                          variant='ghost'
                          size='icon-sm'
                          disabled={index === draftOptions.length - 1}
                          aria-label={t('Move down')}
                          title={t('Move down')}
                          onClick={() => moveGroup(option.value, 1)}
                        >
                          <ArrowDown className='size-3.5' />
                        </Button>
                        <Button
                          type='button'
                          variant='ghost'
                          size='icon-sm'
                          aria-label={t('Remove')}
                          title={t('Remove')}
                          onClick={() => removeGroup(option.value)}
                          className='text-destructive hover:text-destructive'
                        >
                          <Trash2 className='size-3.5' />
                        </Button>
                        <span
                          className='text-muted-foreground hidden size-8 cursor-grab items-center justify-center sm:flex'
                          title={t('Drag to reorder')}
                        >
                          <GripVertical className='size-4' />
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className='text-muted-foreground flex min-h-48 items-center justify-center rounded-lg border border-dashed text-sm'>
                    {t('Add groups from the left')}
                  </div>
                )}
              </div>
            </section>
          </div>

          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => handleOpenChange(false)}
            >
              {t('Cancel')}
            </Button>
            <Button
              type='button'
              disabled={draftValues.length === 0}
              onClick={confirmSelection}
            >
              {t('Confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
