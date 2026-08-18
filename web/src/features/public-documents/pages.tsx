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
import {
  ArrowRight,
  BookOpen,
  Building2,
  CalendarDays,
  ExternalLink,
  FileCheck2,
  KeyRound,
  Mail,
  MessageCircle,
  Scale,
  WalletCards,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { PublicLayout } from '@/components/layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { getLegalDocument, LEGAL_DOCUMENTS } from './content'

const DOCS_SECTIONS = [
  {
    icon: KeyRound,
    title: 'API authentication',
    description: 'Create an API key and send it with the Bearer scheme.',
    href: '#authentication',
  },
  {
    icon: WalletCards,
    title: 'Quota and subscriptions',
    description: 'Understand recharge balance, subscription quota, and groups.',
    href: '#quota',
  },
  {
    icon: BookOpen,
    title: 'OpenAI compatibility',
    description: 'Use existing OpenAI SDKs with the itokenify API endpoint.',
    href: '#compatibility',
  },
]

export function LegalCenterPage() {
  const { t } = useTranslation()

  return (
    <PublicLayout>
      <div className='mx-auto max-w-6xl space-y-10 py-10'>
        <div className='max-w-3xl space-y-3'>
          <Badge variant='secondary'>{t('Policies and compliance')}</Badge>
          <h1 className='text-3xl font-semibold tracking-tight md:text-4xl'>
            {t('Legal center')}
          </h1>
          <p className='text-muted-foreground text-base leading-7'>
            {t(
              'Review the terms, policies, regional availability, and data processing information that apply to itokenify services.'
            )}
          </p>
        </div>

        <div className='grid gap-4 md:grid-cols-2'>
          {LEGAL_DOCUMENTS.map((document) => (
            <Card key={document.slug} className='h-full rounded-lg'>
              <CardHeader className='space-y-3'>
                <div className='bg-primary/10 text-primary flex size-9 items-center justify-center rounded-md'>
                  <Scale className='size-5' aria-hidden='true' />
                </div>
                <CardTitle className='text-lg'>{document.title}</CardTitle>
              </CardHeader>
              <CardContent className='space-y-5'>
                <p className='text-muted-foreground min-h-12 text-sm leading-6'>
                  {document.summary}
                </p>
                <Button
                  variant='outline'
                  render={
                    <Link to='/legal/$slug' params={{ slug: document.slug }} />
                  }
                >
                  {t('View document')}
                  <ArrowRight className='size-4' aria-hidden='true' />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </PublicLayout>
  )
}

export function LegalDocumentPage(props: { slug: string }) {
  const { t } = useTranslation()
  const document = getLegalDocument(props.slug)

  if (!document) {
    return (
      <PublicLayout>
        <div className='mx-auto max-w-3xl py-16'>
          <h1 className='text-2xl font-semibold'>{t('Document not found')}</h1>
          <Button
            className='mt-6'
            variant='outline'
            render={<Link to='/legal' />}
          >
            {t('Back to legal center')}
          </Button>
        </div>
      </PublicLayout>
    )
  }

  return (
    <PublicLayout>
      <div className='mx-auto grid max-w-6xl gap-10 py-10 lg:grid-cols-[220px_minmax(0,1fr)]'>
        <aside className='lg:sticky lg:top-24 lg:self-start'>
          <p className='text-muted-foreground mb-3 text-xs font-medium uppercase'>
            {t('Legal documents')}
          </p>
          <nav aria-label={t('Legal documents')} className='space-y-1'>
            {LEGAL_DOCUMENTS.map((item) => (
              <Link
                key={item.slug}
                to='/legal/$slug'
                params={{ slug: item.slug }}
                className='text-muted-foreground hover:bg-muted hover:text-foreground block rounded-md px-3 py-2 text-sm transition-colors'
                activeProps={{
                  className: 'bg-muted text-foreground font-medium',
                }}
              >
                {item.title}
              </Link>
            ))}
          </nav>
        </aside>

        <article className='max-w-3xl min-w-0'>
          <div className='border-border mb-9 border-b pb-7'>
            <Badge variant='secondary'>{t('Policy summary')}</Badge>
            <h1 className='mt-4 text-3xl font-semibold tracking-tight md:text-4xl'>
              {document.title}
            </h1>
            <p className='text-muted-foreground mt-3 text-base leading-7'>
              {document.summary}
            </p>
            {document.effectiveDate && (
              <p className='text-muted-foreground mt-4 flex items-center gap-2 text-sm'>
                <CalendarDays className='size-4' aria-hidden='true' />
                {t('Effective date')}: {document.effectiveDate}
              </p>
            )}
          </div>

          <div className='space-y-10'>
            {document.sections.map((section) => (
              <section key={section.title} className='scroll-mt-24'>
                <h2 className='text-xl font-semibold'>{section.title}</h2>
                {section.paragraphs?.map((paragraph) => (
                  <p
                    key={paragraph}
                    className='text-muted-foreground mt-4 text-[15px] leading-7'
                  >
                    {paragraph}
                  </p>
                ))}
                {section.items && (
                  <ul className='text-muted-foreground mt-4 space-y-3 text-[15px] leading-7'>
                    {section.items.map((item) => (
                      <li key={item} className='flex gap-3'>
                        <span className='bg-primary mt-2.5 size-1.5 shrink-0 rounded-full' />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>

          {document.sourceUrl && (
            <div className='border-border bg-muted/30 mt-12 border-t px-0 py-6'>
              <p className='text-muted-foreground text-sm leading-6'>
                {t(
                  'This page is a structured summary. The complete source document controls if there is any difference.'
                )}
              </p>
              <Button
                className='mt-4'
                variant='outline'
                render={
                  <a
                    href={document.sourceUrl}
                    target='_blank'
                    rel='noopener noreferrer'
                  />
                }
              >
                {t('Read complete source')}
                <ExternalLink className='size-4' aria-hidden='true' />
              </Button>
            </div>
          )}
        </article>
      </div>
    </PublicLayout>
  )
}

export function DocsPage() {
  const { t } = useTranslation()

  return (
    <PublicLayout>
      <div className='mx-auto max-w-6xl space-y-12 py-10'>
        <div className='max-w-3xl space-y-3'>
          <Badge variant='secondary'>{t('Developer documentation')}</Badge>
          <h1 className='text-3xl font-semibold tracking-tight md:text-4xl'>
            itokenify API
          </h1>
          <p className='text-muted-foreground text-base leading-7'>
            {t(
              'Connect OpenAI-compatible clients to multiple AI providers through one endpoint, one API key, and unified billing.'
            )}
          </p>
        </div>

        <div className='grid gap-4 md:grid-cols-3'>
          {DOCS_SECTIONS.map((section) => (
            <a
              key={section.href}
              href={section.href}
              className='border-border hover:border-primary/40 bg-card rounded-lg border p-5 transition-colors'
            >
              <section.icon
                className='text-primary size-5'
                aria-hidden='true'
              />
              <h2 className='mt-4 text-base font-semibold'>
                {t(section.title)}
              </h2>
              <p className='text-muted-foreground mt-2 text-sm leading-6'>
                {t(section.description)}
              </p>
            </a>
          ))}
        </div>

        <div className='grid gap-12 lg:grid-cols-[minmax(0,1fr)_280px]'>
          <div className='space-y-12'>
            <section id='authentication' className='scroll-mt-24 space-y-4'>
              <h2 className='text-2xl font-semibold'>{t('Quick start')}</h2>
              <p className='text-muted-foreground leading-7'>
                {t(
                  'Create an API key in the console, select the groups it may consume, and use it as a Bearer token.'
                )}
              </p>
              <pre className='bg-foreground text-background overflow-x-auto rounded-md p-5 text-sm leading-6'>
                <code>
                  {[
                    'curl https://itokenify.com/v1/chat/completions \\',
                    '  -H "Authorization: Bearer YOUR_API_KEY" \\',
                    '  -H "Content-Type: application/json" \\',
                    `  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"Hello"}]}'`,
                  ].join('\n')}
                </code>
              </pre>
            </section>

            <section id='quota' className='scroll-mt-24 space-y-4'>
              <h2 className='text-2xl font-semibold'>
                {t('Quota and groups')}
              </h2>
              <p className='text-muted-foreground leading-7'>
                {t(
                  'Recharge balance and subscription quota are separate funding sources. Each source can only be consumed by its allowed groups. When an API key contains multiple groups, the configured order is used as the priority order.'
                )}
              </p>
              <ul className='text-muted-foreground space-y-3 leading-7'>
                <li>
                  {t(
                    'Unavailable groups remain visible but cannot be selected.'
                  )}
                </li>
                <li>
                  {t(
                    'Model input, output, and cache usage are billed at provider prices.'
                  )}
                </li>
                <li>
                  {t(
                    'Usage records show the group and funding source used for each charge.'
                  )}
                </li>
              </ul>
            </section>

            <section id='compatibility' className='scroll-mt-24 space-y-4'>
              <h2 className='text-2xl font-semibold'>
                {t('Client compatibility')}
              </h2>
              <p className='text-muted-foreground leading-7'>
                {t(
                  'Set the OpenAI-compatible base URL to https://itokenify.com/v1 and provide your itokenify API key. Available models depend on the selected groups and current upstream availability.'
                )}
              </p>
            </section>
          </div>

          <aside className='border-border h-fit border-l pl-6'>
            <p className='text-sm font-semibold'>{t('Related resources')}</p>
            <nav className='mt-4 space-y-3 text-sm'>
              <Link
                to='/pricing'
                className='text-muted-foreground hover:text-foreground block'
              >
                {t('Model Square')}
              </Link>
              <Link
                to='/legal'
                className='text-muted-foreground hover:text-foreground block'
              >
                {t('Policies and compliance')}
              </Link>
              <Link
                to='/business'
                className='text-muted-foreground hover:text-foreground block'
              >
                {t('Business cooperation')}
              </Link>
            </nav>
          </aside>
        </div>
      </div>
    </PublicLayout>
  )
}

export function BusinessPage() {
  const { t } = useTranslation()

  return (
    <PublicLayout>
      <div className='mx-auto max-w-5xl py-12'>
        <div className='grid items-start gap-12 md:grid-cols-[minmax(0,1fr)_360px]'>
          <div className='space-y-5'>
            <div className='bg-primary/10 text-primary flex size-11 items-center justify-center rounded-md'>
              <Building2 className='size-6' aria-hidden='true' />
            </div>
            <h1 className='text-3xl font-semibold tracking-tight md:text-4xl'>
              {t('Business cooperation')}
            </h1>
            <p className='text-muted-foreground max-w-2xl text-base leading-7'>
              {t(
                'For enterprise access, volume purchasing, dedicated groups, technical integration, or other cooperation, contact us through the channels on this page.'
              )}
            </p>
          </div>

          <Card className='rounded-lg'>
            <CardHeader>
              <CardTitle className='text-lg'>
                {t('Contact information')}
              </CardTitle>
            </CardHeader>
            <CardContent className='space-y-5'>
              <div className='flex items-start gap-3'>
                <MessageCircle
                  className='text-primary mt-0.5 size-5'
                  aria-hidden='true'
                />
                <div>
                  <p className='text-muted-foreground text-xs'>QQ</p>
                  <p className='mt-1 font-medium'>674507175</p>
                </div>
              </div>
              <div className='flex items-start gap-3'>
                <Mail
                  className='text-primary mt-0.5 size-5'
                  aria-hidden='true'
                />
                <div className='min-w-0'>
                  <p className='text-muted-foreground text-xs'>{t('Email')}</p>
                  <a
                    href='mailto:derekrose643@gmail.com'
                    className='mt-1 block font-medium break-all hover:underline'
                  >
                    derekrose643@gmail.com
                  </a>
                </div>
              </div>
              <div className='border-border border-t pt-4'>
                <p className='text-muted-foreground flex items-start gap-2 text-xs leading-5'>
                  <FileCheck2
                    className='mt-0.5 size-4 shrink-0'
                    aria-hidden='true'
                  />
                  {t(
                    'Please include your use case, expected scale, and preferred contact method.'
                  )}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PublicLayout>
  )
}
