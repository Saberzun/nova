import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { MessageSquareText } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

import { getCorporateTransferTickets } from './api'
import { corporateTransferStatusKey } from './corporate-transfer-status'
import { formatDate } from './lib'

export function CorporateTransferTickets() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const tickets = useQuery({
    queryKey: ['corporate-transfer', 'tickets'],
    queryFn: getCorporateTransferTickets,
  })

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('My Tickets')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='space-y-3'>
          {(tickets.data?.data ?? []).map((item) => (
            <Card key={item.ticket.id}>
              <CardContent className='flex flex-col gap-4 pt-6 md:flex-row md:items-center md:justify-between'>
                <div className='flex min-w-0 gap-3'>
                  <span className='bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl'>
                    <MessageSquareText className='size-5' />
                  </span>
                  <div className='min-w-0'>
                    <div className='flex flex-wrap items-center gap-2'>
                      <p className='font-medium'>{item.ticket.subject}</p>
                      <Badge variant='secondary'>
                        {t(corporateTransferStatusKey(item.application.status))}
                      </Badge>
                    </div>
                    <p className='text-muted-foreground mt-1 font-mono text-xs'>
                      {item.ticket.ticket_no}
                    </p>
                    <p className='text-muted-foreground mt-1 text-xs'>
                      {formatDate(item.ticket.updated_at)}
                    </p>
                    {item.application.user_visible_reason ? (
                      <p className='text-destructive mt-2 text-sm'>
                        {item.application.user_visible_reason}
                      </p>
                    ) : null}
                  </div>
                </div>
                <Button
                  variant='outline'
                  onClick={() =>
                    navigate({
                      to: '/tickets/$ticketNo',
                      params: { ticketNo: item.ticket.ticket_no },
                    })
                  }
                >
                  {t('View ticket')}
                </Button>
              </CardContent>
            </Card>
          ))}
          {!tickets.isPending && (tickets.data?.data?.length ?? 0) === 0 ? (
            <div className='text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm'>
              {t('No corporate transfer tickets')}
            </div>
          ) : null}
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
