import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/auth'

export default async function Home() {
  const user = await getAuthUser()
  if (user?.role === 'admin') redirect('/admin')
  if (user?.role === 'coordinator') redirect('/region')
  redirect('/admin/login')
}
