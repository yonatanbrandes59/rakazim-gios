import { PublicChatbotClient } from '@/components/chatbot/PublicChatbotClient'

export const metadata = {
  title: 'הצטרף/י לצוות הרכזים – האיחוד החקלאי',
  description: 'שאלון גיוס לתפקיד רכז/ת נוער באיחוד החקלאי. מלא/י את השאלון ונחזור אליך בהקדם!',
  openGraph: {
    title: 'רוצה לעסוק בנוער? הצטרף/י לצוות הרכזים 🌱',
    description: 'מלא/י שאלון קצר ונמצא יחד אם תפקיד רכז/ת נוער מתאים לך. 5 דקות בלבד!',
    type: 'website',
  },
}

export default function ApplyPage() {
  return <PublicChatbotClient />
}
