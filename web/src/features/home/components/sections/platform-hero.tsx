/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import { Link } from '@tanstack/react-router'
import { ArrowRight, BookOpen, Check, Copy, Handshake } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { useStatus } from '@/hooks/use-status'

import { QUICK_START_STEPS } from '../../constants'

interface PlatformHeroProps {
  isAuthenticated: boolean
}

export function PlatformHero(props: PlatformHeroProps) {
  const { t } = useTranslation()
  const { status } = useStatus()
  const { copyToClipboard, copiedText } = useCopyToClipboard()
  const docsUrl =
    (status?.docs_link as string | undefined) || 'https://docs.newapi.pro'
  const apiBaseUrl = useMemo(() => {
    const configured =
      (status?.server_address as string | undefined) ||
      (status?.data?.server_address as string | undefined)
    if (configured) return configured.replace(/\/+$/, '')
    if (typeof window !== 'undefined') return window.location.origin
    return ''
  }, [status])
  const startPath = props.isAuthenticated ? '/dashboard' : '/sign-in'

  return (
    <section className='relative overflow-hidden px-4 pt-24 pb-16 sm:px-6 md:pt-32 md:pb-24'>
      <div
        aria-hidden
        className='pointer-events-none absolute inset-x-0 top-0 -z-10 h-[780px] bg-[radial-gradient(circle_at_18%_18%,rgba(99,102,241,0.20),transparent_34%),radial-gradient(circle_at_82%_18%,rgba(56,189,248,0.15),transparent_30%),linear-gradient(to_bottom,rgba(248,250,252,0.72),transparent)] dark:opacity-50'
      />
      <div className='mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]'>
        <div>
          <div className='mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:border-indigo-500/25 dark:bg-indigo-500/10 dark:text-indigo-300'>
            <span className='size-1.5 rounded-full bg-indigo-500' />
            {t('Global AI model access platform')}
          </div>
          <h1 className='max-w-3xl text-[clamp(2.6rem,6vw,5rem)] leading-[1.04] font-semibold tracking-[-0.045em]'>
            {t('A leading gateway for')}
            <span className='block bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 bg-clip-text text-transparent'>
              {t('global AI capabilities')}
            </span>
          </h1>
          <p className='text-muted-foreground mt-6 max-w-2xl text-base leading-7 md:text-lg'>
            {t(
              'Connect leading models through one compatible API, with clear quota control, resilient routing, and transparent usage.'
            )}
          </p>

          <div className='mt-8 max-w-xl rounded-2xl border bg-white/70 p-2 shadow-sm backdrop-blur dark:bg-black/20'>
            <div className='flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 dark:bg-white/5'>
              <div className='min-w-0 flex-1'>
                <p className='text-muted-foreground text-[11px] font-semibold tracking-wider uppercase'>
                  API Base URL
                </p>
                <code className='mt-1 block truncate text-sm font-semibold'>
                  {apiBaseUrl}
                </code>
              </div>
              <Button
                type='button'
                variant='ghost'
                size='icon'
                className='shrink-0'
                aria-label={t('Copy API base URL')}
                onClick={() => copyToClipboard(apiBaseUrl)}
              >
                {copiedText === apiBaseUrl ? (
                  <Check className='size-4 text-emerald-600' />
                ) : (
                  <Copy className='size-4' />
                )}
              </Button>
            </div>
          </div>

          <div className='mt-6 flex flex-wrap gap-3'>
            <Button
              size='lg'
              className='group rounded-xl'
              render={<Link to={startPath} />}
            >
              {props.isAuthenticated ? t('Go to Console') : t('Get API key')}
              <ArrowRight className='size-4 transition-transform group-hover:translate-x-0.5' />
            </Button>
            <Button
              size='lg'
              variant='outline'
              className='rounded-xl'
              render={<a href={docsUrl} target='_blank' rel='noreferrer' />}
            >
              <BookOpen className='size-4' />
              {t('Usage guide')}
            </Button>
            <Button
              size='lg'
              variant='ghost'
              className='rounded-xl'
              render={<a href='mailto:support@itokenify.com' />}
            >
              <Handshake className='size-4' />
              {t('Business cooperation')}
            </Button>
          </div>

          <dl className='mt-10 grid max-w-2xl grid-cols-3 gap-3 border-t pt-6'>
            {[
              ['30+', 'Countries covered'],
              ['20+', 'Models available'],
              ['99.9%', 'Service availability'],
            ].map(([value, label]) => (
              <div key={label}>
                <dt className='text-xl font-semibold tracking-tight md:text-2xl'>
                  {value}
                </dt>
                <dd className='text-muted-foreground mt-1 text-xs md:text-sm'>
                  {t(label)}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className='relative'>
          <div
            aria-hidden
            className='absolute -inset-12 -z-10 rounded-full bg-gradient-to-br from-indigo-500/15 via-violet-500/10 to-sky-400/15 blur-3xl'
          />
          <div className='rounded-[2rem] border bg-white/80 p-5 shadow-[0_24px_80px_-30px_rgba(79,70,229,0.35)] backdrop-blur-xl sm:p-7 dark:bg-slate-950/70'>
            <div className='mb-7 flex items-center justify-between'>
              <div>
                <p className='text-muted-foreground text-xs font-semibold tracking-widest uppercase'>
                  {t('Quick start')}
                </p>
                <h2 className='mt-2 text-2xl font-semibold'>
                  {t('Get started in three steps')}
                </h2>
              </div>
              <span className='rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400'>
                {t('Ready')}
              </span>
            </div>
            <div className='space-y-3'>
              {QUICK_START_STEPS.map((step, index) => (
                <Link
                  key={step.number}
                  to={startPath}
                  className='group bg-background/70 flex items-start gap-4 rounded-2xl border p-4 transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md dark:hover:border-indigo-500/40'
                >
                  <span className='flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 font-mono text-sm font-bold text-white shadow-sm'>
                    {step.number}
                  </span>
                  <span className='min-w-0 flex-1'>
                    <span className='flex items-center justify-between gap-3 font-semibold'>
                      {t(step.title)}
                      <ArrowRight className='text-muted-foreground size-4 transition-transform group-hover:translate-x-1 group-hover:text-indigo-600' />
                    </span>
                    <span className='text-muted-foreground mt-1 block text-sm leading-6'>
                      {t(step.description)}
                    </span>
                  </span>
                  <span className='sr-only'>
                    {t('Step {{number}}', { number: index + 1 })}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
