import { createFileRoute } from '@tanstack/react-router'

import { CorporateTransferTicketDetail } from '@/features/entitlements/corporate-transfer-ticket-detail'

export const Route = createFileRoute('/_authenticated/tickets/$ticketNo')({
  component: TicketDetailRoute,
})

function TicketDetailRoute() {
  const params = Route.useParams()
  return <CorporateTransferTicketDetail ticketNo={params.ticketNo} />
}
