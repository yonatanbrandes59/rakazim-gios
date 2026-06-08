export const meta = {
  name: 'squad',
  description: 'Squad Mode — 5 specialist agents work in parallel on any task',
  whenToUse: 'Use for any substantial feature, refactor, setup, or build task. Pass the task as args.',
  phases: [
    { title: 'Architecture', detail: 'Architect plans and breaks task into specialist subtasks' },
    { title: 'Execution', detail: 'All 4 specialists work in parallel' },
    { title: 'Integration', detail: 'Results merged and final report produced' },
  ],
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: 'One-paragraph plan overview' },
    context: { type: 'string', description: 'Key context all agents must know (tech stack, existing patterns, constraints)' },
    backend: {
      type: 'object',
      properties: {
        needed: { type: 'boolean' },
        task: { type: 'string', description: 'Exact task for the Backend agent. Empty string if not needed.' },
        files: { type: 'array', items: { type: 'string' }, description: 'Files to create or edit' },
      },
      required: ['needed', 'task', 'files'],
    },
    frontend: {
      type: 'object',
      properties: {
        needed: { type: 'boolean' },
        task: { type: 'string' },
        files: { type: 'array', items: { type: 'string' } },
      },
      required: ['needed', 'task', 'files'],
    },
    qa: {
      type: 'object',
      properties: {
        needed: { type: 'boolean' },
        task: { type: 'string' },
        files: { type: 'array', items: { type: 'string' } },
      },
      required: ['needed', 'task', 'files'],
    },
    devops: {
      type: 'object',
      properties: {
        needed: { type: 'boolean' },
        task: { type: 'string' },
        files: { type: 'array', items: { type: 'string' } },
      },
      required: ['needed', 'task', 'files'],
    },
  },
  required: ['summary', 'context', 'backend', 'frontend', 'qa', 'devops'],
}

const RESULT_SCHEMA = {
  type: 'object',
  properties: {
    done: { type: 'boolean' },
    summary: { type: 'string', description: 'What was accomplished' },
    files_changed: { type: 'array', items: { type: 'string' } },
    issues: { type: 'array', items: { type: 'string' }, description: 'Any problems encountered' },
    notes: { type: 'string', description: 'Anything the team lead should know' },
  },
  required: ['done', 'summary', 'files_changed', 'issues'],
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const task = typeof args === 'string' ? args : JSON.stringify(args)

if (!task || task.trim() === '' || task === 'undefined') {
  log('⚠️  No task provided. Pass the task as args when invoking the squad workflow.')
  return { error: 'No task provided' }
}

log(`🎯 Task received: "${task.substring(0, 120)}${task.length > 120 ? '...' : ''}"`)

// ── Phase 1: Architecture ─────────────────────────────────────────────────────
phase('Architecture')

const plan = await agent(
  `You are the Architect on a squad of 5 software engineers. Your job is to:
1. Understand the task fully
2. Explore the codebase to understand current structure, tech stack, and patterns
3. Break the task into subtasks — one per specialist (Backend, Frontend, QA/Security, DevOps)
4. Be precise: each specialist gets ONLY their slice of work
5. Mark a specialist as not needed (needed: false) if the task doesn't require their skill

TASK: ${task}

CRITICAL RULES:
- Use the Read, Glob, Grep tools to explore the codebase BEFORE making the plan
- Be specific about file paths (absolute paths)
- Backend: API routes, server logic, database, services
- Frontend: UI components, pages, styles, client-side logic
- QA/Security: tests, validation, edge cases, security review
- DevOps: environment variables, deployment config, CI/CD, build scripts
- Each task string must be fully self-contained (the agent won't see the others' tasks)
- Include the tech stack and key patterns in "context" so all agents can work correctly`,
  { label: '🏗️ Architect', phase: 'Architecture', schema: PLAN_SCHEMA }
)

if (!plan) {
  log('❌ Architecture phase failed')
  return { error: 'Architecture failed' }
}

log(`📋 Plan ready — ${[plan.backend, plan.frontend, plan.qa, plan.devops].filter(s => s.needed).length} specialists activated`)
log(`📝 ${plan.summary}`)

// ── Phase 2: Parallel Execution ───────────────────────────────────────────────
phase('Execution')

const specialists = [
  plan.backend.needed && {
    role: 'Backend Developer',
    emoji: '⚡',
    task: plan.backend.task,
    files: plan.backend.files,
  },
  plan.frontend.needed && {
    role: 'Frontend Developer',
    emoji: '🎨',
    task: plan.frontend.task,
    files: plan.frontend.files,
  },
  plan.qa.needed && {
    role: 'QA & Security Engineer',
    emoji: '🔒',
    task: plan.qa.task,
    files: plan.qa.files,
  },
  plan.devops.needed && {
    role: 'DevOps Engineer',
    emoji: '🚀',
    task: plan.devops.task,
    files: plan.devops.files,
  },
].filter(Boolean)

const results = await parallel(
  specialists.map(spec => () =>
    agent(
      `You are a ${spec.role} on a software squad.

SHARED CONTEXT (from Architect):
${plan.context}

YOUR TASK:
${spec.task}

FILES YOU MAY NEED TO TOUCH:
${spec.files.length > 0 ? spec.files.join('\n') : 'Determine from context'}

RULES:
- Read existing files before editing them
- Match existing code style exactly
- Do NOT change files outside your domain
- If something is blocked or unclear, note it in "issues" — do not guess
- Be thorough: your output is final, no review round after this`,
      {
        label: `${spec.emoji} ${spec.role}`,
        phase: 'Execution',
        schema: RESULT_SCHEMA,
      }
    )
  )
)

const successful = results.filter(Boolean).filter(r => r.done)
const failed = results.filter(Boolean).filter(r => !r.done)
const issues = results.filter(Boolean).flatMap(r => r.issues || [])

log(`✅ ${successful.length}/${specialists.length} specialists completed`)
if (issues.length > 0) log(`⚠️  Issues: ${issues.join(' | ')}`)

// ── Phase 3: Integration ──────────────────────────────────────────────────────
phase('Integration')

const allFilesChanged = results.filter(Boolean).flatMap(r => r.files_changed || [])
const allNotes = results.filter(Boolean).map(r => r.notes).filter(Boolean)

const integration = await agent(
  `You are the Team Lead reviewing squad work.

ORIGINAL TASK: ${task}

ARCHITECT PLAN: ${plan.summary}

SPECIALIST RESULTS:
${results.filter(Boolean).map((r, i) => `
${specialists[i]?.emoji} ${specialists[i]?.role}:
- Done: ${r.done}
- Summary: ${r.summary}
- Files changed: ${r.files_changed?.join(', ') || 'none'}
- Issues: ${r.issues?.join(', ') || 'none'}
- Notes: ${r.notes || '—'}
`).join('\n')}

YOUR JOB:
1. Read ALL changed files and verify they are correct and consistent
2. Fix any conflicts or integration issues between the specialists' work
3. Verify the task is actually complete end-to-end
4. If anything is missing or broken, fix it now
5. Produce a final status report

Be thorough — you are the last line of defense before this ships.`,
  { label: '👔 Team Lead (Integration)', phase: 'Integration', schema: RESULT_SCHEMA }
)

// ── Final Report ──────────────────────────────────────────────────────────────

return {
  task,
  plan: plan.summary,
  specialists_activated: specialists.map(s => s.role),
  results: results.filter(Boolean).map((r, i) => ({
    role: specialists[i]?.role,
    done: r.done,
    summary: r.summary,
    files: r.files_changed,
  })),
  integration: integration ? {
    done: integration.done,
    summary: integration.summary,
    files: integration.files_changed,
    issues: integration.issues,
  } : null,
  all_files_changed: [...new Set([...allFilesChanged, ...(integration?.files_changed || [])])],
  issues: [...issues, ...(integration?.issues || [])],
}
