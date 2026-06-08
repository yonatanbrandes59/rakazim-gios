'use client'
import { useState, useEffect, useRef } from 'react'
import { Candidate } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { createWhatsAppLink, formatDateTime } from '@/lib/utils'

interface ConversationMessage {
  id: string
  candidate_id: string
  direction: 'in' | 'out'
  body: string
  status?: string
  created_at: string
}

interface BrainAnalysis {
  suggestedMessage?: string
  nextAction?: string
  interestLevel?: string
  urgencyScore?: number
  reason?: string
}

interface Props {
  candidate: Candidate
  onClose?: () => void
}

export function ConversationThread({ candidate, onClose }: Props) {
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [analysis, setAnalysis] = useState<BrainAnalysis | null>(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [draftMessage, setDraftMessage] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMessagesLoading(true)
    fetch(`/api/conversations/${candidate.id}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setMessages(Array.isArray(data) ? data : (data.messages ?? [])))
      .catch(() => setMessages([]))
      .finally(() => setMessagesLoading(false))
  }, [candidate.id])

  useEffect(() => {
    setAnalysisLoading(true)
    fetch(`/api/brain/analyze/${candidate.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setAnalysis(data)
          if (data.suggestedMessage && !draftMessage) {
            setDraftMessage(data.suggestedMessage)
          }
        }
      })
      .catch(() => null)
      .finally(() => setAnalysisLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleOpenWhatsApp() {
    if (!draftMessage.trim()) return
    setSending(true)
    const link = createWhatsAppLink(candidate.phone, draftMessage)
    window.open(link, '_blank')
    try {
      await fetch(`/api/conversations/${candidate.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: draftMessage, direction: 'out' }),
      })
      const optimisticMsg: ConversationMessage = {
        id: `tmp-${Date.now()}`,
        candidate_id: candidate.id,
        direction: 'out',
        body: draftMessage,
        status: 'ready_for_manual_whatsapp',
        created_at: new Date().toISOString(),
      }
      setMessages(prev => [...prev, optimisticMsg])
      setDraftMessage('')
    } finally {
      setSending(false)
    }
  }

  const nextActionLabel = analysis?.nextAction ?? null

  return (
    <div className="flex flex-col h-full min-h-[20rem]" dir="rtl">
      {/* Brain analysis badge */}
      {analysisLoading && (
        <div className="mb-3 flex gap-2">
          <div className="h-6 w-32 bg-gray-100 animate-pulse rounded-full" />
          <div className="h-6 w-48 bg-gray-100 animate-pulse rounded-full" />
        </div>
      )}
      {!analysisLoading && analysis && (
        <div className="mb-3 flex flex-wrap gap-2 items-center">
          {nextActionLabel && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-brand-100 text-brand-700 border border-brand-200">
              🎯 {nextActionLabel}
            </span>
          )}
          {analysis.reason && (
            <span className="text-xs text-gray-500">{analysis.reason}</span>
          )}
        </div>
      )}

      {/* Messages thread */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-4 max-h-72 px-1">
        {messagesLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                <div className="h-10 w-48 bg-gray-100 animate-pulse rounded-2xl" />
              </div>
            ))}
          </div>
        )}

        {!messagesLoading && messages.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <div className="text-3xl mb-2">💬</div>
            <p className="text-sm">אין הודעות עדיין</p>
            <p className="text-xs mt-1">השתמש בכפתור למטה לשליחת הודעה ראשונה</p>
          </div>
        )}

        {!messagesLoading && messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.direction === 'out' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
                msg.direction === 'out'
                  ? 'bg-brand-700 text-white rounded-bl-sm'
                  : 'bg-gray-100 text-gray-800 rounded-br-sm'
              }`}
            >
              <p className="whitespace-pre-wrap leading-relaxed">{msg.body}</p>
              <div className={`text-xs mt-1 ${msg.direction === 'out' ? 'text-brand-200' : 'text-gray-400'}`}>
                {formatDateTime(msg.created_at)}
                {msg.status === 'ready_for_manual_whatsapp' && (
                  <span className="mr-1">• ממתין לשליחה ידנית</span>
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Compose area */}
      <div className="border-t border-gray-100 pt-3">
        <textarea
          value={draftMessage}
          onChange={e => setDraftMessage(e.target.value)}
          rows={4}
          className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
          placeholder="כתוב הודעה לוואטסאפ..."
          dir="rtl"
        />
        <div className="flex items-center gap-2 mt-2">
          {analysis?.suggestedMessage && draftMessage !== analysis.suggestedMessage && (
            <button
              type="button"
              onClick={() => setDraftMessage(analysis.suggestedMessage!)}
              className="text-xs text-brand-600 hover:text-brand-800 hover:underline"
            >
              ← השתמש בהודעה המומלצת
            </button>
          )}
          <div className="flex-1" />
          <Button
            variant="whatsapp"
            onClick={handleOpenWhatsApp}
            loading={sending}
            disabled={!draftMessage.trim()}
          >
            💬 פתח בוואטסאפ
          </Button>
        </div>
      </div>
    </div>
  )
}
