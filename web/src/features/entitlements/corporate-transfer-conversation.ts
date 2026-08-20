import type { SupportTicketAttachment, SupportTicketMessage } from './types'

export type CorporateTicketViewerRole = 'user' | 'admin'

export function corporateTicketParticipantKey(
  message: SupportTicketMessage,
  viewerRole: CorporateTicketViewerRole
): 'System' | 'Me' | 'Support' | 'Shopper' | 'Internal note' {
  if (message.internal) return 'Internal note'
  if (message.sender_role === 'system') return 'System'
  if (message.sender_role === viewerRole) return 'Me'
  return message.sender_role === 'admin' ? 'Support' : 'Shopper'
}

export function partitionCorporateTicketAttachments(
  attachments: SupportTicketAttachment[] = []
): {
  evidence: SupportTicketAttachment[]
  replies: SupportTicketAttachment[]
} {
  const evidence: SupportTicketAttachment[] = []
  const replies: SupportTicketAttachment[] = []
  for (const attachment of attachments) {
    if (attachment.kind === 'reply') {
      replies.push(attachment)
    } else {
      evidence.push(attachment)
    }
  }
  return { evidence, replies }
}

export function mergeCorporateReplyFiles(
  current: File[],
  incoming: File[]
): File[] {
  const allowed = new Set(['image/jpeg', 'image/png', 'image/webp'])
  return [
    ...current,
    ...incoming.filter((file) => allowed.has(file.type)),
  ].slice(0, 5)
}

export function canSendCorporateTicketReply(
  body: string,
  files: File[]
): boolean {
  return body.trim().length > 0 || files.length > 0
}
