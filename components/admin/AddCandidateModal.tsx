'use client'
import { useState } from 'react'
import { RegionalCoordinator, Candidate, REGION_LABELS } from '@/lib/types'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'

interface Props {
  coordinators: RegionalCoordinator[]
  onClose: () => void
  onCreated: (c: Candidate) => void
}

export function AddCandidateModal({ coordinators, onClose, onCreated }: Props) {
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    garin: '',
    garin_year: '',
    army_role: '',
    release_date: '',
    preferred_region: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set(key: string, val: string) {
    setForm(f => ({ ...f, [key]: val }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.first_name || !form.last_name || !form.phone) {
      setError('שדות חובה: שם פרטי, שם משפחה, טלפון')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'שגיאה')
      onCreated(data)
    } catch (err: any) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <Modal isOpen onClose={onClose} title="הוספת מועמד חדש">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="שם פרטי *" value={form.first_name} onChange={e => set('first_name', e.target.value)} required />
          <Input label="שם משפחה *" value={form.last_name} onChange={e => set('last_name', e.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="טלפון *" type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} ltr required />
          <Input label="אימייל" type="email" value={form.email} onChange={e => set('email', e.target.value)} ltr />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="גרעין" value={form.garin} onChange={e => set('garin', e.target.value)} placeholder="שם הגרעין" />
          <Input label="שנת גרעין" value={form.garin_year} onChange={e => set('garin_year', e.target.value)} placeholder="2022" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="תפקיד בצבא" value={form.army_role} onChange={e => set('army_role', e.target.value)} />
          <Input label="תאריך שחרור" type="date" value={form.release_date} onChange={e => set('release_date', e.target.value)} ltr />
        </div>
        <Select
          label="אזור מועדף"
          options={Object.entries(REGION_LABELS).map(([v, l]) => ({ value: v, label: l }))}
          value={form.preferred_region}
          onChange={e => set('preferred_region', e.target.value)}
          placeholder="בחרי אזור"
        />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">הערות</label>
          <textarea
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            rows={3}
            className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
            placeholder="הערות ראשוניות..."
          />
        </div>
        {error && <p className="text-red-600 text-sm bg-red-50 rounded-lg p-2">{error}</p>}
        <div className="flex gap-2 pt-2">
          <Button type="submit" loading={saving}>➕ הוסף מועמד</Button>
          <Button type="button" variant="secondary" onClick={onClose}>ביטול</Button>
        </div>
      </form>
    </Modal>
  )
}
