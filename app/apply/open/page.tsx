import { PublicChatbotClient } from '@/components/chatbot/PublicChatbotClient'

export const metadata = {
  title: 'שאלון מועמדות – האיחוד החקלאי',
  description: 'שאלון גיוס לתפקיד רכז/ת נוער',
}

export default function OpenApplyPage() {
  return <PublicChatbotClient type="open" />
}
