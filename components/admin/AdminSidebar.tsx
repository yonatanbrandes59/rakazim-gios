'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/admin',              icon: '👥', label: 'מועמדים' },
  { href: '/admin/messages',     icon: '💬', label: 'הודעות' },
  { href: '/admin/matches',      icon: '🎯', label: 'התאמות' },
  { href: '/admin/positions',    icon: '📍', label: 'תקנים פתוחים' },
  { href: '/admin/coordinators', icon: '🗺️', label: 'רכזות אזוריות' },
  { href: '/admin/templates',    icon: '📝', label: 'תבניות הודעה' },
]

export function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/auth', { method: 'DELETE' })
    router.push('/admin/login')
  }

  return (
    <aside className="w-64 bg-brand-900 text-white flex flex-col min-h-screen fixed top-0 right-0 z-40">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-brand-800">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🌟</span>
          <div>
            <div className="font-black text-base leading-none">רכזים בדרך</div>
            <div className="text-xs text-brand-300 mt-0.5">דשבורד מנהל</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(item => {
          const active = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors',
                active
                  ? 'bg-brand-700 text-white'
                  : 'text-brand-200 hover:bg-brand-800 hover:text-white'
              )}
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-brand-800">
        <Link href="/" className="flex items-center gap-3 px-4 py-2 rounded-xl text-brand-300 hover:text-white text-sm transition-colors">
          <span>🌐</span> לאתר הבית
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-2 rounded-xl text-brand-300 hover:text-red-300 text-sm transition-colors"
        >
          <span>🚪</span> יציאה
        </button>
      </div>
    </aside>
  )
}
