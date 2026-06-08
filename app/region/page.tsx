import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/auth'
import { candidatesDb, coordinatorsDb, positionsDb } from '@/lib/db'
import { RegionDashboardClient } from '@/components/region/RegionDashboardClient'

export default async function RegionPage() {
  const user = await getAuthUser()
  if (!user) redirect('/region/login')
  if (user.role === 'admin') redirect('/admin')

  const [allCandidates, coordinator, positions] = await Promise.all([
    candidatesDb.findAll(),
    coordinatorsDb.findById(user.id),
    positionsDb.findAll(),
  ])

  // Filter candidates to this coordinator's region
  const myCandidates = allCandidates.filter(c =>
    c.preferred_region === (user as any).region ||
    c.assigned_region_id === (user as any).region ||
    c.assigned_coordinator_id === (user as any).id
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
