import { InsightsView } from '@/components/admin/InsightsView'

export const metadata = { title: 'תובנות | רכזים בדרך' }

export default function InsightsPage() {
  return (
    <main className="p-6 lg:p-8">
      <InsightsView />
    </main>
  )
}
