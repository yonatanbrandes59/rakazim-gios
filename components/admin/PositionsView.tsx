'use client'
import { useState } from 'react'
import { OpenPosition, RegionalCoordinator, REGION_LABELS, COORDINATOR_REGION_LABELS, REGIONS, PositionStatus } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { formatDate } from '@/lib/utils'

interface Props {
  initialPositions: OpenPosition[]
  coordinators: RegionalCoordinator[]
}

const STATUS_LABELS: Record<PositionStatus, string> = {
  open: 'פתוח',
  in_progress: 'בתהליך',
  closed: 'נסגר',
}

const STATUS_COLORS: Record<PositionStatus, string> = {
  open: 'bg-green-100 text-green-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  closed: 'bg-gray-100 text-gray-500',
}

const emptyForm = { settlement_name: '', region: '', coordinator_id: '', job_scope: '100%', desired_start_date: '', requires_car: false, notes: '', status: 'open' as PositionStatus }

export function PositionsView({ initialPositions, coordinators }: Props) {
  const [positions, setPositions] = useState(initialPositions)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<OpenPosition | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<PositionStatus | ''>('')

  function setField(k: string, v: any) { setForm(f => ({ ...f, [k]: v })) }

  function startAdd() { setEditing(null); setForm(emptyForm); setShowForm(true) }

  function startEdit(p: OpenPosition) {
    setEditing(p)
    setForm({
      settlement_name: p.settlement_name, region: p.region, coordinator_id: p.coordinator_id || '',
      job_scope: p.job_scope || '100%', desired_start_date: p.desired_start_date || '',
      requires_car: p.requires_car || false, notes: p.notes || '', status: p.status,
    })
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const body = { ...form, position_type: 'רכז/ת נוער / רכז/ת סניף' as const }
      if (editing) {
        const res = await fetch(`/api/positions/${editing.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
        })
        const updated = await res.json()
        setPositions(prev => prev.map(p => p.id === editing.id ? updated : p))
      } else {
        const res = await fetch('/api/positions', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
        })
        const created = await res.json()
        setPositions(prev => [created, ...prev])
      }
      setShowForm(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('למחוק תקן?')) return
    await fetch(`/api/positions/${id}`, { method: 'DELETE' })
    setPositions(prev => prev.filter(p => p.id !== id))
  }

  const filtered = filter ? positions.filter(p => p.status === filter) : positions

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900">תקנים פתוחים</h1>
          <p className="text-gray-500 text-sm mt-0.5">כל התקנים לתפקיד רכז/ת נוער / רכז/ת סניף</p>
        </div>
        <div className="flex gap-2">
          <Select
            options={Object.entries(STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }))}
            value={filter}
            onChange={e => setFilter(e.target.value as any)}
            placeholder="כל הסטטוסים"
            className="w-36"
          />
          <Button onClick={startAdd}>+ הוסף תקן</Button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <div className="text-4xl mb-2">📍</div>
            <p>אין תקנים להצגה</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500">
              <tr>
                <th className="px-4 py-3 text-right">ישוב</th>
                <th className="px-4 py-3 text-right">אזור</th>
                <th className="px-4 py-3 text-right">רכזת</th>
                <th className="px-4 py-3 text-right">היקף</th>
                <th className="px-4 py-3 text-right">התחלה</th>
                <th className="px-4 py-3 text-right">רכב נדרש</th>
                <th className="px-4 py-3 text-right">סטטוס</th>
                <th className="px-4 py-3 text-right">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const coord = coordinators.find(c => c.id === p.coordinator_id)
                return (
                  <tr key={p.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-gray-900">{p.settlement_name}</td>
                    <td className="px-4 py-3 text-gray-600">{REGION_LABELS[p.region]}</td>
                    <td className="px-4 py-3 text-gray-600">{coord?.name || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{p.job_scope || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(p.desired_start_date)}</td>
                    <td className="px-4 py-3 text-center">{p.requires_car ? '✅' : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[p.status]}`}>
                        {STATUS_LABELS[p.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => startEdit(p)}>✏️</Button>
                        <Button variant="danger" size="sm" onClick={() => handleDelete(p.id)}>🗑️</Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editing ? `עריכה: ${editing.settlement_name}` : 'תקן חדש'}>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-brand-50 rounded-xl p-3 text-sm text-brand-700 font-medium">
            📌 תפקיד: רכז/ת נוער / רכז/ת סניף
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="ישוב *" value={form.settlement_name} onChange={e => setField('settlement_name', e.target.value)} required />
            <Select
              label="אזור *"
              options={REGIONS.map(r => ({ value: r, label: REGION_LABELS[r] }))}
              value={form.region}
              onChange={e => setField('region', e.target.value)}
              placeholder="בחרי"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="היקף משרה" value={form.job_scope} onChange={e => setField('job_scope', e.target.value)} placeholder="100%" />
            <Input label="תאריך התחלה" type="date" value={form.desired_start_date} onChange={e => setField('desired_start_date', e.target.value)} ltr />
          </div>
          <Select
            label="רכזת אזורית"
            options={coordinators.map(c => ({ value: c.id, label: `${c.name} – ${COORDINATOR_REGION_LABELS[c.region] ?? c.region}` }))}
            value={form.coordinator_id}
            onChange={e => setField('coordinator_id', e.target.value)}
            placeholder="לא שובצה"
          />
          <Select
            label="סטטוס"
            options={Object.entries(STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }))}
            value={form.status}
            onChange={e => setField('status', e.target.value)}
          />
          <div className="flex items-center gap-2">
            <input type="checkbox" id="req_car" checked={form.requires_car} onChange={e => setField('requires_car', e.target.checked)} className="rounded" />
            <label htmlFor="req_car" className="text-sm text-gray-700">נדרש רכב</label>
          </div>
          <div className="flex gap-2">
            <Button type="submit" loading={saving}>💾 שמור</Button>
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>ביטול</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
