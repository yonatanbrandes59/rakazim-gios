import { redirect } from 'next/navigation'
import { getAuthUser, hasAdminAccess } from '@/lib/auth'
import { candidatesDb, coordinatorsDb, positionsDb } from '@/lib/db'
import { RegionDashboardClient } from '@/components/region/RegionDashboardClient'

export default async function RegionPage() {
  const user = await getAuthUser()
  if (!user) redirect('/region/login')
  // Managers, secretaries, dept heads belong in /admin — send them there
  if (user.role === 'admin' || hasAdminAccess(user)) redirect('/admin')

  const [scopedCandidates, coordinator, positions] = await Promise.all([
    // Scope at DB level — only fetch this coordinator's candidates, never all candidates
    candidatesDb.findAll({ coordinator_id: user.id }),
    coordinatorsDb.findById(user.id),
    positionsDb.findAll(),
  ])

  // Secondary server-side guard: confirm each returned candidate actually belongs
  // to this coordinator (defends against a DB layer that ignores the filter)
  const coordinatorRegion = (user as any).region as string | undefined
  const myCandidates = scopedCandidates.filter(c =>
    c.assigned_coordinator_id === user.id ||
    (coordinatorRegion && (
      c.preferred_region === coordinatorRegion ||
      c.assigned_region_id === coordinatorRegion
    ))
  )

  const myPositions = positions.filter(p => p.region === (user as any).region)

  return (
    <RegionDashboardClient
      user={user as any}
      candidates={myCandidates}
      positions={myPositions}
    />
  )
}
