import { useQuery } from '@tanstack/react-query'
import { MessageSquareText } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  sideDrawerContentClassName,
  sideDrawerFormClassName,
  sideDrawerHeaderClassName,
} from '@/components/drawer-layout'
import { SectionPageLayout } from '@/components/layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

import { getCorporateTransferTickets } from './api'
import { corporateTransferStatusKey } from './corporate-transfer-status'
import { CorporateTransferTicketDetail } from './corporate-transfer-ticket-detail'
import { formatDate } from './lib'
import type { CorporateTransferStatus } from './types'

export function CorporateTransferTickets() {
  const { t } = useTranslation()
  const [selectedTicket, setSelectedTicket] = useState<{
    ticketNo: string
    subject: string
    status: CorporateTransferStatus
  } | null>(null)
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
                    setSelectedTicket({
                      ticketNo: item.ticket.ticket_no,
                      subject: item.ticket.subject,
                      status: item.application.status,
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
        <Sheet
          open={Boolean(selectedTicket)}
          onOpenChange={(open) => {
            if (!open) setSelectedTicket(null)
          }}
        >
          <SheetContent
            side='right'
            className={sideDrawerContentClassName(
              'max-w-none sm:!max-w-[min(640px,100vw)]'
            )}
          >
            <SheetHeader className={sideDrawerHeaderClassName()}>
              <SheetTitle>{selectedTicket?.subject ?? t('Ticket')}</SheetTitle>
              <SheetDescription>
                <span className='flex items-center gap-2'>
                  <span>{selectedTicket?.ticketNo ?? ''}</span>
                  {selectedTicket ? (
                    <Badge variant='secondary'>
                      {t(corporateTransferStatusKey(selectedTicket.status))}
                    </Badge>
                  ) : null}
                </span>
              </SheetDescription>
            </SheetHeader>
            <div className={sideDrawerFormClassName('overflow-hidden')}>
              {selectedTicket ? (
                <CorporateTransferTicketDetail
                  ticketNo={selectedTicket.ticketNo}
                  embedded
                />
              ) : null}
            </div>
          </SheetContent>
        </Sheet>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
