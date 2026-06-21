import { PublicChatbotClient } from '@/components/chatbot/PublicChatbotClient'

export const metadata = {
  title: 'שאלון גרעין – האיחוד החקלאי',
  description: 'שאלון גיוס לבוגרי גרעינים המשתחררים מהצבא',
}

export default function GarinApplyPage() {
  return <PublicChatbotClient type="garin" />
}
