import { coordinatorsDb } from '@/lib/db'
import { CoordinatorsView } from '@/components/admin/CoordinatorsView'

export default async function CoordinatorsPage() {
  const coordinators = await coordinatorsDb.findAll()
  return <CoordinatorsView initialCoordinators={coordinators} />
}
