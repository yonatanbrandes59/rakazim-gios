'use client'
import { useState } from 'react'
import {
  RegionalCoordinator, COORDINATOR_REGION_LABELS, REGIONS,
  CoordinatorRole, COORDINATOR_ROLE_LABELS, CoordinatorRegion,
} from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'

interface Props {
  initialCoordinators: RegionalCoordinator[]
}

const ALL_COORD_REGIONS: { value: CoordinatorRegion; label: string }[] = [
  ...REGIONS.map(r => ({ value: r as CoordinatorRegion, label: COORDINATOR_REGION_LABELS[r] })),
  { value: 'north_manager',  label: 'מרחב צפון' },
  { value: 'center_manager', label: 'מרחב מרכז' },
  { value: 'south_manager',  label: 'מרחב דרום' },
  { value: 'national',       label: 'ארצי (מזכ"ל)' },
]

const ROLE_OPTIONS: { value: CoordinatorRole; label: string }[] = [
  { value: 'coordinator',       label: 'רכז/ת אזורי/ת' },
  { value: 'garin_coordinator', label: 'רכז/ת גרעין' },
  { value: 'manager',           label: 'מנהל/ת מרחב' },
  { value: 'secretary',         label: 'מזכ"ל' },
  { value: 'education_dept',    label: 'מנהל/ת מחלקת חינוך' },
  { value: 'factories_dept',    label: 'מנהל/ת מחלקת מפעלים' },
  { value: 'operations_dept',   label: 'מנהל/ת מחלקת תפעול' },
  { value: 'branches_dept',     label: 'מנהל/ת מחלקת סניפים' },
]

const ROLE_BADGE: Record<CoordinatorRole, string> = {
  coordinator:       'bg-brand-100 text-brand-700',
  garin_coordinator: 'bg-teal-100 text-teal-700',
  manager:           'bg-purple-100 text-purple-700',
  secretary:         'bg-yellow-100 text-yellow-700',
  education_dept:    'bg-blue-100 text-blue-700',
  factories_dept:    'bg-orange-100 text-orange-700',
  operations_dept:   'bg-gray-100 text-gray-700',
  branches_dept:     'bg-pink-100 text-pink-700',
}

const emptyForm = { name: '', email: '', phone: '', region: '', role: 'coordinator' as CoordinatorRole, password: '', settlements: '' }

export function CoordinatorsView({ initialCoordinators }: Props) {
  const [coordinators, setCoordinators] = useState(initialCoordinators)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<RegionalCoordinator | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function setField(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  function startEdit(c: RegionalCoordinator) {
    setEditing(c)
    setForm({
      name: c.name, email: c.email, phone: c.phone,
      region: c.region, role: c.role || 'coordinator',
      password: '', settlements: (c.settlements || []).join(', ')
    })
    setShowForm(true)
  }

  function startAdd() {
    setEditing(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const body = {
        ...form,
        role: form.role || 'coordinator',
        settlements: form.settlements.split(',').map(s => s.trim()).filter(Boolean),
      }
      if (editing) {
        const res = await fetch(`/api/coordinators/${editing.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
        })
        if (!res.ok) throw new Error((await res.json()).error)
        const updated = await res.json()
        setCoordinators(prev => prev.map(c => c.id === editing.id ? updated : c))
      } else {
        const res = await fetch('/api/coordinators', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
        })
        if (!res.ok) throw new Error((await res.json()).error)
        const created = await res.json()
        setCoordinators(prev => [created, ...prev])
      }
      setShowForm(false)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('למחוק את הרכזת?')) return
    await fetch(`/api/coordinators/${id}`, { method: 'DELETE' })
    setCoordinators(prev => prev.filter(c => c.id !== id))
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900">רכזות אזוריות</h1>
          <p className="text-gray-500 text-sm mt-0.5">ניהול גישות ואזורי אחריות</p>
        </div>
        <Button onClick={startAdd}>+ הוסף רכזת</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {coordinators.map(c => (
          <div key={c.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-gray-900">{c.name}</h3>
                <div className="flex gap-1 flex-wrap mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${ROLE_BADGE[c.role || 'coordinator']}`}>
                    {COORDINATOR_ROLE_LABELS[c.role || 'coordinator']}
                  </span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                    {COORDINATOR_REGION_LABELS[c.region] ?? c.region}
                  </span>
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => startEdit(c)}>✏️</Button>
                <Button variant="danger" size="sm" onClick={() => handleDelete(c.id)}>🗑️</Button>
              </div>
            </div>
            <div className="mt-3 space-y-1 text-sm text-gray-600">
              <p>📧 {c.email}</p>
              <p>📱 {c.phone}</p>
              {c.settlements?.length ? (
                <p className="text-xs">🏘️ {c.settlements.join(', ')}</p>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editing ? `עריכת ${editing.name}` : 'הוספת רכזת חדשה'}>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="שם מלא *" value={form.name} onChange={e => setField('name', e.target.value)} required />
            <Input label="טלפון *" type="tel" value={form.phone} onChange={e => setField('phone', e.target.value)} ltr required />
          </div>
          <Input label="אימייל *" type="email" value={form.email} onChange={e => setField('email', e.target.value)} ltr required />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="תפקיד *"
              options={ROLE_OPTIONS}
              value={form.role}
              onChange={e => setField('role', e.target.value)}
            />
            <Select
              label="אזור *"
              options={ALL_COORD_REGIONS}
              value={form.region}
              onChange={e => setField('region', e.target.value)}
              placeholder="בחרי אזור"
            />
          </div>
          <Input
            label="סיסמה (ריק = ללא שינוי)"
            type="password"
            value={form.password}
            onChange={e => setField('password', e.target.value)}
            ltr
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ישובים (מופרדים בפסיק)</label>
            <textarea
              value={form.settlements}
              onChange={e => setField('settlements', e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
              placeholder="תל אביב, רמת גן, גבעתיים..."
            />
          </div>
          {error && <p className="text-red-600 text-sm bg-red-50 rounded-lg p-2">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" loading={saving}>💾 שמור</Button>
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>ביטול</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
