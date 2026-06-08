import { templatesDb } from '@/lib/db'
import { TemplatesView } from '@/components/admin/TemplatesView'

export default async function TemplatesPage() {
  const templates = await templatesDb.findAll()
  return <TemplatesView initialTemplates={templates} />
}
