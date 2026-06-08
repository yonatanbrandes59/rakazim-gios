'use client'
import { useState, useEffect, useRef } from 'react'
import { Candidate } from '@/lib/types'
import { QUESTIONS } from './questions'

interface Props {
  candidate: Candidate
  token: string
}

type Message = { role: 'bot' | 'user'; text: string }

export function ChatbotClient({ candidate, token }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})
  const [step, setStep] = useState(0)
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [done, setDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [dateInput, setDateInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const currentQ = step < QUESTIONS.length ? QUESTIONS[step] : null

  // Filter questions based on conditions
  function getNextStep(from: number, currentAnswers: Record<string, any>): number {
    let next = from + 1
    while (next < QUESTIONS.length) {
      const q = QUESTIONS[next]
      if (!q.condition || q.condition(currentAnswers)) return next
      next++
    }
    return QUESTIONS.length // done
  }

  // Initial greeting
  useEffect(() => {
    setTimeout(() => {
      addBotMsg(`היי ${candidate.first_name}! 👋\nשמי הרובוט של רכזים בדרך 🤖✨\n\nאני הולך לשאול אותך כמה שאלות קצרות שיעזרו לנו להבין אם תפקיד **רכז/ת נוער** הוא הדבר הנכון עבורך.\n\nזה לוקח בערך 5 דקות. מוכן/ה? 🚀`)
    }, 500)
  }, [])

  // Show next question after greeting resolves
  useEffect(() => {
    if (messages.length === 1 && !typing) {
      setTimeout(() => showQuestion(0, answers), 800)
    }
  }, [messages.length, typing])

  function addBotMsg(text: string) {
    setTyping(true)
    setTimeout(() => {
      setMessages(prev => [...prev, { role: 'bot', text }])
      setTyping(false)
      scrollDown()
    }, 600)
  }

  function scrollDown() {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  function showQuestion(stepIdx: number, currentAnswers: Record<string, any>) {
    if (stepIdx >= QUESTIONS.length) return
    const q = QUESTIONS[stepIdx]
    if (q.condition && !q.condition(currentAnswers)) {
      const next = getNextStep(stepIdx, currentAnswers)
      showQuestion(next, currentAnswers)
      return
    }
    setStep(stepIdx)
    addBotMsg(q.questionText)
  }

  function handleAnswer(value: string | string[]) {
    const q = QUESTIONS[step]
    if (!q) return

    // Add user message
    const displayVal = Array.isArray(value)
      ? value.map(v => q.options?.find(o => o.value === v)?.label || v).join(', ')
      : (q.options?.find(o => o.value === value)?.label || value)

    setMessages(prev => [...prev, { role: 'user', text: displayVal }])

    const newAnswers = { ...answers, [q.key]: value }
    setAnswers(newAnswers)

    const next = getNextStep(step, newAnswers)
    if (next >= QUESTIONS.length) {
      handleFinish(newAnswers)
    } else {
      setTimeout(() => showQuestion(next, newAnswers), 400)
    }
    setInput('')
    setDateInput('')
    scrollDown()
  }

  async function handleFinish(finalAnswers: Record<string, string | string[]>) {
    addBotMsg('תודה! 🙏 שומר את התשובות שלך...')
    setDone(true)
    setSubmitting(true)
    try {
      // Transform answers from object to array format expected by the API
      const answersArray = QUESTIONS
        .filter(q => finalAnswers[q.key] !== undefined && finalAnswers[q.key] !== '')
        .map(q => {
          const val = finalAnswers[q.key]
          return {
            question_key: q.key,
            question_text: q.questionText,
            answer: Array.isArray(val) ? val.join(', ') : String(val || ''),
          }
        })

      const res = await fetch(`/api/questionnaire/${token}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: answersArray, consent: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'שגיאה בשמירה')
      setTimeout(() => {
        addBotMsg(`✅ סיימנו!\n\nהתשובות שלך נשמרו. אחד מהרכזים/ות האזוריים שלנו יצור איתך קשר בקרוב 💙\n\nתודה שהיית שותף/ה לתהליך הזה! 🌟`)
      }, 1000)
    } catch (err: any) {
      setDone(false)
      addBotMsg(`אופס, הייתה תקלה: ${err.message || 'שגיאה לא ידועה'}. אנא שלח/י לנו הודעה ישירה. 🙏`)
    } finally {
      setSubmitting(false)
    }
  }

  const q = currentQ

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-800 via-brand-700 to-blue-600 flex flex-col items-center justify-start p-4 pt-6">
      {/* Header */}
      <div className="w-full max-w-md mb-4 flex items-center gap-3">
        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-xl shadow-lg">🌟</div>
        <div>
          <div className="text-white font-black">רכזים בדרך</div>
          <div className="text-blue-200 text-xs">שאלון התאמה לתפקיד רכז/ת נוער</div>
        </div>
        {/* Progress */}
        <div className="flex-1" />
        {!done && (
          <div className="text-right">
            <div className="text-white text-xs font-bold">{Math.min(step + 1, QUESTIONS.length)}/{QUESTIONS.length}</div>
            <div className="w-24 h-1.5 bg-white/30 rounded-full mt-1">
              <div
                className="h-full bg-white rounded-full transition-all duration-500"
                style={{ width: `${Math.min(((step + 1) / QUESTIONS.length) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Chat */}
      <div className="w-full max-w-md bg-white/10 backdrop-blur-sm rounded-3xl shadow-2xl flex flex-col min-h-[60vh] max-h-[75vh] overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'} animate-[fadeSlideUp_0.3s_ease-out]`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === 'bot'
                  ? 'bg-white text-gray-800 rounded-tr-none shadow-sm'
                  : 'bg-brand-600 text-white rounded-tl-none'
              }`}>
                {m.text}
              </div>
            </div>
          ))}
          {typing && (
            <div className="flex justify-end">
              <div className="bg-white rounded-2xl rounded-tr-none px-4 py-3 shadow-sm">
                <div className="flex gap-1 items-center h-4">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-[dotPulse_1.4s_infinite_0ms]" />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-[dotPulse_1.4s_infinite_0.2s]" />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-[dotPulse_1.4s_infinite_0.4s]" />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        {!done && !typing && q && messages.length >= 2 && (
          <div className="p-4 border-t border-white/20">
            {(q.type === 'options' || q.type === 'confirm') && q.options && (
              <div className="flex flex-wrap gap-2">
                {q.options.map(o => (
                  <button
                    key={o.value}
                    onClick={() => handleAnswer(o.value)}
                    className="px-4 py-2 rounded-xl bg-white/90 hover:bg-white text-gray-800 text-sm font-medium shadow-sm transition-all hover:scale-105 active:scale-95"
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            )}

            {q.type === 'multiselect' && q.options && (
              <MultiSelectInput
                options={q.options}
                onSubmit={(vals) => handleAnswer(vals)}
              />
            )}

            {(q.type === 'text' || q.type === 'open') && (
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && input.trim()) handleAnswer(input.trim()) }}
                  className="flex-1 bg-white/90 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-white/50 text-gray-800"
                  placeholder={q.placeholder || 'הקלד/י כאן...'}
                  autoFocus
                />
                <button
                  onClick={() => { if (input.trim()) handleAnswer(input.trim()); else if (q.optional) handleAnswer('') }}
                  disabled={!input.trim() && !q.optional}
                  className="bg-white rounded-xl px-4 py-2 text-brand-700 font-bold text-sm disabled:opacity-40 hover:bg-white/90"
                >
                  {q.optional && !input.trim() ? 'דלג' : '→'}
                </button>
              </div>
            )}

            {q.type === 'date' && (
              <div className="flex gap-2">
                <input
                  type="date"
                  value={dateInput}
                  onChange={e => setDateInput(e.target.value)}
                  className="flex-1 bg-white/90 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-white/50 text-gray-800 ltr"
                  dir="ltr"
                />
                <button
                  onClick={() => { if (dateInput) handleAnswer(dateInput); else if (q.optional) handleAnswer('') }}
                  disabled={!dateInput && !q.optional}
                  className="bg-white rounded-xl px-4 py-2 text-brand-700 font-bold text-sm disabled:opacity-40 hover:bg-white/90"
                >
                  {q.optional && !dateInput ? 'דלג' : '→'}
                </button>
              </div>
            )}
          </div>
        )}

        {done && !submitting && (
          <div className="p-4 text-center">
            <div className="text-white/60 text-sm">השאלון הסתיים 🎉</div>
          </div>
        )}
      </div>

      {/* Opt-out link */}
      <a
        href={`/api/questionnaire/${token}/submit?action=optout`}
        className="mt-4 text-white/40 hover:text-white/70 text-xs transition-colors"
      >
        הסר/י אותי מהרשימה
      </a>
    </div>
  )
}

function MultiSelectInput({ options, onSubmit }: { options: { value: string; label: string }[]; onSubmit: (vals: string[]) => void }) {
  const [selected, setSelected] = useState<string[]>([])

  function toggle(v: string) {
    setSelected(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v])
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {options.map(o => (
          <button
            key={o.value}
            onClick={() => toggle(o.value)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all hover:scale-105 active:scale-95 ${
              selected.includes(o.value)
                ? 'bg-brand-600 text-white shadow-md'
                : 'bg-white/90 text-gray-800 shadow-sm'
            }`}
          >
            {selected.includes(o.value) ? '✓ ' : ''}{o.label}
          </button>
        ))}
      </div>
      <button
        onClick={() => onSubmit(selected)}
        disabled={selected.length === 0}
        className="w-full py-2.5 rounded-xl bg-white text-brand-700 font-bold text-sm disabled:opacity-40 hover:bg-white/90 transition-colors"
      >
        המשך →
      </button>
    </div>
  )
}
