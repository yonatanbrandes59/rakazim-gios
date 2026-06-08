import { notFound } from 'next/navigation'
import { candidatesDb } from '@/lib/db'
import { ChatbotClient } from '@/components/chatbot/ChatbotClient'

export const metadata = { title: 'שאלון – רכזים בדרך' }

interface Props { params: { token: string } }

export default async function QuestionnairePage({ params }: Props) {
  const candidate = await candidatesDb.findByToken(params.token)
  if (!candidate) notFound()
  if (candidate.opt_out) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-700 to-blue-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center">
          <div className="text-5xl mb-4">🙏</div>
          <h1 className="text-xl font-black text-gray-900 mb-2">בוטלת ההרשמה</h1>
          <p className="text-gray-500 text-sm">הסרת את עצמך מהרשימה. לחזרה – פנה/י אלינו ישירות.</p>
        </div>
      </div>
    )
  }

  // Mark questionnaire as opened if first time
  if (candidate.status === 'questionnaire_sent' || candidate.status === 'new') {
    await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/questionnaire/${params.token}`)
      .catch(() => null)
  }

  return <ChatbotClient candidate={candidate} token={params.token} />
}
