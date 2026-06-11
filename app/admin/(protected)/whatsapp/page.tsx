import { WhatsAppSetupView } from '@/components/admin/WhatsAppSetupView'

export const metadata = { title: 'WhatsApp Business | רכזים בדרך' }

export default function WhatsAppPage() {
  return (
    <main className="p-6 lg:p-8">
      <WhatsAppSetupView />
    </main>
  )
}
