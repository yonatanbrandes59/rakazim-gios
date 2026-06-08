import { candidatesDb, positionsDb, coordinatorsDb } from '@/lib/db'
import { MatchesView } from '@/components/admin/MatchesView'

export default async function MatchesPage() {
  const [candidates, positions, coordinators] = await Promise.all([
    candidatesDb.findAll(),
    positionsDb.findAll(),
    coordinatorsDb.findAll(),
  ])
  const hot = candidates.filter(c =>
    (c.interest_level === 'very_hot' || c.interest_level === 'interested') &&
    c.status !== 'accepted' &&
    c.status !== 'not_interested' &&
    c.status !== 'not_relevant'
  )
  return <MatchesView candidates={hot} positions={positions} coordinators={coordinators} />
}
