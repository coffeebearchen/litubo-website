/**
 * WeCom (企业微信) group-robot notification for new inquiries.
 *
 * The webhook URL is a secret (anyone holding it can post into the group), so it is read from the
 * running process (`process.env.WECOM_WEBHOOK_URL`), never from `runtimeConfig` or the client.
 *
 * Sending is best-effort: a failure is logged without contact details and never fails the form.
 */

export interface WecomInquiryPayload {
  id: number | null
  type: string
  name?: string | null
  company?: string | null
  email?: string | null
  country?: string | null
  phone?: string | null
  message?: string | null
  sourceUrl?: string | null
}

const TYPE_LABELS: Record<string, string> = {
  contact: 'Contact',
  technical_matching: 'Technical matching',
  distributor: 'Distributor',
  spare_parts: 'Spare parts',
  support_request: 'Support request',
  send_product_test: 'Send product for test',
}

function clip(value: string | null | undefined, max = 500): string {
  if (!value) return ''
  const text = value.trim()
  return text.length > max ? `${text.slice(0, max)}…` : text
}

export function wecomConfigured(): boolean {
  return Boolean(process.env.WECOM_WEBHOOK_URL?.trim())
}

export async function sendWecomInquiry(payload: WecomInquiryPayload): Promise<void> {
  const webhook = process.env.WECOM_WEBHOOK_URL?.trim()
  if (!webhook) return

  const rows: string[] = [
    '### 🔔 New inquiry — LITUBO',
    `> **Type:** ${TYPE_LABELS[payload.type] ?? payload.type}`,
  ]
  if (payload.id) rows.push(`> **ID:** #${payload.id}`)
  if (payload.name) rows.push(`> **Name:** ${clip(payload.name, 120)}`)
  if (payload.company) rows.push(`> **Company:** ${clip(payload.company, 160)}`)
  if (payload.email) rows.push(`> **Email:** ${clip(payload.email, 160)}`)
  if (payload.phone) rows.push(`> **Phone:** ${clip(payload.phone, 60)}`)
  if (payload.country) rows.push(`> **Country:** ${clip(payload.country, 80)}`)
  if (payload.sourceUrl) rows.push(`> **Page:** ${clip(payload.sourceUrl, 200)}`)
  const message = clip(payload.message, 600)
  if (message) {
    rows.push('', '**Requirement:**', message)
  }

  const body = {
    msgtype: 'markdown',
    markdown: { content: rows.join('\n') },
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 6000)
  try {
    const res = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (!res.ok) {
      console.error('[wecom] notification rejected', { status: res.status })
      return
    }
    const json = (await res.json().catch(() => null)) as { errcode?: number } | null
    if (json && typeof json.errcode === 'number' && json.errcode !== 0) {
      console.error('[wecom] notification error', { errcode: json.errcode })
    }
  }
  catch {
    console.error('[wecom] notification failed')
  }
  finally {
    clearTimeout(timer)
  }
}
