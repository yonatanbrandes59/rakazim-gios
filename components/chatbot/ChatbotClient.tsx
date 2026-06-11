'use client'
import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { Candidate } from '@/lib/types'
import { QUESTIONS } from './questions'

interface Props {
  candidate: Candidate
  token: string
}

type Message = { role: 'bot' | 'user'; text: string }

const STORAGE_KEY_PREFIX = 'merakzim_questionnaire_'

export function ChatbotClient({ candidate, token }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})
  const [step, setStep] = useState(0)
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [done, setDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [dateInput, setDateInput] = useState('')
  // Consent flow state
  const [awaitingConsent, setAwaitingConsent] = useState(false)
  const [pendingAnswers, setPendingAnswers] = useState<Record<string, string | string[]> | null>(null)
  // Opt-out confirmation state
  const [showOptOutConfirm, setShowOptOutConfirm] = useState(false)
  const [optOutDone, setOptOutDone] = useState(false)
  const [optOutSubmitting, setOptOutSubmitting] = useState(false)
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

  function storageKey() {
    return `${STORAGE_KEY_PREFIX}${token}`
  }

  function persistAnswers(savedAnswers: Record<string, string | string[]>) {
    try {
      localStorage.setItem(storageKey(), JSON.stringify(savedAnswers))
    } catch {
      // localStorage may be unavailable (private mode, storage quota)
    }
  }

  function clearPersistedAnswers() {
    try {
      localStorage.removeItem(storageKey())
    } catch {
      // ignore
    }
  }

  // Initial greeting + resume from localStorage
  useEffect(() => {
    let restoredAnswers: Record<string, string | string[]> = {}
    let resumeStep = 0

    try {
      const stored = localStorage.getItem(storageKey())
      if (stored) {
        restoredAnswers = JSON.parse(stored)
      }
    } catch {
      // ignore parse errors
    }

    if (Object.keys(restoredAnswers).length > 0) {
      // Fast-forward to the first unanswered question
      let firstUnanswered = 0
      for (let i = 0; i < QUESTIONS.length; i++) {
        const q = QUESTIONS[i]
        if (q.condition && !q.condition(restoredAnswers)) continue
        if (restoredAnswers[q.key] !== undefined && restoredAnswers[q.key] !== '') {
          firstUnanswered = i + 1
        } else {
          break
        }
      }
      resumeStep = getNextStep(firstUnanswered - 1, restoredAnswers)
      if (resumeStep >= QUESTIONS.length) resumeStep = QUESTIONS.length - 1

      setAnswers(restoredAnswers)
    }

    setTimeout(() => {
      if (Object.keys(restoredAnswers).length > 0 && resumeStep > 0) {
        addBotMsg(`ברוך שובך, ${candidate.first_name}! 👋\nמצאתי את ההתקדמות הקודמת שלך. ממשיכים מאיפה שעצרנו 🔄`)
        setTimeout(() => showQuestion(resumeStep, restoredAnswers), 1200)
      } else {
        addBotMsg(`היי ${candidate.first_name}! 👋\nשמי הרובוט של רכזים בדרך 🤖✨\n\nאני הולך לשאול אותך כמה שאלות קצרות שיעזרו לנו להבין אם תפקיד **רכז/ת נוער** הוא הדבר הנכון עבורך.\n\nזה לוקח בערך 5 דקות. מוכן/ה? 🚀`)
      }
    }, 500)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Show first question after greeting (only for fresh starts without resume)
  useEffect(() => {
    if (messages.length === 1 && !typing && Object.keys(answers).length === 0) {
      setTimeout(() => showQuestion(0, answers), 800)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    persistAnswers(newAnswers)

    const next = getNextStep(step, newAnswers)
    if (next >= QUESTIONS.length) {
      // Show consent step before submitting
      setPendingAnswers(newAnswers)
      setTimeout(() => {
        addBotMsg(
          'לפני שנסיים — נדרשת הסכמתך לעיבוד המידע שלך.\n\n' +
          'רכזים בדרך תשמור את פרטיך ותשובותיך לצורך הערכת התאמתך לתפקיד רכז/ת נוער, ותשתמש בהם ליצירת קשר עמך. המידע ישמר למשך שנתיים לכל היותר.\n\n' +
          'לצפייה במדיניות הפרטיות: https://merakzim.org/privacy\n\n' +
          'האם אתה/את מסכים/ה לעיבוד הנתונים שלך? ✅'
        )
        setAwaitingConsent(true)
        setDone(true)
      }, 400)
    } else {
      setTimeout(() => showQuestion(next, newAnswers), 400)
    }
    setInput('')
    setDateInput('')
    scrollDown()
  }

  async function handleConsentAnswer(agreed: boolean) {
    setMessages(prev => [...prev, { role: 'user', text: agreed ? 'מסכים/ה ✅' : 'לא מסכים/ה ❌' }])
    setAwaitingConsent(false)

    if (!agreed) {
      addBotMsg('בסדר גמור. פרטיך לא יישמרו. תוכל/י לפנות אלינו בכל עת אם תרצה/י להצטרף בעתיד. 💙')
      // Trigger opt-out via POST
      try {
        await fetch(`/api/questionnaire/${token}/optout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      } catch {
        // best-effort
      }
      clearPersistedAnswers()
      setOptOutDone(true)
      return
    }

    // Consent given — submit answers
    const finalAnswers = pendingAnswers!
    addBotMsg('תודה! 🙏 שומר את התשובות שלך...')
    setSubmitting(true)
    try {
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
      clearPersistedAnswers()
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

  async function handleOptOut() {
    setOptOutSubmitting(true)
    try {
      const res = await fetch(`/api/questionnaire/${token}/optout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'שגיאה')
      clearPersistedAnswers()
      setOptOutDone(true)
      setShowOptOutConfirm(false)
    } catch (err: any) {
      alert(`אירעה שגיאה: ${err.message || 'שגיאה לא ידועה'}`)
    } finally {
      setOptOutSubmitting(false)
    }
  }

  const q = currentQ

  if (optOutDone) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-800 via-brand-700 to-blue-600 flex flex-col items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-sm rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center">
          <div className="text-4xl mb-4">✅</div>
          <div className="text-white font-bold text-lg mb-2">הוסרת מהרשימה</div>
          <div className="text-white/70 text-sm">בקשתך נקלטה. לא נצור איתך קשר. אם תרצה/י להצטרף בעתיד — ניתן לפנות אלינו ישירות.</div>
        </div>
      </div>
    )
  }

  if (showOptOutConfirm) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-800 via-brand-700 to-blue-600 flex flex-col items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-sm rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <div className="text-white font-bold text-lg mb-3">האם אתה בטוח שברצונך להסיר את עצמך?</div>
          <div className="text-white/70 text-sm mb-6">לאחר האישור, לא נצור איתך קשר ולא נשמור את פרטיך למטרת גיוס.</div>
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleOptOut}
              disabled={optOutSubmitting}
              className="px-5 py-2.5 rounded-xl bg-red-500 hover:bg-red-400 text-white font-bold text-sm transition-all disabled:opacity-50"
            >
              {optOutSubmitting ? 'מסיר...' : 'כן, הסר אותי'}
            </button>
            <button
              onClick={() => setShowOptOutConfirm(false)}
              className="px-5 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-sm transition-all"
            >
              ביטול
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-800 via-brand-700 to-blue-600 flex flex-col items-center justify-start p-4 pt-6">
      {/* Header */}
      <div className="w-full max-w-md mb-4 flex items-center gap-3">
        <Image
          src="/logo.png"
          alt="האיחוד החקלאי"
          width={44}
          height={44}
          className="rounded-full shadow-lg bg-white p-0.5 shrink-0"
        />
        <div>
          <div className="text-white font-black">האיחוד החקלאי</div>
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

        {/* Consent buttons — shown after all questions are answered */}
        {awaitingConsent && !typing && (
          <div className="p-4 border-t border-white/20">
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => handleConsentAnswer(true)}
                className="px-5 py-2.5 rounded-xl bg-green-500 hover:bg-green-400 text-white font-bold text-sm transition-all hover:scale-105 active:scale-95 shadow-sm"
              >
                מסכים/ה ✅
              </button>
              <button
                onClick={() => handleConsentAnswer(false)}
                className="px-5 py-2.5 rounded-xl bg-white/90 hover:bg-white text-gray-700 font-bold text-sm transition-all hover:scale-105 active:scale-95 shadow-sm"
              >
                לא מסכים/ה ❌
              </button>
            </div>
          </div>
        )}

        {done && !submitting && !awaitingConsent && (
          <div className="p-4 text-center">
            <div className="text-white/60 text-sm">השאלון הסתיים 🎉</div>
          </div>
        )}
      </div>

      {/* Opt-out button — opens confirmation screen instead of a prefetch-vulnerable GET link */}
      {!done && (
        <button
          onClick={() => setShowOptOutConfirm(true)}
          className="mt-4 text-white/40 hover:text-white/70 text-xs transition-colors bg-transparent border-none cursor-pointer"
        >
          הסר/י אותי מהרשימה
        </button>
      )}
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
