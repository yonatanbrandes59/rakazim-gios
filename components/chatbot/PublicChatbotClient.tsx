'use client'
import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { PUBLIC_QUESTIONS } from './public-questions'

type Message = { role: 'bot' | 'user'; text: string }

const STORAGE_KEY = 'merakzim_public_questionnaire'

export function PublicChatbotClient() {
  const [messages, setMessages] = useState<Message[]>([])
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})
  const [step, setStep] = useState(0)
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [done, setDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [dateInput, setDateInput] = useState('')
  const [awaitingConsent, setAwaitingConsent] = useState(false)
  const [pendingAnswers, setPendingAnswers] = useState<Record<string, string | string[]> | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const currentQ = step < PUBLIC_QUESTIONS.length ? PUBLIC_QUESTIONS[step] : null

  function getNextStep(from: number, currentAnswers: Record<string, any>): number {
    let next = from + 1
    while (next < PUBLIC_QUESTIONS.length) {
      const q = PUBLIC_QUESTIONS[next]
      if (!q.condition || q.condition(currentAnswers)) return next
      next++
    }
    return PUBLIC_QUESTIONS.length
  }

  function persistAnswers(saved: Record<string, string | string[]>) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)) } catch { /* ignore */ }
  }

  function clearPersistedAnswers() {
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
  }

  useEffect(() => {
    let restoredAnswers: Record<string, string | string[]> = {}
    let resumeStep = 0

    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) restoredAnswers = JSON.parse(stored)
    } catch { /* ignore */ }

    if (Object.keys(restoredAnswers).length > 0) {
      let firstUnanswered = 0
      for (let i = 0; i < PUBLIC_QUESTIONS.length; i++) {
        const q = PUBLIC_QUESTIONS[i]
        if (q.condition && !q.condition(restoredAnswers)) continue
        if (restoredAnswers[q.key] !== undefined && restoredAnswers[q.key] !== '') {
          firstUnanswered = i + 1
        } else {
          break
        }
      }
      resumeStep = getNextStep(firstUnanswered - 1, restoredAnswers)
      if (resumeStep >= PUBLIC_QUESTIONS.length) resumeStep = PUBLIC_QUESTIONS.length - 1
      setAnswers(restoredAnswers)
    }

    const firstName = restoredAnswers['first_name'] as string | undefined

    setTimeout(() => {
      if (Object.keys(restoredAnswers).length > 0 && resumeStep > 0) {
        addBotMsg(
          firstName
            ? `ברוך שובך, ${firstName}! 👋\nמצאתי את ההתקדמות הקודמת שלך. ממשיכים מאיפה שעצרנו 🔄`
            : 'ברוך שובך! 👋\nמצאתי את ההתקדמות הקודמת שלך. ממשיכים מאיפה שעצרנו 🔄'
        )
        setTimeout(() => showQuestion(resumeStep, restoredAnswers), 1200)
      } else {
        addBotMsg(
          'היי! 👋\nשמי הרובוט של האיחוד החקלאי 🤖✨\n\n' +
          'אני הולך לשאול אותך כמה שאלות קצרות שיעזרו לנו להבין אם תפקיד **רכז/ת נוער** הוא הדבר הנכון עבורך.\n\n' +
          'זה לוקח בערך 5 דקות. מוכן/ה? 🚀'
        )
      }
    }, 500)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    if (stepIdx >= PUBLIC_QUESTIONS.length) return
    const q = PUBLIC_QUESTIONS[stepIdx]
    if (q.condition && !q.condition(currentAnswers)) {
      showQuestion(getNextStep(stepIdx, currentAnswers), currentAnswers)
      return
    }
    setStep(stepIdx)
    addBotMsg(q.questionText)
  }

  function handleAnswer(value: string | string[]) {
    const q = PUBLIC_QUESTIONS[step]
    if (!q) return

    const displayVal = Array.isArray(value)
      ? value.map(v => q.options?.find(o => o.value === v)?.label || v).join(', ')
      : (q.options?.find(o => o.value === value)?.label || value)

    setMessages(prev => [...prev, { role: 'user', text: displayVal }])

    const newAnswers = { ...answers, [q.key]: value }
    setAnswers(newAnswers)
    persistAnswers(newAnswers)

    const next = getNextStep(step, newAnswers)
    if (next >= PUBLIC_QUESTIONS.length) {
      setPendingAnswers(newAnswers)
      setTimeout(() => {
        addBotMsg(
          'לפני שנסיים — נדרשת הסכמתך לעיבוד המידע שלך.\n\n' +
          'האיחוד החקלאי ישמור את פרטיך ותשובותיך לצורך הערכת התאמתך לתפקיד רכז/ת נוער, ויצור עמך קשר. המידע ישמר עד שנתיים ולא יועבר לגורמים מסחריים.\n\n' +
          'לפרטים נוספים: rakazim-gios.vercel.app/privacy\n\n' +
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
      clearPersistedAnswers()
      addBotMsg('בסדר גמור. פרטיך לא יישמרו. תוכל/י לפנות אלינו בכל עת אם תרצה/י להצטרף בעתיד. 💙')
      return
    }

    const finalAnswers = pendingAnswers!
    addBotMsg('תודה! 🙏 שומר את התשובות שלך...')
    setSubmitting(true)

    try {
      const answersArray = PUBLIC_QUESTIONS
        .filter(q => finalAnswers[q.key] !== undefined && finalAnswers[q.key] !== '')
        .map(q => {
          const val = finalAnswers[q.key]
          return {
            question_key: q.key,
            question_text: q.questionText,
            answer: Array.isArray(val) ? val.join(', ') : String(val || ''),
          }
        })

      const res = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: answersArray, consent: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'שגיאה בשמירה')

      clearPersistedAnswers()
      setSubmitSuccess(true)
      setTimeout(() => {
        addBotMsg(
          `✅ סיימנו!\n\n` +
          `התשובות שלך נשמרו בהצלחה. אחד מהרכזים/ות האזוריים שלנו יצור איתך קשר בקרוב 💙\n\n` +
          `תודה שהתעניינת! 🌟`
        )
      }, 1000)
    } catch (err: any) {
      setDone(false)
      addBotMsg(`אופס, הייתה תקלה: ${err.message || 'שגיאה לא ידועה'}. אנא פנה/י אלינו ישירות. 🙏`)
    } finally {
      setSubmitting(false)
    }
  }

  const q = currentQ
  const totalVisible = PUBLIC_QUESTIONS.filter(q => !q.condition || q.condition(answers)).length

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
          <div className="text-blue-200 text-xs">שאלון גיוס – רכז/ת נוער</div>
        </div>
        <div className="flex-1" />
        {!done && (
          <div className="text-right">
            <div className="text-white text-xs font-bold">{Math.min(step + 1, PUBLIC_QUESTIONS.length)}/{totalVisible}</div>
            <div className="w-24 h-1.5 bg-white/30 rounded-full mt-1">
              <div
                className="h-full bg-white rounded-full transition-all duration-500"
                style={{ width: `${Math.min(((step + 1) / PUBLIC_QUESTIONS.length) * 100, 100)}%` }}
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
                  onKeyDown={e => { if (e.key === 'Enter' && (input.trim() || q.optional)) handleAnswer(input.trim()) }}
                  className="flex-1 bg-white/90 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-white/50 text-gray-800"
                  placeholder={q.placeholder || 'הקלד/י כאן...'}
                  autoFocus
                  inputMode={q.key === 'phone' ? 'tel' : 'text'}
                  type={q.key === 'email' ? 'email' : 'text'}
                  dir={q.key === 'email' ? 'ltr' : 'rtl'}
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

        {/* Consent buttons */}
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
            <div className="text-white/60 text-sm">
              {submitSuccess ? '✅ השאלון הוגש בהצלחה' : 'השאלון הסתיים 🎉'}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-4 text-white/30 text-xs text-center space-x-2">
        <span>האיחוד החקלאי · גיוס רכזים ורכזות נוער</span>
        <span>·</span>
        <a href="/privacy" className="underline hover:text-white/50 transition-colors">מדיניות פרטיות</a>
      </div>
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
