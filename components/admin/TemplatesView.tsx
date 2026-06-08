'use client'
import { useState } from 'react'
import { MessageTemplate } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { formatDateTime } from '@/lib/utils'

interface Props {
  initialTemplates: MessageTemplate[]
}

export function TemplatesView({ initialTemplates }: Props) {
  const [templates, setTemplates] = useState(initialTemplates)
  const [editing, setEditing] = useState<MessageTemplate | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', body: '', subject: '' })

  function startEdit(t: MessageTemplate) {
    setEditing(t)
    setForm({ name: t.name, body: t.body, subject: t.subject || '' })
  }

  async function handleSave() {
    if (!editing) return
    setSaving(true)
    try {
      const res = await fetch(`/api/messages?template_id=${editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        const updated = await res.json()
        setTemplates(prev => prev.map(t => t.id === editing.id ? updated : t))
        setEditing(null)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900">תבניות הודעה</h1>
        <p className="text-gray-500 text-sm mt-0.5">ערכי תבניות לכל סוגי ההודעות האוטומטיות</p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <strong>משתנים זמינים:</strong> {'{first_name}'}, {'{full_name}'}, {'{questionnaire_link}'}, {'{coordinator_name}'}, {'{settlement_name}'}
      </div>

      <div className="grid gap-4">
        {templates.map(t => (
          <div key={t.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900">{t.name}</h3>
                <div className="flex gap-2 mt-0.5">
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{t.template_key}</span>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{t.channel}</span>
                  {t.active
                    ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">פעיל</span>
                    : <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">לא פעיל</span>
                  }
                </div>
              </div>
              <Button variant="secondary" size="sm" onClick={() => startEdit(t)}>✏️ עריכה</Button>
            </div>
            <div className="px-5 py-4">
              {t.subject && <p className="text-xs text-gray-500 mb-1"><strong>נושא:</strong> {t.subject}</p>}
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">{t.body}</pre>
              <p className="text-xs text-gray-400 mt-2">עודכן: {formatDateTime(t.updated_at)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Edit panel */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold">עריכת תבנית: {editing.name}</h2>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <Input
                label="שם תבנית"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
              {editing.channel === 'email' && (
                <Input
                  label="נושא (subject)"
                  value={form.subject}
                  onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                />
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">תוכן ההודעה</label>
                <textarea
                  value={form.body}
                  onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                  rows={10}
                  className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none font-mono"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSave} loading={saving}>💾 שמור</Button>
                <Button variant="secondary" onClick={() => setEditing(null)}>ביטול</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
