import type { CorporateTransferStatus } from './types'

export function corporateTransferStatusKey(
  status: CorporateTransferStatus
): string {
  const keys: Record<CorporateTransferStatus, string> = {
    awaiting_evidence: 'Awaiting payment evidence',
    under_review: 'Under review',
    needs_more_information: 'More information required',
    approved: 'Approved',
    fulfilled: 'Fulfilled',
    cancelled: 'Cancelled',
    expired: 'Expired',
    rejected: 'Rejected',
  }
  return keys[status]
}

export function corporateTransferIsTerminal(
  status: CorporateTransferStatus
): boolean {
  return ['fulfilled', 'cancelled', 'expired', 'rejected'].includes(status)
}
