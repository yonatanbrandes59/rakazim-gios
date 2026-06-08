import { positionsDb, coordinatorsDb } from '@/lib/db'
import { PositionsView } from '@/components/admin/PositionsView'

export default async function PositionsPage() {
  const [positions, coordinators] = await Promise.all([
    positionsDb.findAll(),
    coordinatorsDb.findAll(),
  ])
  return <PositionsView initialPositions={positions} coordinators={coordinators} />
}
