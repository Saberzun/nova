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
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { LanguageSwitcher } from '@/components/language-switcher'
import { ThemeSwitch } from '@/components/theme-switch'
import { BUSINESS_BRAND } from '@/config/business-brand'
import { cn } from '@/lib/utils'

import { authLayoutClasses } from './lib/auth-layout'

type AuthLayoutProps = {
  children: React.ReactNode
}

export function AuthLayout(props: AuthLayoutProps) {
  const { t } = useTranslation()
  const currentYear = new Date().getFullYear()

  return (
    <div className={authLayoutClasses.root}>
      <section
        className={authLayoutClasses.showcase}
        aria-label={t('itokenify platform introduction')}
      >
        <div
          aria-hidden='true'
          className='absolute inset-0 bg-[radial-gradient(circle_at_16%_12%,rgba(34,211,238,0.17),transparent_32%),radial-gradient(circle_at_82%_38%,rgba(99,102,241,0.18),transparent_34%),linear-gradient(145deg,rgba(15,23,42,0.03),transparent_58%)] dark:bg-[radial-gradient(circle_at_16%_12%,rgba(34,211,238,0.12),transparent_32%),radial-gradient(circle_at_82%_38%,rgba(99,102,241,0.14),transparent_34%),linear-gradient(145deg,rgba(15,23,42,0.5),rgba(3,7,18,0.88))]'
        />
        <Link
          to='/'
          className='relative z-10 m-10 inline-flex w-fit items-center gap-3 rounded-xl transition-opacity outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-indigo-500'
        >
          <img
            src={BUSINESS_BRAND.logo}
            alt={t('itokenify logo')}
            className='size-9 rounded-xl object-contain'
          />
          <span className='text-xl font-semibold tracking-tight'>
            {BUSINESS_BRAND.name}
          </span>
        </Link>

        <div className='relative z-10 my-auto w-full max-w-3xl px-12 2xl:px-20'>
          <div className='mb-7 flex items-center gap-4'>
            <img
              src={BUSINESS_BRAND.logo}
              alt=''
              aria-hidden='true'
              className='size-16 rounded-2xl object-contain shadow-[0_18px_48px_-18px_rgba(79,70,229,0.7)]'
            />
            <div>
              <p className='text-2xl font-semibold tracking-tight'>
                {BUSINESS_BRAND.name}
              </p>
              <p className='text-muted-foreground mt-1 text-sm'>
                {t('Welcome to itokenify')}
              </p>
            </div>
          </div>
          <p className='text-muted-foreground mb-2 text-lg font-medium'>
            {t('One gateway for')}
          </p>
          <h1 className='max-w-3xl text-[clamp(3.2rem,5vw,6rem)] leading-[0.98] font-semibold tracking-[-0.055em]'>
            {t('leading AI models')}
          </h1>
          <p className='text-muted-foreground mt-7 max-w-2xl text-base leading-7'>
            {t(
              'Access leading models, manage API keys, and keep quota, subscriptions, and usage clear in one place.'
            )}
          </p>
        </div>

        <div className='relative z-10 flex flex-wrap items-center gap-x-2 gap-y-1 px-12 py-8 text-xs 2xl:px-20'>
          <span className='text-muted-foreground/55'>
            &copy; {currentYear} {BUSINESS_BRAND.name}
          </span>
        </div>
      </section>

      <section className={authLayoutClasses.formPanel}>
        <div className='absolute top-4 right-4 flex items-center gap-1 sm:top-6 sm:right-6'>
          <LanguageSwitcher />
          <ThemeSwitch />
        </div>

        <Link
          to='/'
          className='absolute top-4 left-4 flex items-center gap-2 rounded-lg transition-opacity outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-indigo-500 sm:top-6 sm:left-6 lg:hidden'
        >
          <img
            src={BUSINESS_BRAND.logo}
            alt={t('itokenify logo')}
            className='size-8 rounded-lg object-contain'
          />
          <span className='font-semibold tracking-tight'>
            {BUSINESS_BRAND.name}
          </span>
        </Link>

        <div className='w-full max-w-[500px]'>
          <div className='border-border/60 bg-card/70 rounded-3xl border p-5 shadow-[0_26px_70px_-38px_rgba(15,23,42,0.55)] backdrop-blur sm:p-8'>
            {props.children}
          </div>
          <div
            className={cn(
              'text-muted-foreground/50 mt-6 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs',
              'lg:hidden'
            )}
          >
            <span>
              &copy; {currentYear} {BUSINESS_BRAND.name}
            </span>
          </div>
        </div>
      </section>
    </div>
  )
}
