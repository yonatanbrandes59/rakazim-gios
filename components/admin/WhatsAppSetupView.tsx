'use client'

import { useState, useEffect, useCallback } from 'react'

interface WaStatus {
  connected: boolean
  configured: boolean
  webhookUrl: string
  webhookVerifyToken: string | null
  appSecretSet: boolean
  missing?: string[]
  phoneInfo?: {
    display_phone_number?: string
    verified_name?: string
  } | null
  apiError?: string | null
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-brand-100 text-brand-700 hover:bg-brand-200 transition-colors font-medium shrink-0"
    >
      {copied ? '✅ הועתק!' : `📋 ${label}`}
    </button>
  )
}

function CodeBox({ value, label }: { value: string; label: string }) {
  return (
    <div className="space-y-1">
      <div className="text-xs text-gray-500 font-medium">{label}</div>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-xs bg-gray-900 text-green-400 px-3 py-2 rounded-lg font-mono break-all min-w-0">
          {value}
        </code>
        <CopyButton text={value} label="העתק" />
      </div>
    </div>
  )
}

const SETUP_STEPS = [
  {
    icon: '🌐',
    title: 'צור אפליקציית Meta Business',
    content: (
      <>
        <p>לך ל-<strong>developers.facebook.com</strong> וצור אפליקציה חדשה מסוג <em>Business</em>.</p>
        <p className="mt-1 text-gray-500">אם כבר יש לך — דלג לשלב הבא.</p>
      </>
    ),
    link: { href: 'https://developers.facebook.com/apps/', label: '→ פתח Meta Developers' },
  },
  {
    icon: '📱',
    title: 'הוסף מוצר WhatsApp',
    content: (
      <>
        <p>בלוח הניהול של האפליקציה, לחץ <strong>הוסף מוצר</strong> ← בחר <strong>WhatsApp</strong>.</p>
        <p className="mt-1 text-gray-500">עבור לטאב <em>API Setup</em> כדי לקבל את Phone Number ID והטוקן.</p>
      </>
    ),
  },
  {
    icon: '🔑',
    title: 'הגדר משתני סביבה ב-Vercel',
    content: (
      <>
        <p>לך להגדרות הפרויקט שלך ב-Vercel והוסף את המשתנים הבאים:</p>
        <div className="mt-2 space-y-1.5 text-xs font-mono bg-gray-50 rounded-lg p-3 border">
          <div><span className="text-blue-600">WHATSAPP_PHONE_NUMBER_ID</span>=<span className="text-gray-400">ה-Phone Number ID מ-Meta</span></div>
          <div><span className="text-blue-600">WHATSAPP_CLOUD_API_TOKEN</span>=<span className="text-gray-400">הטוקן הקבוע (System User Token)</span></div>
          <div><span className="text-blue-600">WHATSAPP_WEBHOOK_VERIFY_TOKEN</span>=<span className="text-gray-400">כל מחרוזת סודית שתבחר</span></div>
          <div><span className="text-blue-600">WHATSAPP_APP_SECRET</span>=<span className="text-gray-400">App Secret מהגדרות האפליקציה (אבטחה)</span></div>
        </div>
        <p className="mt-2 text-gray-500">⚠️ אחרי שמירה — צריך לעשות <strong>Redeploy</strong> ב-Vercel כדי שהמשתנים ייכנסו לתוקף.</p>
      </>
    ),
    link: { href: 'https://vercel.com/dashboard', label: '→ פתח Vercel Dashboard' },
  },
  {
    icon: '🔗',
    title: 'הגדר Webhook ב-Meta',
    content: (
      <p>בהגדרות ה-WhatsApp ב-Meta, לחץ <strong>Configure Webhooks</strong> ← הזן את הכתובת וה-Verify Token (ראה למטה). אחרי אימות, הירשם ל-<strong>messages</strong>.</p>
    ),
  },
  {
    icon: '✅',
    title: 'בדוק חיבור',
    content: (
      <p>השתמש בסקשן <strong>בדיקת שליחה</strong> למטה כדי לוודא שהכל עובד.</p>
    ),
  },
]

export function WhatsAppSetupView() {
  const [status, setStatus] = useState<WaStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [testPhone, setTestPhone] = useState('')
  const [testResult, setTestResult] = useState<{ ok: boolean; messageId?: string; error?: string } | null>(null)
  const [testLoading, setTestLoading] = useState(false)

  const fetchStatus = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/whatsapp/status')
      if (res.ok) setStatus(await res.json() as WaStatus)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetchStatus() }, [fetchStatus])

  async function handleTestSend() {
    if (!testPhone.trim()) return
    setTestLoading(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/whatsapp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: testPhone.trim() }),
      })
      const data = await res.json() as { ok: boolean; messageId?: string; error?: string }
      setTestResult(data)
    } catch {
      setTestResult({ ok: false, error: 'שגיאת רשת' })
    } finally {
      setTestLoading(false)
    }
  }

  return (
    <div className="max-w-3xl space-y-6" dir="rtl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">חיבור WhatsApp Business</h1>
        <p className="text-gray-500 mt-1">
          הגדר את המספר העסקי שלך — השאלון שלנו ירוץ ישירות בוואטסאפ של המועמדים.
        </p>
      </div>

      {/* Status Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className={`px-5 py-4 flex items-center gap-3 ${status?.connected ? 'bg-green-50 border-b border-green-100' : status?.configured ? 'bg-yellow-50 border-b border-yellow-100' : 'bg-red-50 border-b border-red-100'}`}>
          <div className={`w-3 h-3 rounded-full shrink-0 ${status?.connected ? 'bg-green-500' : status?.configured ? 'bg-yellow-500 animate-pulse' : 'bg-red-400'}`} />
          <div>
            <div className="font-semibold text-gray-900">
              {loading ? 'בודק חיבור...'
                : status?.connected ? `✅ מחובר — ${status.phoneInfo?.display_phone_number ?? ''}`
                : status?.configured ? '⏳ מוגדר — ממתין לאימות'
                : '❌ לא מוגדר'}
            </div>
            {status?.phoneInfo?.verified_name && (
              <div className="text-sm text-gray-500">{status.phoneInfo.verified_name}</div>
            )}
            {status?.apiError && (
              <div className="text-sm text-red-600 mt-0.5">{status.apiError}</div>
            )}
            {status?.missing && status.missing.length > 0 && (
              <div className="text-sm text-red-600 mt-0.5">
                חסרים: {status.missing.join(', ')}
              </div>
            )}
          </div>
          <button
            onClick={fetchStatus}
            className="mr-auto text-xs px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            🔄 רענן
          </button>
        </div>

        {/* Webhook & Token info */}
        <div className="px-5 py-4 space-y-3">
          <CodeBox
            label="Webhook URL — הכנס ב-Meta Developer Console"
            value={status?.webhookUrl ?? 'טוען...'}
          />
          {status?.webhookVerifyToken && (
            <CodeBox
              label="Verify Token — הכנס ב-Meta Developer Console"
              value={status.webhookVerifyToken}
            />
          )}
          {!status?.appSecretSet && status?.configured && (
            <div className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 border border-amber-100">
              ⚠️ <strong>WHATSAPP_APP_SECRET</strong> לא מוגדר — אימות חתימת Webhook מושבת (פחות מאובטח).
            </div>
          )}
        </div>
      </div>

      {/* Setup guide */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-bold text-gray-800 mb-4">הדרכה לחיבור</h2>
        <ol className="space-y-4">
          {SETUP_STEPS.map((step, i) => (
            <li key={i} className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-800 flex items-center gap-2">
                  <span>{step.icon}</span> {step.title}
                </div>
                <div className="text-sm text-gray-600 mt-1">{step.content}</div>
                {step.link && (
                  <a
                    href={step.link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-1.5 text-xs text-brand-600 hover:text-brand-800 underline"
                  >
                    {step.link.label}
                  </a>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* How it works */}
      <div className="bg-brand-50 rounded-2xl border border-brand-100 p-5">
        <h2 className="font-bold text-brand-900 mb-3">🤖 איך עובד הצ&apos;אטבוט?</h2>
        <ul className="space-y-2 text-sm text-brand-800">
          <li>✅ מועמד שולח הודעה לוואטסאפ העסקי ← הבוט מזהה אותו לפי מספר טלפון</li>
          <li>✅ אם לא מילא שאלון — הבוט מריץ את כל 20 השאלות ישירות בוואטסאפ</li>
          <li>✅ שאלות עם אפשרויות מופיעות כ-Buttons אינטרקטיביים ← לחיצה אחת בלבד</li>
          <li>✅ בסיום — הבוט שומר את כל הנתונים, מחשב ציון התאמה, ומפעיל אוטומציות</li>
          <li>✅ מועמד שכבר מילא שאלון מקבל תשובה אנושית (לא עובר שוב את השאלון)</li>
          <li>✅ הקלדת &quot;הסר&quot; / &quot;לא מעוניין&quot; / &quot;STOP&quot; מבצעת Opt-out אוטומטי</li>
        </ul>
        <p className="mt-3 text-xs text-brand-600">
          💡 הודעות הבוט הן חינמיות — הן נשלחות בחלון ה-24 שעות של שיחה שנפתחה על ידי הלקוח.
        </p>
      </div>

      {/* Test send */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-bold text-gray-800 mb-1">🧪 בדיקת שליחה</h2>
        <p className="text-sm text-gray-500 mb-3">שלח הודעת בדיקה למספר כדי לוודא שהחיבור עובד.</p>
        <div className="flex gap-2">
          <input
            type="tel"
            value={testPhone}
            onChange={e => setTestPhone(e.target.value)}
            placeholder="054-1234567 או 972541234567"
            className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 text-right"
            dir="ltr"
          />
          <button
            onClick={handleTestSend}
            disabled={testLoading || !testPhone.trim() || !status?.configured}
            className="px-5 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {testLoading ? '...' : '📤 שלח בדיקה'}
          </button>
        </div>
        {!status?.configured && (
          <p className="text-xs text-gray-400 mt-2">WhatsApp לא מוגדר — בדיקה לא זמינה</p>
        )}
        {testResult && (
          <div className={`mt-3 px-4 py-3 rounded-xl text-sm font-medium ${testResult.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>
            {testResult.ok
              ? `✅ הודעה נשלחה בהצלחה! (ID: ${testResult.messageId ?? '—'})`
              : `❌ שגיאה: ${testResult.error}`}
          </div>
        )}
      </div>
    </div>
  )
}
