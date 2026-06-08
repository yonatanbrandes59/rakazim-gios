import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/auth'
import { AdminSidebar } from '@/components/admin/AdminSidebar'
import { isDemoMode } from '@/lib/db'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser()
  if (!user) redirect('/admin/login')

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminSidebar />
      <main className="mr-64 min-h-screen">
        {isDemoMode && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 text-xs text-amber-800 flex items-center gap-2">
            <span>🎮</span>
            <span><strong>מצב Demo</strong> – נתונים בזיכרון, מתאפסים עם הפעלה מחדש. לפרסייה אמיתית חבר Supabase.</span>
          </div>
        )}
        {children}
      </main>
    </div>
  )
}
