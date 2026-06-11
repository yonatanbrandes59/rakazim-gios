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
  { value: 'hagshama_dept',     label: 'מנהל/ת מחלקת הגשמה' },
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
  hagshama_dept:     'bg-green-100 text-green-700',
}

// Role group definitions
const ROLE_GROUPS: { title: string; icon: string; roles: CoordinatorRole[]; headerColor: string }[] = [
  {
    title: 'רכזי אזור',
    icon: '🗺️',
    roles: ['coordinator'],
    headerColor: 'bg-brand-50 border-brand-200 text-brand-800',
  },
  {
    title: 'רכזי גרעין',
    icon: '🌱',
    roles: ['garin_coordinator'],
    headerColor: 'bg-teal-50 border-teal-200 text-teal-800',
  },
  {
    title: 'מנהלי מרחב',
    icon: '🏢',
    roles: ['manager'],
    headerColor: 'bg-purple-50 border-purple-200 text-purple-800',
  },
  {
    title: 'ניהול ארצי',
    icon: '🏛️',
    roles: ['secretary'],
    headerColor: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  },
  {
    title: 'ראשי מחלקות',
    icon: '📚',
    roles: ['education_dept', 'factories_dept', 'operations_dept', 'branches_dept', 'hagshama_dept'],
    headerColor: 'bg-blue-50 border-blue-200 text-blue-800',
  },
]

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
    if (!confirm('למחוק את המשתמש?')) return
    await fetch(`/api/coordinators/${id}`, { method: 'DELETE' })
    setCoordinators(prev => prev.filter(c => c.id !== id))
  }

  const totalCount = coordinators.length

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900">ניהול משתמשים</h1>
          <p className="text-gray-500 text-sm mt-0.5">{totalCount} משתמשים · ניהול גישות ואזורי אחריות</p>
        </div>
        <Button onClick={startAdd}>+ הוסף משתמש</Button>
      </div>

      {/* Grouped sections */}
      <div className="space-y-8">
        {ROLE_GROUPS.map(group => {
          const groupCoords = coordinators.filter(c =>
            group.roles.includes(c.role || 'coordinator')
          )
          if (groupCoords.length === 0) return null
          return (
            <section key={group.title}>
              {/* Section header */}
              <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border mb-3 ${group.headerColor}`}>
                <span className="text-lg">{group.icon}</span>
                <h2 className="font-bold text-base">{group.title}</h2>
                <span className="mr-auto text-xs font-semibold bg-white/60 rounded-full px-2 py-0.5">
                  {groupCoords.length}
                </span>
              </div>

              {/* Cards grid */}
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {groupCoords.map(c => (
                  <UserCard
                    key={c.id}
                    coordinator={c}
                    onEdit={startEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </section>
          )
        })}

        {/* Unassigned / unknown role */}
        {(() => {
          const knownRoles = ROLE_GROUPS.flatMap(g => g.roles)
          const ungrouped = coordinators.filter(c => !knownRoles.includes(c.role || 'coordinator') && c.role !== 'coordinator')
          if (!ungrouped.length) return null
          return (
            <section>
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border mb-3 bg-gray-50 border-gray-200 text-gray-700">
                <span className="text-lg">❓</span>
                <h2 className="font-bold text-base">אחר</h2>
                <span className="mr-auto text-xs font-semibold bg-white/60 rounded-full px-2 py-0.5">{ungrouped.length}</span>
              </div>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {ungrouped.map(c => (
                  <UserCard key={c.id} coordinator={c} onEdit={startEdit} onDelete={handleDelete} />
                ))}
              </div>
            </section>
          )
        })()}
      </div>

      {/* Add/Edit modal */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editing ? `עריכת ${editing.name}` : 'הוספת משתמש חדש'}>
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

// ── User card sub-component ─────────────────────────────────────────────────

interface CardProps {
  coordinator: RegionalCoordinator
  onEdit: (c: RegionalCoordinator) => void
  onDelete: (id: string) => void
}

function UserCard({ coordinator: c, onEdit, onDelete }: CardProps) {
  const role = c.role || 'coordinator'
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-bold text-gray-900 truncate">{c.name}</h3>
          <div className="flex gap-1 flex-wrap mt-1">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_BADGE[role]}`}>
              {COORDINATOR_ROLE_LABELS[role]}
            </span>
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
              {COORDINATOR_REGION_LABELS[c.region] ?? c.region}
            </span>
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <button
            onClick={() => onEdit(c)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
            title="עריכה"
          >✏️</button>
          <button
            onClick={() => onDelete(c.id)}
            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
            title="מחיקה"
          >🗑️</button>
        </div>
      </div>
      <div className="mt-3 space-y-1 text-sm text-gray-600">
        <p className="truncate">📧 {c.email}</p>
        <p>📱 {c.phone}</p>
        {c.settlements?.length ? (
          <p className="text-xs text-gray-400 truncate">🏘️ {c.settlements.join(', ')}</p>
        ) : null}
      </div>
    </div>
  )
}
