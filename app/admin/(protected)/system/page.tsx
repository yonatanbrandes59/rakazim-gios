import { SystemStatusView } from '@/components/admin/SystemStatusView'

export const metadata = { title: 'מצב המערכת | רכזים בדרך' }

export default function SystemPage() {
  return (
    <main className="p-6 lg:p-8">
      <SystemStatusView />
    </main>
  )
}
