import { createFileRoute } from '@tanstack/react-router'

import { CorporateTransferTickets } from '@/features/entitlements/corporate-transfer-tickets'

export const Route = createFileRoute('/_authenticated/tickets/')({
  component: CorporateTransferTickets,
})
