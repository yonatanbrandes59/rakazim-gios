import { candidatesDb, coordinatorsDb } from '@/lib/db'
import { CandidatesDashboard } from '@/components/admin/CandidatesDashboard'
import { getAuthUser } from '@/lib/auth'

export default async function AdminPage() {
  const user = await getAuthUser()
  const [candidates, coordinators] = await Promise.all([
    candidatesDb.findAll(),
    coordinatorsDb.findAll(),
  ])

  // Stats
  const stats = {
    total: candidates.length,
    hot: candidates.filter(c => c.interest_level === 'very_hot' || c.interest_level === 'interested').length,
    completed: candidates.filter(c => c.status === 'questionnaire_completed').length,
    pending_contact: candidates.filter(c => {
      if (!c.recommended_contact_date) return false
      return new Date(c.recommended_contact_date) <= new Date()
    }).length,
    new_this_week: candidates.filter(c => {
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()
      return c.created_at >= weekAgo
    }).length,
  }

  return (
    <CandidatesDashboard
      initialCandidates={candidates}
      coordinators={coordinators}
      stats={stats}
    />
  )
}
