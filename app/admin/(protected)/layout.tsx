import { redirect } from 'next/navigation'
import { getAuthUser, hasAdminAccess } from '@/lib/auth'
import { AdminSidebar } from '@/components/admin/AdminSidebar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser()
  if (!user) redirect('/admin/login')
  // Coordinators & garin coordinators have their own area at /region
  if (!hasAdminAccess(user) && user.role !== 'admin') redirect('/region')

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminSidebar />
      <main className="mr-0 lg:mr-64 min-h-screen">
        {children}
      </main>
    </div>
  )
}
