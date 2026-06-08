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
  const [result, setResult] = useState<{ created: number; errors: string[] } | null>(null)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleUpload() {
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/candidates/upload-csv', { method: 'POST', body: formData })
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
    <Modal isOpen onClose={onClose} title="ייבוא מועמדים מ-CSV">
      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
          <strong className="block mb-2">📋 פורמט CSV נדרש:</strong>
          <p className="font-mono text-xs">שם פרטי, שם משפחה, טלפון, אימייל, גרעין, שנת גרעין, תפקיד צבאי, תאריך שחרור</p>
          <a
            href="/api/candidates/upload-csv"
            className="text-blue-600 hover:underline text-xs mt-2 block"
          >
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
                <p className="text-gray-500">לחצי לבחירת קובץ CSV</p>
              )}
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={e => setFile(e.target.files?.[0] || null)}
              />
            </div>
            {error && <p className="text-red-600 text-sm bg-red-50 rounded-lg p-2">{error}</p>}
            <div className="flex gap-2">
              <Button onClick={handleUpload} loading={uploading} disabled={!file}>
                📤 העלה
              </Button>
              <Button variant="secondary" onClick={onClose}>ביטול</Button>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
              <div className="text-3xl font-black text-green-700 mb-1">{result.created}</div>
              <p className="text-green-800 font-medium">מועמדים נוספו בהצלחה</p>
            </div>
            {result.errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-red-700 font-semibold text-sm mb-2">שגיאות ({result.errors.length}):</p>
                <ul className="text-xs text-red-700 space-y-0.5 max-h-32 overflow-y-auto">
                  {result.errors.map((e, i) => <li key={i}>• {e}</li>)}
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
