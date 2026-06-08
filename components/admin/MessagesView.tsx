'use client'
import { useState, useMemo } from 'react'
import { MessageQueueItem, Candidate, MessageStatus } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { formatDateTime } from '@/lib/utils'

interface Props {
  initialMessages: MessageQueueItem[]
  candidateMap: Record<string, Candidate>
}

const STATUS_LABELS: Record<MessageStatus, string> = {
  pending: 'ממתין',
  sent: 'נשלח',
  failed: 'נכשל',
  cancelled: 'בוטל',
  mock_sent: 'Mock ✓',
  blocked_paid_provider: 'חסום (בתשלום)',
  ready_for_manual_whatsapp: 'ממתין לשליחה ידנית',
}

const STATUS_COLORS: Record<MessageStatus, string> = {
  pending: 'bg-amber-100 text-amber-800',
  sent: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-600',
  mock_sent: 'bg-blue-100 text-blue-800',
  blocked_paid_provider: 'bg-red-50 text-red-700',
  ready_for_manual_whatsapp: 'bg-yellow-100 text-yellow-800',
}

export function MessagesView({ initialMessages, candidateMap }: Props) {
  const [messages, setMessages] = useState(initialMessages)
  const [running, setRunning] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  async function runQueue() {
    setRunning(true)
    try {
      await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'process_queue' }),
      })
      const res = await fetch('/api/messages')
      if (res.ok) setMessages(await res.json())
    } finally {
      setRunning(false)
    }
  }

  async function copyText(text: string, id: string) {
    await navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const byStatus = useMemo(() => {
    const groups: Partial<Record<MessageStatus, MessageQueueItem[]>> = {}
    for (const m of messages) {
      if (!groups[m.status]) groups[m.status] = []
      groups[m.status]!.push(m)
    }
    return groups
  }, [messages])

  const manual = byStatus['ready_for_manual_whatsapp'] || []
  const pending = byStatus['pending'] || []
  const sent = [...(byStatus['sent'] || []), ...(byStatus['mock_sent'] || [])]
  const blocked = byStatus['blocked_paid_provider'] || []

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900">הודעות</h1>
          <p className="text-gray-500 text-sm mt-0.5">תור ההודעות, לינקי וואטסאפ ידניים, ויומן שליחות</p>
        </div>
        <Button onClick={runQueue} loading={running} variant="secondary">⚙️ הרץ אוטומציות</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'שליחה ידנית', count: manual.length, color: 'bg-yellow-50 border-yellow-200' },
          { label: 'ממתינים', count: pending.length, color: 'bg-amber-50 border-amber-200' },
          { label: 'נשלחו', count: sent.length, color: 'bg-green-50 border-green-200' },
          { label: 'חסומים', count: blocked.length, color: 'bg-red-50 border-red-200' },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl p-4 border text-center ${s.color}`}>
            <p className="text-2xl font-black text-gray-900">{s.count}</p>
            <p className="text-xs text-gray-600">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Manual WhatsApp */}
      {manual.length > 0 && (
        <Section title="📲 ממתינים לשליחה ידנית בוואטסאפ" count={manual.length}>
          {manual.map(m => <MessageRow key={m.id} m={m} candidateMap={candidateMap} copied={copied} onCopy={copyText} showWA />)}
        </Section>
      )}

      {/* Pending */}
      {pending.length > 0 && (
        <Section title="⏳ ממתינים לעיבוד" count={pending.length}>
          {pending.map(m => <MessageRow key={m.id} m={m} candidateMap={candidateMap} copied={copied} onCopy={copyText} />)}
        </Section>
      )}

      {/* Sent */}
      {sent.length > 0 && (
        <Section title="✅ נשלחו" count={sent.length}>
          {sent.map(m => <MessageRow key={m.id} m={m} candidateMap={candidateMap} copied={copied} onCopy={copyText} />)}
        </Section>
      )}

      {/* Blocked */}
      {blocked.length > 0 && (
        <Section title="🚫 חסומים (שירות בתשלום)" count={blocked.length}>
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 mb-3">
            FREE_MODE=true חוסם שירותי הודעות בתשלום. הפעל את FREE_MODE=false + ספק API key כדי לשלוח אוטומטית.
          </div>
          {blocked.map(m => <MessageRow key={m.id} m={m} candidateMap={candidateMap} copied={copied} onCopy={copyText} showWA />)}
        </Section>
      )}

      {messages.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-3">📭</div>
          <p>אין הודעות בתור</p>
        </div>
      )}
    </div>
  )
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
        <h2 className="font-bold text-gray-800">{title}</h2>
        <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-0.5 rounded-full">{count}</span>
      </div>
      <div className="divide-y divide-gray-50">
        {children}
      </div>
    </div>
  )
}

function MessageRow({
  m, candidateMap, copied, onCopy, showWA
}: {
  m: MessageQueueItem
  candidateMap: Record<string, Candidate>
  copied: string | null
  onCopy: (text: string, id: string) => void
  showWA?: boolean
}) {
  const candidate = m.candidate_id ? candidateMap[m.candidate_id] : undefined
  return (
    <div className="px-5 py-3 flex items-start gap-3 text-sm hover:bg-gray-50">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[m.status]}`}>
            {STATUS_LABELS[m.status]}
          </span>
          <span className="text-xs text-gray-500">{m.message_type}</span>
          <span className="text-xs text-gray-400">|</span>
          <span className="text-xs text-gray-500">{m.channel}</span>
          {candidate && (
            <>
              <span className="text-xs text-gray-400">|</span>
              <span className="font-medium text-brand-700 text-xs">{candidate.full_name}</span>
            </>
          )}
        </div>
        <p className="text-gray-700 text-xs truncate max-w-xl">{m.message_body}</p>
        <p className="text-gray-400 text-xs mt-0.5">{formatDateTime(m.created_at)}</p>
      </div>
      <div className="flex gap-1 shrink-0">
        <button
          onClick={() => onCopy(m.message_body, m.id + '-body')}
          className="text-xs px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
          title="העתק הודעה"
        >
          {copied === m.id + '-body' ? '✅' : '📋'}
        </button>
        {showWA && m.whatsapp_manual_link && (
          <a
            href={m.whatsapp_manual_link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs px-2 py-1 rounded-lg bg-[#25D366] text-white hover:bg-[#20bf5b] transition-colors"
          >
            💬 פתח
          </a>
        )}
      </div>
    </div>
  )
}
