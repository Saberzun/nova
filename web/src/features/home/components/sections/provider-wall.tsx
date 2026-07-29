/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import { useTranslation } from 'react-i18next'

import { getLobeIcon } from '@/lib/lobe-icon'

import { MODEL_PROVIDERS } from '../../constants'

export function ProviderWall() {
  const { t } = useTranslation()

  return (
    <section id='providers' className='px-4 py-20 sm:px-6 md:py-28'>
      <div className='mx-auto max-w-7xl'>
        <div className='mx-auto max-w-3xl text-center'>
          <p className='text-sm font-semibold text-indigo-600 dark:text-indigo-400'>
            {t('Provider network')}
          </p>
          <h2 className='mt-3 text-3xl font-semibold tracking-tight md:text-5xl'>
            {t('Deep integration with leading model providers')}
          </h2>
          <p className='text-muted-foreground mt-4'>
            {t(
              'Choose the right model while the gateway handles compatible access and routing.'
            )}
          </p>
        </div>

        <div className='bg-border mt-12 grid grid-cols-2 overflow-hidden rounded-3xl border sm:grid-cols-4 lg:grid-cols-5'>
          {MODEL_PROVIDERS.map((provider) => (
            <div
              key={provider.name}
              tabIndex={0}
              title={provider.name}
              className='group bg-background relative flex min-h-32 items-center justify-center p-5 transition-all outline-none hover:z-10 hover:-translate-y-1 hover:rounded-2xl hover:shadow-xl focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-indigo-500'
            >
              <div className='flex flex-col items-center gap-3 transition-transform group-hover:scale-105'>
                <div className='flex size-12 items-center justify-center'>
                  {getLobeIcon(provider.icon, 38)}
                </div>
                <span className='text-muted-foreground group-hover:text-foreground text-center text-xs font-medium opacity-80 transition-opacity group-hover:opacity-100'>
                  {provider.name}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
