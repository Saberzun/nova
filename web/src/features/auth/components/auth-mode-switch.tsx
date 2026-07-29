/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

interface AuthModeSwitchProps {
  active: 'sign-in' | 'sign-up'
  showSignUp?: boolean
}

export function AuthModeSwitch(props: AuthModeSwitchProps) {
  const { t } = useTranslation()

  if (props.showSignUp === false) return null

  return (
    <nav
      aria-label={t('Account access')}
      className='bg-muted/60 grid grid-cols-2 rounded-xl border p-1'
    >
      <Link
        to='/sign-in'
        aria-current={props.active === 'sign-in' ? 'page' : undefined}
        className={cn(
          'rounded-lg px-4 py-2 text-center text-sm font-medium transition-all',
          props.active === 'sign-in'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        {t('Sign in')}
      </Link>
      <Link
        to='/sign-up'
        aria-current={props.active === 'sign-up' ? 'page' : undefined}
        className={cn(
          'rounded-lg px-4 py-2 text-center text-sm font-medium transition-all',
          props.active === 'sign-up'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        {t('Sign up')}
      </Link>
    </nav>
  )
}
