/**
 * LLM Brain — AI-powered intelligence layer (Claude / Gemini)
 * ───────────────────────────────────────────────────────────
 * Adds genuine language understanding on top of the rule-based
 * recruitmentBrain. Supports two providers with automatic selection:
 *
 *   1. ANTHROPIC_API_KEY set → Claude (claude-opus-4-8)
 *   2. else GEMINI_API_KEY set → Google Gemini (free tier available)
 *   3. else → disabled; callers fall back to the rule-based brain
 *
 * ⚠️  COST GATE: with no key configured, isLlmEnabled() is false and
 *     NOTHING is ever called or billed. This respects the project's
 *     "no auto-charges without explicit approval" constraint.
 */

import Anthropic from '@anthropic-ai/sdk'
import {
  Candidate, QuestionnaireAnswer, RegionalCoordinator,
  REGION_LABELS, INTEREST_LEVEL_LABELS, CANDIDATE_STATUS_LABELS,
} from '@/lib/types'

// ── Provider selection ──────────────────────────────────────────────────────

export type LlmProvider = 'anthropic' | 'gemini'

export function activeLlmProvider(): LlmProvider | null {
  if (process.env.ANTHROPIC_API_KEY?.trim()) return 'anthropic'
  if (process.env.GEMINI_API_KEY?.trim()) return 'gemini'
  return null
}

export function isLlmEnabled(): boolean {
  return activeLlmProvider() !== null
}

const CLAUDE_MODEL = 'claude-opus-4-8'
const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash'

let _anthropic: Anthropic | null = null
function getAnthropic(): Anthropic {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return _anthropic
}

// ── Core generation (provider-agnostic) ─────────────────────────────────────

interface GenerateOpts {
  /** When set, the model must return JSON matching this schema. */
  jsonSchema?: Record<string, unknown>
}

/** Extract the first text block from a Claude response. */
function firstText(msg: Anthropic.Message): string {
  for (const block of msg.content) {
    if (block.type === 'text') return block.text.trim()
  }
  return ''
}

async function generateClaude(system: string, user: string, opts?: GenerateOpts): Promise<string | null> {
  const params: Anthropic.MessageCreateParamsNonStreaming = {
    model: CLAUDE_MODEL,
    // Generous ceiling: with adaptive thinking, thinking tokens count toward
    // max_tokens — a small cap can starve the final answer into an empty reply.
    max_tokens: 4000,
    thinking: { type: 'adaptive' },
    system,
    messages: [{ role: 'user', content: user }],
  }
  if (opts?.jsonSchema) {
    params.output_config = {
      format: { type: 'json_schema', schema: opts.jsonSchema },
    }
  }
  const msg = await getAnthropic().messages.create(params)
  return firstText(msg) || null
}

// Free-tier capacity fluctuates — when the primary model returns 503/429 we
// fall through this chain instead of failing the request.
const GEMINI_FALLBACK_MODELS = ['gemini-2.5-flash-lite', 'gemini-2.0-flash']

async function callGeminiModel(
  model: string,
  key: string,
  body: Record<string, unknown>,
): Promise<{ ok: true; text: string } | { ok: false; status: number; message: string }> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    },
  )
  const data = await res.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    error?: { message?: string }
  }
  if (!res.ok) {
    return { ok: false, status: res.status, message: data.error?.message ?? 'unknown error' }
  }
  const text = data.candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('').trim() ?? ''
  return { ok: true, text }
}

async function generateGemini(system: string, user: string, opts?: GenerateOpts): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY!.trim()
  const body: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: {
      maxOutputTokens: 4000,
      ...(opts?.jsonSchema ? { responseMimeType: 'application/json' } : {}),
    },
  }

  const models = [GEMINI_MODEL, ...GEMINI_FALLBACK_MODELS.filter(m => m !== GEMINI_MODEL)]
  let lastError = ''
  for (const model of models) {
    const result = await callGeminiModel(model, key, body)
    if (result.ok) return result.text || null
    lastError = `Gemini API ${result.status} (${model}): ${result.message}`
    // Only capacity/rate issues justify trying the next model; real errors
    // (bad key, bad request) would fail on every model identically.
    if (result.status !== 503 && result.status !== 429) break
    console.warn(`[llmBrain] ${model} unavailable (${result.status}), trying next model…`)
  }
  throw new Error(lastError)
}

/**
 * Generate text with whichever provider is configured.
 * Returns null when disabled or on any provider error (callers fall back).
 */
async function generate(system: string, user: string, opts?: GenerateOpts): Promise<string | null> {
  const provider = activeLlmProvider()
  if (!provider) return null
  try {
    return provider === 'anthropic'
      ? await generateClaude(system, user, opts)
      : await generateGemini(system, user, opts)
  } catch (err) {
    console.error(`[llmBrain] ${provider} generate error:`, err)
    return null
  }
}

// ── Candidate profile rendering ─────────────────────────────────────────────

/** Render a compact, Hebrew-labeled profile of the candidate for the prompt. */
function renderCandidateProfile(c: Candidate, answers?: QuestionnaireAnswer[]): string {
  const lines: string[] = []
  lines.push(`שם: ${c.full_name}`)
  if (c.garin) lines.push(`גרעין: ${c.garin}${c.garin_year ? ` (${c.garin_year})` : ''}`)
  if (c.army_role) lines.push(`תפקיד צבאי: ${c.army_role}`)
  if (c.release_date) lines.push(`תאריך שחרור: ${c.release_date}`)
  if (c.preferred_region) lines.push(`אזור מועדף: ${REGION_LABELS[c.preferred_region] ?? c.preferred_region}`)
  if (c.looking_for_work) lines.push(`זמינות: ${c.looking_for_work}`)
  if (c.interest_in_role) lines.push(`עניין בתפקיד: ${c.interest_in_role}`)
  if (c.interest_level) lines.push(`רמת עניין: ${INTEREST_LEVEL_LABELS[c.interest_level] ?? c.interest_level}`)
  if (typeof c.fit_score === 'number') lines.push(`ציון התאמה: ${c.fit_score}/100`)
  if (c.has_driving_license !== undefined) lines.push(`רישיון נהיגה: ${c.has_driving_license ? 'כן' : 'לא'}`)
  if (c.has_car !== undefined) lines.push(`רכב: ${c.has_car ? 'כן' : 'לא'}`)
  if (c.guidance_experience !== undefined) lines.push(`ניסיון הדרכה: ${c.guidance_experience ? 'כן' : 'לא'}`)
  if (c.leadership_experience !== undefined) lines.push(`ניסיון הנהגה: ${c.leadership_experience ? 'כן' : 'לא'}`)
  if (c.can_commit_full_year !== undefined) lines.push(`מתחייב/ת לשנה: ${c.can_commit_full_year ? 'כן' : 'לא'}`)
  lines.push(`סטטוס: ${CANDIDATE_STATUS_LABELS[c.status] ?? c.status}`)
  if (c.open_answer) lines.push(`הערה חופשית מהמועמד: "${c.open_answer}"`)

  if (answers && answers.length > 0) {
    lines.push('', 'תשובות לשאלון:')
    for (const a of answers) lines.push(`• ${a.question_text} → ${a.answer}`)
  }
  return lines.join('\n')
}

// ── 1. Candidate summary (one-line insight) ────────────────────────────────

/**
 * Produce a single, sharp Hebrew sentence summarizing the candidate for the
 * dashboard. Returns null if the LLM is disabled or errors.
 */
export async function summarizeCandidate(
  candidate: Candidate,
  answers?: QuestionnaireAnswer[],
): Promise<string | null> {
  return generate(
    'אתה עוזר גיוס של "האיחוד החקלאי" שמגייס רכזי נוער / רכזי סניף. ' +
    'תפקידך לסכם מועמד במשפט אחד חד וברור בעברית, שעוזר לרכז האזורי להחליט אם ואיך לפנות. ' +
    'התמקד באות החזק ביותר (התאמה, זמינות, מוטיבציה, או דגל אדום). ' +
    'החזר משפט אחד בלבד, ללא הקדמות, ללא מירכאות.',
    `סכם את המועמד הבא במשפט אחד:\n\n${renderCandidateProfile(candidate, answers)}`,
  )
}

// ── 2. Personalized coordinator message ─────────────────────────────────────

/**
 * Draft a warm, personalized WhatsApp alert TO the coordinator about a new
 * candidate — why this candidate matters and the best approach for contact.
 * Returns null if disabled/errors (caller falls back to template).
 */
export async function draftCoordinatorAlert(
  candidate: Candidate,
  coordinator: RegionalCoordinator,
  answers?: QuestionnaireAnswer[],
): Promise<string | null> {
  return generate(
    'אתה עוזר גיוס של "האיחוד החקלאי". אתה כותב הודעת WhatsApp קצרה לרכז/ת אזור ' +
    'כדי לעדכן אותו/ה על מועמד/ת חדש/ה שמתאים/ה לתפקיד רכז/ת נוער / רכז/ת סניף. ' +
    'ההודעה צריכה: לפנות לרכז/ת בשמו/ה, להסביר ב-2-3 משפטים למה המועמד/ת מעניין/ת ומתי כדאי לפנות, ' +
    'ולהיות חמה ומקצועית. אל תמציא פרטים שלא נתונים. החזר רק את גוף ההודעה.',
    `רכז/ת האזור: ${coordinator.name}\n\n` +
    `פרטי המועמד/ת:\n${renderCandidateProfile(candidate, answers)}\n\n` +
    `כתוב/כתבי הודעת עדכון אישית לרכז/ת.`,
  )
}

// ── 3. Free-text conversation understanding (WhatsApp) ───────────────────────

export interface FreeTextReply {
  reply: string                 // Hebrew message to send back to the candidate
  intent: 'question' | 'interested' | 'not_interested' | 'reschedule' | 'smalltalk' | 'other'
  shouldAlertCoordinator: boolean
}

/**
 * Understand a free-text WhatsApp message from a candidate (one who has already
 * completed the questionnaire) and craft a warm, helpful reply.
 * Returns null if disabled/errors (caller falls back to canned response).
 */
export async function understandFreeText(
  candidate: Candidate,
  incomingMessage: string,
  recentHistory?: Array<{ direction: 'in' | 'out'; body: string }>,
): Promise<FreeTextReply | null> {
  const historyText = (recentHistory ?? [])
    .slice(-6)
    .map(m => `${m.direction === 'in' ? 'מועמד' : 'בוט'}: ${m.body}`)
    .join('\n')

  const raw = await generate(
    'אתה הבוט של "האיחוד החקלאי" שמגייס רכזי נוער / רכזי סניף, ומשוחח עם מועמדים בוואטסאפ. ' +
    'המועמד כבר מילא שאלון. ענה בחום, בקצרה, ובעברית טבעית. ' +
    'אם המועמד שואל שאלה על התפקיד — ענה לפי הידוע (תפקיד רכז/ת נוער בקהילה, התחייבות לשנה, שכר לפי היקף). ' +
    'אם אינך יודע פרט — אל תמציא; אמור שרכז/ת האזור יחזור אליו עם המידע. ' +
    'אם המועמד מביע עניין חזק, רוצה לתאם שיחה, או שואל שאלה מהותית — סמן shouldAlertCoordinator=true. ' +
    'החזר JSON תקין בלבד עם השדות: reply (string), intent (אחד מ: question/interested/not_interested/reschedule/smalltalk/other), shouldAlertCoordinator (boolean).',
    `פרטי המועמד:\n${renderCandidateProfile(candidate)}\n\n` +
    (historyText ? `היסטוריית שיחה אחרונה:\n${historyText}\n\n` : '') +
    `ההודעה החדשה מהמועמד:\n"${incomingMessage}"\n\n` +
    `החזר JSON עם reply, intent, shouldAlertCoordinator.`,
    {
      jsonSchema: {
        type: 'object',
        properties: {
          reply: { type: 'string' },
          intent: {
            type: 'string',
            enum: ['question', 'interested', 'not_interested', 'reschedule', 'smalltalk', 'other'],
          },
          shouldAlertCoordinator: { type: 'boolean' },
        },
        required: ['reply', 'intent', 'shouldAlertCoordinator'],
        additionalProperties: false,
      },
    },
  )

  if (!raw) return null
  try {
    // Gemini with responseMimeType json returns bare JSON; some models may wrap
    // in a markdown fence — strip it defensively before parsing.
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    return JSON.parse(cleaned) as FreeTextReply
  } catch (err) {
    console.error('[llmBrain] understandFreeText JSON parse error:', err, 'raw:', raw.slice(0, 200))
    return null
  }
}
