/**
 * create-users.mjs
 * Creates all system users in Supabase:
 *  - 9 regional coordinators (one per region)
 *  - 3 area managers (north / center / south)
 *  - 1 movement secretary (מזכ"ל)
 *
 * Run once:
 *   node scripts/create-users.mjs
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.
 * Copy .env.local values or set them before running.
 */

import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync } from 'fs'

// Load .env.local
const __dirname = dirname(fileURLToPath(import.meta.url))
try {
  const envPath = join(__dirname, '..', '.env.local')
  const envContent = readFileSync(envPath, 'utf-8')
  dotenv.populate(process.env, dotenv.parse(envContent), { override: false })
} catch {
  // .env.local not found — rely on environment
}

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌  Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// ── Temporary password (admin can change via the Coordinators page) ───────────
const TEMP_PASSWORD = 'Merakzim@2025'

// ── Step 1: migrate — add role column if missing ──────────────────────────────
async function addRoleColumn() {
  const { error } = await supabase.rpc('exec_sql', {
    sql: `ALTER TABLE regional_coordinators ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'coordinator';`
  }).single()
  if (error) {
    // rpc might not exist — try direct query via postgrest
    // If it fails it's likely the column already exists — that's fine
    console.warn('⚠️  Could not run migration via rpc (may already exist):', error.message)
  } else {
    console.log('✅  role column ready')
  }
}

// ── Users to create ───────────────────────────────────────────────────────────
const USERS = [
  // ── רכזי אזור ──────────────────────────────────────────────────────────────
  { role: 'coordinator', region: 'north',          name: 'רכז/ת אזור צפון',           email: 'north@merakzim.local',          phone: '050-0000001' },
  { role: 'coordinator', region: 'afek_hayam',     name: 'רכז/ת אזור עמק חפר ים',     email: 'afek-hayam@merakzim.local',     phone: '050-0000002' },
  { role: 'coordinator', region: 'afek_maayan',    name: 'רכז/ת אזור עמק חפר מעיין',  email: 'afek-maayan@merakzim.local',    phone: '050-0000003' },
  { role: 'coordinator', region: 'center_north',   name: 'רכז/ת אזור מרכז צפוני',     email: 'center-north@merakzim.local',   phone: '050-0000004' },
  { role: 'coordinator', region: 'center',         name: 'רכז/ת אזור מרכז',           email: 'center@merakzim.local',         phone: '050-0000005' },
  { role: 'coordinator', region: 'hevel_modiin',   name: 'רכז/ת אזור חבל מודיעין',    email: 'modiin@merakzim.local',         phone: '050-0000006' },
  { role: 'coordinator', region: 'shfela_tamar',   name: 'רכז/ת אזור שפלה תמר',       email: 'shfela@merakzim.local',         phone: '050-0000007' },
  { role: 'coordinator', region: 'merhavim',       name: 'רכז/ת אזור מרחבים',         email: 'merhavim@merakzim.local',       phone: '050-0000008' },
  { role: 'coordinator', region: 'eshkol',         name: 'רכז/ת אזור אשכול',          email: 'eshkol@merakzim.local',         phone: '050-0000009' },
  // ── מנהלי מרחב ─────────────────────────────────────────────────────────────
  { role: 'manager',     region: 'north_manager',  name: 'מנהל/ת מרחב צפון',          email: 'manager-north@merakzim.local',  phone: '050-0000010' },
  { role: 'manager',     region: 'center_manager', name: 'מנהל/ת מרחב מרכז',          email: 'manager-center@merakzim.local', phone: '050-0000011' },
  { role: 'manager',     region: 'south_manager',  name: 'מנהל/ת מרחב דרום',          email: 'manager-south@merakzim.local',  phone: '050-0000012' },
  // ── מזכ"ל ───────────────────────────────────────────────────────────────────
  { role: 'secretary',   region: 'national',       name: 'מזכ"ל התנועה',              email: 'secretary@merakzim.local',      phone: '050-0000013' },
]

async function main() {
  console.log('\n🚀  Creating system users...\n')

  // Add role column first
  await addRoleColumn()

  const hash = await bcrypt.hash(TEMP_PASSWORD, 12)
  let created = 0, skipped = 0

  for (const user of USERS) {
    // Check if email already exists
    const { data: existing } = await supabase
      .from('regional_coordinators')
      .select('id, email')
      .eq('email', user.email)
      .maybeSingle()

    if (existing) {
      console.log(`⏭️   Already exists: ${user.email}`)
      skipped++
      continue
    }

    const { error } = await supabase.from('regional_coordinators').insert({
      name:          user.name,
      region:        user.region,
      role:          user.role,
      phone:         user.phone,
      email:         user.email,
      password_hash: hash,
      settlements:   [],
      notes:         '',
    })

    if (error) {
      console.error(`❌  Failed to create ${user.email}:`, error.message)
    } else {
      console.log(`✅  Created: ${user.name} (${user.email})`)
      created++
    }
  }

  console.log(`\n✅  Done! Created ${created} users, skipped ${skipped} existing.`)
  console.log(`\n🔑  Temporary password for all users: ${TEMP_PASSWORD}`)
  console.log('    Change via Admin → רכזות אזוריות → ✏️  edit\n')
}

main().catch(console.error)
