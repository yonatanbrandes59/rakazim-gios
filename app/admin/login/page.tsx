'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function AdminLogin() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      // Coordinators go to their regional dashboard; everyone else goes to admin
      const regionRoles = ['coordinator', 'garin_coordinator']
      if (regionRoles.includes(data.role)) router.push('/region')
      else router.push('/admin')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-800 via-brand-700 to-blue-600 flex items-center justify-center px-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <Image src="/logo.png" alt="האחוד החקלאי" width={72} height={72} className="rounded-xl" />
          </div>
          <h1 className="text-2xl font-black text-brand-800">רכזים בדרך</h1>
          <p className="text-gray-500 text-sm mt-1">כניסת מנהל / רכז/ת אזורי</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="אימייל"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="your@email.com"
            ltr
            required
          />
          <Input
            label="סיסמה"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            ltr
            required
          />
          {error && <p className="text-red-600 text-sm text-center bg-red-50 rounded-lg p-2">{error}</p>}
          <Button type="submit" loading={loading} className="w-full justify-center" size="lg">
            כניסה
          </Button>
        </form>
      </div>
    </div>
  )
}
