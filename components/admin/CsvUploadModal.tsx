'use client'
import { useState, useRef } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

interface Props {
  onClose: () => void
  onUploaded: () => void
}

export function CsvUploadModal({ onClose, onUploaded }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [sendOpening, setSendOpening] = useState(true)
  const [result, setResult] = useState<{ created: number; sent: number; errors: number; error_details: string[] } | null>(null)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleUpload() {
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const url = `/api/candidates/upload-csv${sendOpening ? '?send_opening=true' : ''}`
      const res = await fetch(url, { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'שגיאה בהעלאה')
      setResult(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <Modal isOpen onClose={onClose} title="ייבוא רשימת גרעין + שליחת הודעות">
      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
          <strong className="block mb-2">📋 פורמט CSV נדרש:</strong>
          <p className="font-mono text-xs">שם פרטי, שם משפחה, טלפון, גרעין, שנת גרעין, תאריך שחרור</p>
          <p className="text-xs mt-1 text-blue-600">שם משפחה הוא אופציונלי — שם פרטי + טלפון מספיקים</p>
          <a href="/api/candidates/upload-csv" className="text-blue-600 hover:underline text-xs mt-2 block">
            ⬇️ הורד תבנית CSV
          </a>
        </div>

        {!result ? (
          <>
            <div
              className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-brand-400 hover:bg-brand-50 transition-colors"
              onClick={() => inputRef.current?.click()}
            >
              <div className="text-4xl mb-2">📁</div>
              {file ? (
                <p className="font-medium text-brand-700">{file.name}</p>
              ) : (
                <p className="text-gray-500">לחץ לבחירת קובץ CSV</p>
              )}
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={e => setFile(e.target.files?.[0] || null)}
              />
            </div>

            <label className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded-xl cursor-pointer">
              <input
                type="checkbox"
                checked={sendOpening}
                onChange={e => setSendOpening(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-green-600"
              />
              <div>
                <p className="text-sm font-semibold text-green-800">📲 שלח הודעת וואטסאפ לכולם מיד לאחר ההעלאה</p>
                <p className="text-xs text-green-700 mt-0.5">
                  כל מועמד יקבל הודעה אישית עם שמו, תיאור התפקיד וקישור לשאלון הגיוס
                </p>
              </div>
            </label>

            {error && <p className="text-red-600 text-sm bg-red-50 rounded-lg p-2">{error}</p>}
            <div className="flex gap-2">
              <Button onClick={handleUpload} loading={uploading} disabled={!file}>
                {sendOpening ? '📤 העלה ושלח הודעות' : '📤 העלה'}
              </Button>
              <Button variant="secondary" onClick={onClose}>ביטול</Button>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                <div className="text-3xl font-black text-green-700 mb-1">{result.created}</div>
                <p className="text-green-800 font-medium text-sm">מועמדים נוספו</p>
              </div>
              {result.sent > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                  <div className="text-3xl font-black text-blue-700 mb-1">{result.sent}</div>
                  <p className="text-blue-800 font-medium text-sm">הודעות נשלחו</p>
                </div>
              )}
            </div>
            {result.errors > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-red-700 font-semibold text-sm mb-2">שגיאות ({result.errors}):</p>
                <ul className="text-xs text-red-700 space-y-0.5 max-h-32 overflow-y-auto">
                  {result.error_details.map((e, i) => <li key={i}>• {e}</li>)}
                </ul>
              </div>
            )}
            <div className="flex gap-2">
              <Button onClick={() => { onUploaded() }}>סיים</Button>
              <Button variant="secondary" onClick={() => setResult(null)}>העלה קובץ נוסף</Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
