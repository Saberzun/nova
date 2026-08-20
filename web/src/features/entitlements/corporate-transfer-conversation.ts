import type { SupportTicketAttachment, SupportTicketMessage } from './types'

export type CorporateTicketViewerRole = 'user' | 'admin'

export type CorporateTransferLocalizedText = {
  key: string
  values?: Record<string, string>
}

const corporateTransferExactTextKeys: Record<string, string> = {
  '订单已创建，请完成转账后上传支付凭证。':
    'Order created. Complete the transfer and upload payment evidence.',
  'cancelled by user before payment':
    'Corporate transfer cancelled before payment',
  'payment evidence deadline expired': 'Payment evidence deadline expired',
  '工单已由管理员关闭。': 'Ticket closed by administrator',
  '工单已由管理员重新打开，仅用于继续沟通，不改变支付审核结果。':
    'Ticket reopened for communication only; the payment review result is unchanged.',
}

export function corporateTransferLocalizedText(
  text: string
): CorporateTransferLocalizedText | null {
  const key = corporateTransferExactTextKeys[text.trim()]
  if (key) return { key }

  const fulfilled = text.match(
    /^到账核验完成：订单 (.+)，到账金额 ¥([0-9.]+)，权益已发放。$/
  )
  if (fulfilled) {
    return {
      key: 'Receipt verified for order {{orderNo}}. Amount ¥{{amount}}; entitlement fulfilled.',
      values: { orderNo: fulfilled[1], amount: fulfilled[2] },
    }
  }

  const refunded = text.match(/^退款已登记：¥([0-9.]+)，退款流水 (.+)。$/)
  if (refunded) {
    return {
      key: 'Refund registered: ¥{{amount}}, reference {{reference}}.',
      values: { amount: refunded[1], reference: refunded[2] },
    }
  }
  return null
}

export function corporateTransferReceiptStatusKey(status: string): string {
  if (status === 'active') return 'Valid'
  if (status === 'voided') return 'Voided'
  return status
}

export function corporateTransferTicketTitle(
  subject: string
): CorporateTransferLocalizedText | null {
  const match = subject.match(
    /^(?:对公转账凭证|Corporate transfer evidence)[:：]\s*(.+)$/
  )
  if (!match) return null
  return {
    key: 'Corporate transfer evidence: {{orderNo}}',
    values: { orderNo: match[1] },
  }
}

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
