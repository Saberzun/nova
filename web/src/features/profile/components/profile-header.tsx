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
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Activity, BarChart3, ChevronRight, WalletCards } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { StatusBadge } from '@/components/status-badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { IconBadge, type IconBadgeTone } from '@/components/ui/icon-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { getSelfEntitlements } from '@/features/entitlements/api'
import { getUserAvatarFallback, getUserAvatarStyle } from '@/lib/avatar'
import { formatCompactNumber, formatQuota } from '@/lib/format'
import { getRoleLabel } from '@/lib/roles'

import { getDisplayName } from '../lib'
import type { UserProfile } from '../types'

// ============================================================================
// Profile Header Component
// ============================================================================

interface ProfileHeaderProps {
  profile: UserProfile | null
  loading: boolean
}

export function ProfileHeader({ profile, loading }: ProfileHeaderProps) {
  const { t } = useTranslation()
  const entitlements = useQuery({
    queryKey: ['entitlements', 'self'],
    queryFn: getSelfEntitlements,
  })

  if (loading) {
    return (
      <Card data-card-hover='false' className='gap-0 overflow-hidden py-0'>
        <CardContent className='p-4 sm:p-5'>
          <div className='flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left'>
            <Skeleton className='h-16 w-16 rounded-2xl' />
            <div className='space-y-3'>
              <div className='flex flex-col items-center gap-2 sm:flex-row sm:justify-start'>
                <Skeleton className='h-8 w-48' />
                <Skeleton className='h-5 w-16' />
              </div>
              <div className='flex flex-col items-center gap-1 sm:flex-row sm:justify-start sm:gap-4'>
                <Skeleton className='h-4 w-24' />
                <Skeleton className='h-4 w-40' />
                <Skeleton className='h-4 w-20' />
              </div>
            </div>
          </div>
        </CardContent>
        <div className='border-t'>
          <div className='divide-border/60 grid grid-cols-1 divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0'>
            {['balance', 'usage', 'requests'].map((key) => (
              <div key={key} className='px-4 py-3.5 sm:px-5 sm:py-4'>
                <Skeleton className='h-3.5 w-20' />
                <Skeleton className='mt-2 h-7 w-28' />
                <Skeleton className='mt-1.5 h-3.5 w-24' />
              </div>
            ))}
          </div>
        </div>
      </Card>
    )
  }

  if (!profile) return null

  const displayName = getDisplayName(profile)
  const avatarName = profile.username || displayName
  const avatarFallback = getUserAvatarFallback(avatarName)
  const avatarFallbackStyle = getUserAvatarStyle(avatarName)
  const roleLabel = getRoleLabel(profile.role)
  const availableQuota = (entitlements.data?.data?.entitlements ?? []).reduce(
    (total, entitlement) =>
      entitlement.state === 'active'
        ? total +
          Math.max(
            0,
            entitlement.total_quota -
              entitlement.used_quota -
              entitlement.reserved_quota
          )
        : total,
    0
  )
  const stats: {
    label: string
    value: string
    description: string
    icon: typeof WalletCards
    tone: IconBadgeTone
    href?: '/entitlements'
    loading?: boolean
  }[] = [
    {
      label: t('Available quota'),
      value: entitlements.isError ? '—' : formatQuota(availableQuota),
      description: t('My Subscriptions'),
      icon: WalletCards,
      tone: 'success',
      href: '/entitlements',
      loading: entitlements.isPending,
    },
    {
      label: t('Total Usage'),
      value: formatQuota(profile.used_quota),
      description: t('Total consumed quota'),
      icon: BarChart3,
      tone: 'info',
    },
    {
      label: t('API Requests'),
      value: formatCompactNumber(profile.request_count),
      description: t('Total requests made'),
      icon: Activity,
      tone: 'chart-4',
    },
  ]

  return (
    <Card data-card-hover='false' className='gap-0 overflow-hidden py-0'>
      <CardContent className='p-3 sm:p-5'>
        <div className='flex items-center gap-3 text-left sm:gap-4'>
          <Avatar className='ring-background h-12 w-12 rounded-xl text-sm ring-2 sm:h-16 sm:w-16 sm:rounded-2xl sm:text-lg sm:ring-4'>
            <AvatarFallback
              className='rounded-xl font-semibold text-white sm:rounded-2xl'
              style={avatarFallbackStyle}
            >
              {avatarFallback}
            </AvatarFallback>
          </Avatar>

          <div className='min-w-0 flex-1 space-y-1.5 sm:space-y-3'>
            <div className='flex min-w-0 items-center gap-2'>
              <h1 className='truncate text-xl font-semibold tracking-tight sm:text-2xl'>
                {displayName}
              </h1>
              <StatusBadge
                label={roleLabel}
                variant='neutral'
                copyable={false}
              />
              <StatusBadge
                label={`${t('User ID')} ${profile.id}`}
                variant='info'
                copyText={String(profile.id)}
              />
            </div>

            <div className='text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs sm:gap-x-4 sm:text-sm'>
              <span className='truncate'>@{profile.username}</span>
              {profile.email && (
                <>
                  <span>•</span>
                  <span className='truncate'>{profile.email}</span>
                </>
              )}
              {profile.group && (
                <>
                  <span>•</span>
                  <span className='truncate'>{profile.group}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </CardContent>
      <div className='border-t'>
        <div className='divide-border/60 grid grid-cols-3 divide-x'>
          {stats.map((item) => {
            const content = (
              <>
                <div className='flex items-center gap-2'>
                  <IconBadge tone={item.tone} size='stat'>
                    <item.icon />
                  </IconBadge>
                  <div className='text-muted-foreground truncate text-xs font-medium tracking-wider uppercase'>
                    {item.label}
                  </div>
                </div>

                {item.loading ? (
                  <Skeleton className='mt-1.5 h-7 w-28 sm:mt-2' />
                ) : (
                  <div className='text-foreground mt-1.5 truncate font-mono text-lg font-bold tracking-tight tabular-nums sm:mt-2 sm:text-2xl'>
                    {item.value}
                  </div>
                )}
                <div className='text-muted-foreground/60 mt-1 hidden items-center gap-1 text-xs md:flex'>
                  {item.description}
                  {item.href ? <ChevronRight className='h-3 w-3' /> : null}
                </div>
              </>
            )
            const className = `min-w-0 px-3 py-3 sm:px-5 sm:py-4${
              item.href
                ? ' hover:bg-muted/50 focus-visible:ring-ring cursor-pointer transition-colors focus-visible:ring-2 focus-visible:outline-none'
                : ''
            }`

            return item.href ? (
              <Link
                key={item.label}
                to={item.href}
                className={className}
                aria-label={`${item.label} - ${item.description}`}
              >
                {content}
              </Link>
            ) : (
              <div key={item.label} className={className}>
                {content}
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}
