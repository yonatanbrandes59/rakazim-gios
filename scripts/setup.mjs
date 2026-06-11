/**
 * npm run setup
 * ─────────────
 * First-time setup helper. Copies .env.example → .env.local
 * and validates that Node.js version is compatible.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const example = path.join(root, '.env.example')
const local = path.join(root, '.env.local')

const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RED = '\x1b[31m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

console.log(`\n${BOLD}🌾 merakzim-v2 — סקריפט הגדרה ראשונית${RESET}\n`)

// Node version check
const [major] = process.versions.node.split('.').map(Number)
if (major < 18) {
  console.error(`${RED}✗ נדרש Node.js 18 ומעלה. הגרסה שלך: ${process.versions.node}${RESET}`)
  console.error(`  הורד מ: https://nodejs.org\n`)
  process.exit(1)
}
console.log(`${GREEN}✓ Node.js ${process.versions.node}${RESET}`)

// Copy .env.example → .env.local
if (fs.existsSync(local)) {
  console.log(`${YELLOW}⚠ .env.local כבר קיים — לא מחליף.${RESET}`)
} else if (!fs.existsSync(example)) {
  console.error(`${RED}✗ לא נמצא .env.example — ודא שהפרויקט הורד במלואו.${RESET}`)
  process.exit(1)
} else {
  fs.copyFileSync(example, local)
  console.log(`${GREEN}✓ נוצר .env.local מתוך .env.example${RESET}`)
}

console.log(`
${BOLD}השלבים הבאים:${RESET}
  1. ערוך את ${BOLD}.env.local${RESET} ומלא את הערכים הנדרשים:
     - JWT_SECRET          (מינימום 32 תווים אקראיים)
     - ADMIN_EMAIL / ADMIN_PASSWORD
     - SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
     - NEXT_PUBLIC_APP_URL (URL הסופי של האפליקציה בפרודקשן)
  2. הרץ: ${BOLD}npm install${RESET}
  3. הרץ: ${BOLD}npm run dev${RESET}

${YELLOW}טיפ:${RESET} בלי Supabase האפליקציה תפעל במצב דמו (נתונים בזיכרון בלבד).
`)
