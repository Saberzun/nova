/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import { Link } from '@tanstack/react-router'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { AUDIENCE_SCENARIOS } from '../../constants'

interface AudienceScenariosProps {
  isAuthenticated: boolean
}

const TONE_CLASSES = {
  violet:
    'from-violet-500/20 to-fuchsia-500/5 text-violet-700 dark:text-violet-300',
  blue: 'from-blue-500/20 to-cyan-500/5 text-blue-700 dark:text-blue-300',
  emerald:
    'from-emerald-500/20 to-teal-500/5 text-emerald-700 dark:text-emerald-300',
  amber: 'from-amber-500/20 to-orange-500/5 text-amber-700 dark:text-amber-300',
} as const

export function AudienceScenarios(props: AudienceScenariosProps) {
  const { t } = useTranslation()
  const [activeIndex, setActiveIndex] = useState(0)
  const destination = props.isAuthenticated ? '/dashboard' : '/sign-in'

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % AUDIENCE_SCENARIOS.length)
    }, 3000)
    return () => window.clearInterval(intervalId)
  }, [])

  return (
    <section className='border-y bg-slate-50/60 px-4 py-20 sm:px-6 md:py-28 dark:bg-white/[0.02]'>
      <div className='mx-auto max-w-7xl'>
        <div className='mx-auto max-w-3xl text-center'>
          <p className='text-sm font-semibold text-indigo-600 dark:text-indigo-400'>
            {t('Built for every workflow')}
          </p>
          <h2 className='mt-3 text-3xl font-semibold tracking-tight md:text-5xl'>
            {t('One-stop access to AI capabilities')}
          </h2>
          <p className='text-muted-foreground mt-4 text-base md:text-lg'>
            {t(
              'A flexible platform for learning, work, development, and creation.'
            )}
          </p>
        </div>

        <div className='mt-12 grid gap-4 lg:grid-cols-4'>
          {AUDIENCE_SCENARIOS.map((scenario, index) => {
            const Icon = scenario.icon
            const isActive = activeIndex === index
            return (
              <Link
                key={scenario.key}
                to={destination}
                onMouseEnter={() => setActiveIndex(index)}
                onFocus={() => setActiveIndex(index)}
                className={cn(
                  'group relative min-h-[390px] overflow-hidden rounded-[1.75rem] border bg-background p-6 transition-all duration-500',
                  isActive
                    ? 'border-indigo-300 shadow-[0_24px_65px_-35px_rgba(79,70,229,0.55)] lg:-translate-y-2 dark:border-indigo-500/40'
                    : 'hover:-translate-y-1 hover:shadow-lg'
                )}
              >
                <div
                  aria-hidden
                  className={cn(
                    'absolute inset-x-0 top-0 h-40 bg-gradient-to-br opacity-80',
                    TONE_CLASSES[scenario.tone]
                  )}
                />
                <div className='relative'>
                  <div
                    className={cn(
                      'flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br',
                      TONE_CLASSES[scenario.tone]
                    )}
                  >
                    <Icon className='size-7' />
                  </div>
                  <h3 className='mt-8 text-2xl font-semibold'>
                    {t(scenario.title)}
                  </h3>
                  <p className='mt-2 text-sm font-medium'>
                    {t(scenario.subtitle)}
                  </p>
                  <p className='text-muted-foreground mt-3 text-sm leading-6'>
                    {t(scenario.description)}
                  </p>
                  <ul className='mt-6 space-y-3'>
                    {scenario.features.map((feature) => (
                      <li
                        key={feature}
                        className='text-muted-foreground flex items-center gap-2 text-sm'
                      >
                        <CheckCircle2 className='size-4 shrink-0 text-indigo-500' />
                        {t(feature)}
                      </li>
                    ))}
                  </ul>
                </div>
              </Link>
            )
          })}
        </div>

        <div className='mt-10 flex flex-col items-center justify-center gap-4 text-center sm:flex-row'>
          <p className='text-lg font-semibold'>
            {t('One API connects global AI capabilities')}
          </p>
          <Button
            className='group rounded-xl'
            render={<Link to={destination} />}
          >
            {t('Connect now')}
            <ArrowRight className='size-4 transition-transform group-hover:translate-x-0.5' />
          </Button>
        </div>
      </div>
    </section>
  )
}
