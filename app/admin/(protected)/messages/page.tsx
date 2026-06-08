import { messagesDb, candidatesDb } from '@/lib/db'
import { MessagesView } from '@/components/admin/MessagesView'

export default async function MessagesPage() {
  const [messages, candidates] = await Promise.all([
    messagesDb.findAll(),
    candidatesDb.findAll(),
  ])
  const candidateMap = Object.fromEntries(candidates.map(c => [c.id, c]))
  return <MessagesView initialMessages={messages} candidateMap={candidateMap} />
}
