import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { candidatesDb, activityDb } from '@/lib/db'
import { sendOpeningToCandidates } from '@/services/messagingService'
import { parse } from 'csv-parse/sync'

// CSV column mapping (Hebrew or English headers)
const COLUMN_MAP: Record<string, string> = {
  'שם פרטי': 'first_name', 'first_name': 'first_name',
  'שם משפחה': 'last_name', 'last_name': 'last_name',
  'טלפון': 'phone', 'phone': 'phone',
  'מייל': 'email', 'email': 'email',
  'גרעין': 'garin', 'garin': 'garin',
  'שנת גרעין': 'garin_year', 'garin_year': 'garin_year',
  'תאריך שחרור': 'release_date', 'release_date': 'release_date',
  'תפקיד בצבא': 'army_role', 'army_role': 'army_role',
  'ניסיון קודם': 'notes', 'notes': 'notes',
  'הערות': 'notes',
}

export async function POST(req: NextRequest) {
  const user = await requireAdmin(req)
  if (user instanceof NextResponse) return user

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'לא נמצא קובץ' }, { status: 400 })

  const text = await file.text()

  let records: Record<string, string>[]
  try {
    records = parse(text, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[]
  } catch (e) {
    return NextResponse.json({ error: 'שגיאה בניתוח ה-CSV' }, { status: 400 })
  }

  const created: string[] = []
  const errors: string[] = []

  for (let i = 0; i < records.length; i++) {
    const row = records[i]
    const mapped: Record<string, string> = {}

    // Map headers
    for (const [header, value] of Object.entries(row)) {
      const key = COLUMN_MAP[header.trim()]
      if (key) mapped[key] = value
    }

    if (!mapped.first_name || !mapped.phone) {
      errors.push(`שורה ${i + 2}: חסרים שדות חובה (שם פרטי, טלפון)`)
      continue
    }

    try {
      const candidate = await candidatesDb.create({
        first_name: mapped.first_name,
        last_name: mapped.last_name,
        phone: mapped.phone,
        email: mapped.email,
        garin: mapped.garin,
        garin_year: mapped.garin_year,
        release_date: mapped.release_date,
        army_role: mapped.army_role,
        notes: mapped.notes,
      })
      created.push(candidate.id)
      await activityDb.log({
        candidate_id: candidate.id,
        user_type: 'admin',
        action: 'candidate_created',
        details: { source: 'csv_upload' },
      })
    } catch (e: any) {
      errors.push(`שורה ${i + 2}: ${e.message}`)
    }
  }

  // Optionally send opening messages to all created candidates
  const sendOpening = req.nextUrl.searchParams.get('send_opening') === 'true'
  let sent = 0
  if (sendOpening && created.length > 0) {
    await sendOpeningToCandidates(created)
    sent = created.length
  }

  return NextResponse.json({
    ok: true,
    created: created.length,
    sent,
    errors: errors.length,
    error_details: errors,
  })
}
