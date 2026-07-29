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
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

import { getSuccessRateDotClass } from '@/features/performance-metrics/lib/format'
import { cn } from '@/lib/utils'

import { getHealthLabelKey } from '../lib/model-card'

export type ModelPerfBadgeData = {
  avg_latency_ms: number
  success_rate: number
  avg_tps: number
  recent_success_rates?: number[]
}

export interface ModelPerfBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  perf: ModelPerfBadgeData | undefined
}

function formatCompactNumber(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '—'
  return value > 1 ? String(Math.round(value)) : value.toFixed(1)
}

function formatCompactLatency(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '—'
  if (ms >= 1_000) return `${formatCompactNumber(ms / 1_000)}s`
  return `${formatCompactNumber(ms)}ms`
}

function formatCompactThroughput(tps: number): string {
  if (!Number.isFinite(tps) || tps <= 0) return '—'
  if (tps >= 1_000) return `${formatCompactNumber(tps / 1_000)}Kt`
  return `${formatCompactNumber(tps)}t`
}

export const ModelPerfBadge = memo(function ModelPerfBadge(
  props: ModelPerfBadgeProps
) {
  const { t } = useTranslation()

  if (!props.perf) {
    return null
  }

  const { avg_latency_ms, avg_tps, success_rate } = props.perf

  const healthLabelKey = getHealthLabelKey(success_rate)

  return (
    <div
      className={cn(
        'grid grid-cols-3 divide-x rounded-xl border bg-muted/20 text-left tabular-nums',
        props.className
      )}
    >
      <div title={t('Average latency')} className='min-w-0 px-3 py-2.5'>
        <div className='text-muted-foreground text-[10px] font-medium'>
          {t('Latency')}
        </div>
        <div className='mt-1 font-mono text-xs font-semibold whitespace-nowrap'>
          {formatCompactLatency(avg_latency_ms)}
        </div>
      </div>
      <div title={t('Throughput')} className='min-w-0 px-3 py-2.5'>
        <div className='text-muted-foreground truncate text-[10px] font-medium'>
          {t('Throughput')}
        </div>
        <div className='mt-1 font-mono text-xs font-semibold whitespace-nowrap'>
          {formatCompactThroughput(avg_tps)}
          <span className='text-muted-foreground font-sans font-normal'>
            /s
          </span>
        </div>
      </div>
      <div
        title={`${t('Success rate')}: ${success_rate.toFixed(1)}%`}
        className='min-w-0 px-3 py-2.5'
      >
        <div className='text-muted-foreground truncate text-[10px] font-medium'>
          {t('Routing health')}
        </div>
        <div className='mt-1 flex items-center gap-1.5 whitespace-nowrap'>
          <span
            className={cn(
              'size-1.5 shrink-0 rounded-full',
              getSuccessRateDotClass(success_rate)
            )}
          />
          <span className='text-xs font-semibold'>
            {t(healthLabelKey)} {success_rate.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  )
})
