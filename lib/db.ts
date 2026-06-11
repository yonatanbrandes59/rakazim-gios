/**
 * Database abstraction layer
 * ──────────────────────────
 * Switches between Supabase (production) and in-memory store (demo).
 * Add USE_SUPABASE=true to env to use Supabase.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'
import {
  Candidate, RegionalCoordinator, OpenPosition,
  MessageTemplate, MessageQueueItem, ActivityLogItem,
  CandidateFilters, CreateCandidateDto, UpdateCandidateDto,
  QuestionnaireAnswer,
  ConversationMessage, AutomationRule, AutomationLog,
  CoordinatorRole, WaChatbotSession,
} from './types'
import {
  getStore, storeGet, storeFind, storeCreate,
  storeUpdate, storeDelete, initStoreFromBlob, persistStoreToBlob
} from './store'
import { generateToken } from './utils'
import { DEFAULT_AUTOMATION_RULES } from './automationRules'

const USE_SUPABASE = !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY)

// ── Blob initialization (runs once per cold-start, skipped if Supabase used) ─
let _blobReady: Promise<void> | null = null
function ensureBlob(): Promise<void> {
  if (USE_SUPABASE) return Promise.resolve()
  if (!_blobReady) _blobReady = initStoreFromBlob()
  return _blobReady
}

let supabase: SupabaseClient | null = null
if (USE_SUPABASE) {
  supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!
  )
}

export const isDemoMode = !USE_SUPABASE

// ── Candidates ─────────────────────────────────────────────────────────────

export const candidatesDb = {
  async findAll(filters?: CandidateFilters): Promise<Candidate[]> {
    await ensureBlob()
    if (USE_SUPABASE && supabase) {
      let q = supabase.from('candidates').select('*').order('created_at', { ascending: false })
      if (filters?.region) q = q.eq('preferred_region', filters.region)
      if (filters?.status) q = q.eq('status', filters.status)
      if (filters?.coordinator_id) q = q.eq('assigned_coordinator_id', filters.coordinator_id)
      if (filters?.interest_level) q = q.eq('interest_level', filters.interest_level)
      if (filters?.search) q = q.ilike('full_name', `%${filters.search}%`)
      const { data, error } = await q
      if (error) { console.error('[db] candidates.findAll:', error); return [] }
      return data ?? []
    }
    let list = [...getStore().candidates]
    if (filters?.region) list = list.filter(c => c.preferred_region === filters.region)
    if (filters?.status) list = list.filter(c => c.status === filters.status)
    if (filters?.coordinator_id) list = list.filter(c => c.assigned_coordinator_id === filters.coordinator_id)
    if (filters?.interest_level) list = list.filter(c => c.interest_level === filters.interest_level)
    if (filters?.search) {
      const q = filters.search.toLowerCase()
      list = list.filter(c =>
        c.full_name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.garin || '').toLowerCase().includes(q)
      )
    }
    return list.sort((a, b) => b.created_at.localeCompare(a.created_at))
  },

  async findById(id: string): Promise<Candidate | null> {
    await ensureBlob()
    if (USE_SUPABASE && supabase) {
      const { data, error } = await supabase.from('candidates').select('*').eq('id', id).single()
      if (error && error.code !== 'PGRST116') console.error('[db] candidates.findById:', error)
      return data ?? null
    }
    return storeFind<Candidate>('candidates', id)
  },

  async findByToken(token: string): Promise<Candidate | null> {
    await ensureBlob()
    if (USE_SUPABASE && supabase) {
      const { data, error } = await supabase.from('candidates').select('*').eq('candidate_token', token).single()
      if (error && error.code !== 'PGRST116') console.error('[db] candidates.findByToken:', error)
      return data ?? null
    }
    return getStore().candidates.find(c => c.candidate_token === token) ?? null
  },

  async create(dto: CreateCandidateDto): Promise<Candidate> {
    await ensureBlob()
    const now = new Date().toISOString()
    const newCand: Omit<Candidate, 'id' | 'created_at' | 'updated_at'> = {
      ...dto,
      full_name: `${dto.first_name} ${dto.last_name}`,
      candidate_token: generateToken('q'),
      status: 'new',
      opt_out: false,
      consent_given: false,
    }
    if (USE_SUPABASE && supabase) {
      const { data, error } = await supabase.from('candidates').insert([{ ...newCand, id: uuidv4(), created_at: now, updated_at: now }]).select().single()
      if (error) throw error
      return data
    }
    const result = storeCreate<Candidate>('candidates', newCand)
    await persistStoreToBlob()
    return result
  },

  async update(id: string, dto: UpdateCandidateDto): Promise<Candidate | null> {
    await ensureBlob()
    if (USE_SUPABASE && supabase) {
      const { data, error } = await supabase.from('candidates').update({ ...dto, updated_at: new Date().toISOString() }).eq('id', id).select().single()
      if (error) { console.error('[db] candidates.update:', error); return null }
      return data ?? null
    }
    const result = storeUpdate<Candidate>('candidates', id, dto)
    await persistStoreToBlob()
    return result
  },

  async delete(id: string): Promise<void> {
    await ensureBlob()
    if (USE_SUPABASE && supabase) {
      const { error } = await supabase.from('candidates').delete().eq('id', id)
      if (error) console.error('[db] candidates.delete:', error)
      return
    }
    storeDelete('candidates', id)
    await persistStoreToBlob()
  },
}

// ── Coordinators ───────────────────────────────────────────────────────────

/** Temporary fallback: derive role from notes field until ALTER TABLE migration is run */
const VALID_COORDINATOR_ROLES: CoordinatorRole[] = [
  'coordinator','garin_coordinator','manager','secretary',
  'education_dept','factories_dept','operations_dept','branches_dept','hagshama_dept',
]
function applyRoleFallback(coord: RegionalCoordinator): RegionalCoordinator {
  if (!coord.role && coord.notes && VALID_COORDINATOR_ROLES.includes(coord.notes as CoordinatorRole)) {
    return { ...coord, role: coord.notes as CoordinatorRole }
  }
  return coord
}

export const coordinatorsDb = {
  async findAll(): Promise<RegionalCoordinator[]> {
    await ensureBlob()
    if (USE_SUPABASE && supabase) {
      const { data, error } = await supabase.from('regional_coordinators').select('*').order('region')
      if (error) { console.error('[db] coordinators.findAll:', error); return [] }
      return (data ?? []).map(applyRoleFallback)
    }
    return [...getStore().regional_coordinators]
  },

  async findById(id: string): Promise<RegionalCoordinator | null> {
    await ensureBlob()
    if (USE_SUPABASE && supabase) {
      const { data, error } = await supabase.from('regional_coordinators').select('*').eq('id', id).single()
      if (error && error.code !== 'PGRST116') console.error('[db] coordinators.findById:', error)
      return data ? applyRoleFallback(data) : null
    }
    return storeFind<RegionalCoordinator>('regional_coordinators', id)
  },

  async findByEmail(email: string): Promise<RegionalCoordinator | null> {
    await ensureBlob()
    if (USE_SUPABASE && supabase) {
      const { data, error } = await supabase.from('regional_coordinators').select('*').eq('email', email).single()
      if (error && error.code !== 'PGRST116') console.error('[db] coordinators.findByEmail:', error)
      return data ? applyRoleFallback(data) : null
    }
    return getStore().regional_coordinators.find(c => c.email === email) ?? null
  },

  async create(data: Omit<RegionalCoordinator, 'id' | 'created_at' | 'updated_at'>): Promise<RegionalCoordinator> {
    await ensureBlob()
    if (USE_SUPABASE && supabase) {
      const now = new Date().toISOString()
      const { data: row, error } = await supabase.from('regional_coordinators').insert([{ ...data, id: uuidv4(), created_at: now, updated_at: now }]).select().single()
      if (error) throw error
      return row
    }
    const result = storeCreate<RegionalCoordinator>('regional_coordinators', data)
    await persistStoreToBlob()
    return result
  },

  async update(id: string, data: Partial<RegionalCoordinator>): Promise<RegionalCoordinator | null> {
    await ensureBlob()
    if (USE_SUPABASE && supabase) {
      const { data: row, error } = await supabase.from('regional_coordinators').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id).select().single()
      if (error) { console.error('[db] coordinators.update:', error); return null }
      return row ?? null
    }
    const result = storeUpdate<RegionalCoordinator>('regional_coordinators', id, data)
    await persistStoreToBlob()
    return result
  },

  async delete(id: string): Promise<void> {
    await ensureBlob()
    if (USE_SUPABASE && supabase) {
      const { error } = await supabase.from('regional_coordinators').delete().eq('id', id)
      if (error) console.error('[db] coordinators.delete:', error)
      return
    }
    storeDelete('regional_coordinators', id)
    await persistStoreToBlob()
  },
}

// ── Positions ──────────────────────────────────────────────────────────────

export const positionsDb = {
  async findAll(region?: string): Promise<OpenPosition[]> {
    await ensureBlob()
    if (USE_SUPABASE && supabase) {
      let q = supabase.from('open_positions').select('*').order('created_at', { ascending: false })
      if (region) q = q.eq('region', region)
      const { data, error } = await q
      if (error) { console.error('[db] positions.findAll:', error); return [] }
      return data ?? []
    }
    let list = [...getStore().open_positions]
    if (region) list = list.filter(p => p.region === region)
    return list
  },

  async create(data: Omit<OpenPosition, 'id' | 'created_at' | 'updated_at'>): Promise<OpenPosition> {
    await ensureBlob()
    if (USE_SUPABASE && supabase) {
      const now = new Date().toISOString()
      const { data: row, error } = await supabase.from('open_positions').insert([{ ...data, id: uuidv4(), created_at: now, updated_at: now }]).select().single()
      if (error) throw error
      return row
    }
    const result = storeCreate<OpenPosition>('open_positions', data)
    await persistStoreToBlob()
    return result
  },

  async update(id: string, data: Partial<OpenPosition>): Promise<OpenPosition | null> {
    await ensureBlob()
    if (USE_SUPABASE && supabase) {
      const { data: row, error } = await supabase.from('open_positions').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id).select().single()
      if (error) { console.error('[db] positions.update:', error); return null }
      return row ?? null
    }
    const result = storeUpdate<OpenPosition>('open_positions', id, data)
    await persistStoreToBlob()
    return result
  },

  async delete(id: string): Promise<void> {
    await ensureBlob()
    if (USE_SUPABASE && supabase) {
      const { error } = await supabase.from('open_positions').delete().eq('id', id)
      if (error) console.error('[db] positions.delete:', error)
      return
    }
    storeDelete('open_positions', id)
    await persistStoreToBlob()
  },
}

// ── Messages ───────────────────────────────────────────────────────────────

export const messagesDb = {
  async findAll(filters?: { status?: string; candidate_id?: string }): Promise<MessageQueueItem[]> {
    await ensureBlob()
    if (USE_SUPABASE && supabase) {
      let q = supabase.from('message_queue').select('*').order('created_at', { ascending: false })
      if (filters?.status) q = q.eq('status', filters.status)
      if (filters?.candidate_id) q = q.eq('candidate_id', filters.candidate_id)
      const { data, error } = await q
      if (error) { console.error('[db] messages.findAll:', error); return [] }
      return data ?? []
    }
    let list = [...getStore().message_queue]
    if (filters?.status) list = list.filter(m => m.status === filters.status)
    if (filters?.candidate_id) list = list.filter(m => m.candidate_id === filters.candidate_id)
    return list.sort((a, b) => b.created_at.localeCompare(a.created_at))
  },

  async create(data: Omit<MessageQueueItem, 'id' | 'created_at' | 'updated_at'>): Promise<MessageQueueItem> {
    await ensureBlob()
    if (USE_SUPABASE && supabase) {
      const now = new Date().toISOString()
      const { data: row, error } = await supabase.from('message_queue').insert([{ ...data, id: uuidv4(), created_at: now, updated_at: now }]).select().single()
      if (error) throw error
      return row
    }
    const result = storeCreate<MessageQueueItem>('message_queue', data)
    await persistStoreToBlob()
    return result
  },

  async update(id: string, data: Partial<MessageQueueItem>): Promise<MessageQueueItem | null> {
    await ensureBlob()
    if (USE_SUPABASE && supabase) {
      const { data: row, error } = await supabase.from('message_queue').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id).select().single()
      if (error) { console.error('[db] messages.update:', error); return null }
      return row ?? null
    }
    const result = storeUpdate<MessageQueueItem>('message_queue', id, data)
    await persistStoreToBlob()
    return result
  },
}

// ── Templates ──────────────────────────────────────────────────────────────

export const templatesDb = {
  async findAll(): Promise<MessageTemplate[]> {
    await ensureBlob()
    if (USE_SUPABASE && supabase) {
      const { data, error } = await supabase.from('message_templates').select('*').eq('active', true)
      if (error) { console.error('[db] templates.findAll:', error); return [] }
      return data ?? []
    }
    return getStore().message_templates.filter(t => t.active)
  },

  async findByKey(key: string): Promise<MessageTemplate | null> {
    if (USE_SUPABASE && supabase) {
      const { data, error } = await supabase.from('message_templates').select('*').eq('template_key', key).single()
      if (error && error.code !== 'PGRST116') console.error('[db] templates.findByKey:', error)
      return data ?? null
    }
    return getStore().message_templates.find(t => t.template_key === key) ?? null
  },

  async update(id: string, data: Partial<MessageTemplate>): Promise<MessageTemplate | null> {
    await ensureBlob()
    if (USE_SUPABASE && supabase) {
      const { data: row, error } = await supabase.from('message_templates').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id).select().single()
      if (error) { console.error('[db] templates.update:', error); return null }
      return row ?? null
    }
    const result = storeUpdate<MessageTemplate>('message_templates', id, data)
    await persistStoreToBlob()
    return result
  },
}

// ── Questionnaire Answers ──────────────────────────────────────────────────

export const answersDb = {
  async findByCandidateId(candidateId: string): Promise<QuestionnaireAnswer[]> {
    await ensureBlob()
    if (USE_SUPABASE && supabase) {
      const { data, error } = await supabase.from('questionnaire_answers').select('*').eq('candidate_id', candidateId).order('created_at')
      if (error) { console.error('[db] answers.findByCandidateId:', error); return [] }
      return data ?? []
    }
    return getStore().questionnaire_answers.filter(a => a.candidate_id === candidateId)
  },

  async createMany(answers: Omit<QuestionnaireAnswer, 'id' | 'created_at'>[]): Promise<void> {
    await ensureBlob()
    const now = new Date().toISOString()
    if (USE_SUPABASE && supabase) {
      const rows = answers.map(a => ({ ...a, id: uuidv4(), created_at: now }))
      const { error } = await supabase.from('questionnaire_answers').insert(rows)
      if (error) console.error('[db] answers.createMany:', error)
      return
    }
    const store = getStore()
    answers.forEach(a => {
      store.questionnaire_answers.push({ ...a, id: uuidv4(), created_at: now })
    })
    await persistStoreToBlob()
  },
}

// ── Activity Log ───────────────────────────────────────────────────────────

export const activityDb = {
  async log(entry: Omit<ActivityLogItem, 'id' | 'created_at'>): Promise<void> {
    await ensureBlob()
    const now = new Date().toISOString()
    if (USE_SUPABASE && supabase) {
      const { error } = await supabase.from('activity_log').insert([{ ...entry, id: uuidv4(), created_at: now }])
      if (error) console.error('[db] activity.log:', error)
      return
    }
    getStore().activity_log.push({ ...entry, id: uuidv4(), created_at: now })
    await persistStoreToBlob()
  },

  async findByCandidateId(candidateId: string): Promise<ActivityLogItem[]> {
    if (USE_SUPABASE && supabase) {
      const { data, error } = await supabase.from('activity_log').select('*').eq('candidate_id', candidateId).order('created_at', { ascending: false })
      if (error) { console.error('[db] activity.findByCandidateId:', error); return [] }
      return data ?? []
    }
    return getStore().activity_log
      .filter(a => a.candidate_id === candidateId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
  },
}

// ── Conversations ──────────────────────────────────────────────────────────

export const conversationsDb = {
  async findByCandidateId(candidateId: string): Promise<ConversationMessage[]> {
    await ensureBlob()
    if (USE_SUPABASE && supabase) {
      const { data, error } = await supabase.from('conversation_messages').select('*').eq('candidate_id', candidateId).order('sent_at', { ascending: true })
      if (error) { console.error('[db] conversations.findByCandidateId:', error); return [] }
      return data ?? []
    }
    return getStore().conversation_messages
      .filter(m => m.candidate_id === candidateId)
      .sort((a, b) => a.sent_at.localeCompare(b.sent_at))
  },

  async create(data: Omit<ConversationMessage, 'id' | 'created_at'>): Promise<ConversationMessage> {
    await ensureBlob()
    if (USE_SUPABASE && supabase) {
      const now = new Date().toISOString()
      const item = { ...data, id: uuidv4(), created_at: now }
      const { data: row, error } = await supabase.from('conversation_messages').insert([item]).select().single()
      if (error) {
        // Non-fatal: a missing/unavailable table must not break the WhatsApp
        // webhook or chatbot flow. Log and return the unpersisted item.
        console.error('[db] conversations.create (continuing unpersisted):', error.message)
        return item as ConversationMessage
      }
      return row
    }
    const store = getStore()
    const now = new Date().toISOString()
    const item: ConversationMessage = { ...data, id: uuidv4(), created_at: now }
    store.conversation_messages.push(item)
    await persistStoreToBlob()
    return item
  },

  async findByWaMessageId(waMessageId: string): Promise<ConversationMessage | null> {
    await ensureBlob()
    if (USE_SUPABASE && supabase) {
      const { data, error } = await supabase.from('conversation_messages').select('*').eq('wa_message_id', waMessageId).single()
      if (error && error.code !== 'PGRST116') console.error('[db] conversations.findByWaMessageId:', error)
      return data ?? null
    }
    return getStore().conversation_messages.find(m => m.wa_message_id === waMessageId) ?? null
  },
}

// ── Automation Rules ───────────────────────────────────────────────────────

// Fallback when the automation_rules table doesn't exist yet in Supabase
// (migration-add-automation.sql not run): serve the hardcoded defaults so the
// brain UI shows the rules and fireTrigger keeps working. IDs are synthetic —
// toggling persists only after the migration is applied.
function defaultRulesFallback(): AutomationRule[] {
  return DEFAULT_AUTOMATION_RULES.map((r, i) => ({
    ...r,
    id: `default-${i}`,
    created_at: new Date(0).toISOString(),
  }))
}

export const automationRulesDb = {
  async findAll(): Promise<AutomationRule[]> {
    await ensureBlob()
    if (USE_SUPABASE && supabase) {
      const { data, error } = await supabase.from('automation_rules').select('*').order('created_at')
      if (error) {
        console.error('[db] automationRules.findAll (falling back to defaults):', error.message)
        return defaultRulesFallback()
      }
      return data ?? []
    }
    return [...getStore().automation_rules]
  },

  async findActive(): Promise<AutomationRule[]> {
    await ensureBlob()
    if (USE_SUPABASE && supabase) {
      const { data, error } = await supabase.from('automation_rules').select('*').eq('active', true).order('created_at')
      if (error) {
        console.error('[db] automationRules.findActive (falling back to defaults):', error.message)
        return defaultRulesFallback().filter(r => r.active)
      }
      return data ?? []
    }
    return getStore().automation_rules.filter(r => r.active)
  },

  async create(data: Omit<AutomationRule, 'id' | 'created_at'>): Promise<AutomationRule> {
    await ensureBlob()
    if (USE_SUPABASE && supabase) {
      const now = new Date().toISOString()
      const { data: row, error } = await supabase.from('automation_rules').insert([{ ...data, id: uuidv4(), created_at: now }]).select().single()
      if (error) throw error
      return row
    }
    const store = getStore()
    const now = new Date().toISOString()
    const item: AutomationRule = { ...data, id: uuidv4(), created_at: now }
    store.automation_rules.push(item)
    await persistStoreToBlob()
    return item
  },

  async update(id: string, data: Partial<AutomationRule>): Promise<AutomationRule | null> {
    await ensureBlob()
    if (USE_SUPABASE && supabase) {
      const { data: row, error } = await supabase.from('automation_rules').update(data).eq('id', id).select().single()
      if (error) { console.error('[db] automationRules.update:', error); return null }
      return row ?? null
    }
    const store = getStore()
    const idx = store.automation_rules.findIndex(r => r.id === id)
    if (idx === -1) return null
    store.automation_rules[idx] = { ...store.automation_rules[idx], ...data }
    await persistStoreToBlob()
    return store.automation_rules[idx]
  },
}

// ── Automation Log ─────────────────────────────────────────────────────────

export const automationLogDb = {
  async create(data: Omit<AutomationLog, 'id'>): Promise<AutomationLog> {
    await ensureBlob()
    if (USE_SUPABASE && supabase) {
      const { data: row, error } = await supabase.from('automation_log').insert([{ ...data, id: uuidv4() }]).select().single()
      if (error) throw error
      return row
    }
    const store = getStore()
    const item: AutomationLog = { ...data, id: uuidv4() }
    store.automation_log.push(item)
    await persistStoreToBlob()
    return item
  },

  async findByCandidateId(candidateId: string): Promise<AutomationLog[]> {
    await ensureBlob()
    if (USE_SUPABASE && supabase) {
      const { data, error } = await supabase.from('automation_log').select('*').eq('candidate_id', candidateId).order('fired_at', { ascending: false })
      if (error) { console.error('[db] automationLog.findByCandidateId:', error); return [] }
      return data ?? []
    }
    return getStore().automation_log
      .filter(l => l.candidate_id === candidateId)
      .sort((a, b) => b.fired_at.localeCompare(a.fired_at))
  },
}

// ── Generic KV (backed by admin_settings) ──────────────────────────────────
// Lightweight key→string storage for caches and small state. Same storage
// strategy as waSessionsDb below.

export const kvDb = {
  async get(key: string): Promise<string | null> {
    await ensureBlob()
    if (USE_SUPABASE && supabase) {
      const { data, error } = await supabase
        .from('admin_settings').select('value').eq('key', key).single()
      if (error || !data) return null
      return data.value as string
    }
    return getStore().admin_settings.find(s => s.key === key)?.value ?? null
  },

  async set(key: string, value: string): Promise<void> {
    await ensureBlob()
    const now = new Date().toISOString()
    if (USE_SUPABASE && supabase) {
      await supabase
        .from('admin_settings')
        .upsert({ key, value, updated_at: now }, { onConflict: 'key' })
      return
    }
    const store = getStore()
    const idx = store.admin_settings.findIndex(s => s.key === key)
    if (idx >= 0) {
      store.admin_settings[idx] = { ...store.admin_settings[idx], value, updated_at: now }
    } else {
      store.admin_settings.push({ id: uuidv4(), key, value, created_at: now, updated_at: now })
    }
    await persistStoreToBlob()
  },
}

// ── WA Chatbot Sessions ────────────────────────────────────────────────────
// Sessions are stored as JSON blobs in admin_settings, keyed as wa_session_{phone}.
// They're transient (one per active chatbot conversation) and cleaned up on completion.

export const waSessionsDb = {
  async get(phone: string): Promise<WaChatbotSession | null> {
    await ensureBlob()
    const key = `wa_session_${phone}`
    if (USE_SUPABASE && supabase) {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('value')
        .eq('key', key)
        .single()
      if (error || !data) return null
      try { return JSON.parse(data.value) as WaChatbotSession } catch { return null }
    }
    const setting = getStore().admin_settings.find(s => s.key === key)
    if (!setting) return null
    try { return JSON.parse(setting.value) as WaChatbotSession } catch { return null }
  },

  async set(session: WaChatbotSession): Promise<void> {
    await ensureBlob()
    const key = `wa_session_${session.phone}`
    const value = JSON.stringify(session)
    const now = new Date().toISOString()
    if (USE_SUPABASE && supabase) {
      await supabase
        .from('admin_settings')
        .upsert({ key, value, updated_at: now }, { onConflict: 'key' })
      return
    }
    const store = getStore()
    const idx = store.admin_settings.findIndex(s => s.key === key)
    if (idx >= 0) {
      store.admin_settings[idx] = { ...store.admin_settings[idx], value, updated_at: now }
    } else {
      store.admin_settings.push({ id: uuidv4(), key, value, created_at: now, updated_at: now })
    }
    await persistStoreToBlob()
  },

  async delete(phone: string): Promise<void> {
    await ensureBlob()
    const key = `wa_session_${phone}`
    if (USE_SUPABASE && supabase) {
      await supabase.from('admin_settings').delete().eq('key', key)
      return
    }
    const store = getStore()
    const idx = store.admin_settings.findIndex(s => s.key === key)
    if (idx >= 0) {
      store.admin_settings.splice(idx, 1)
      await persistStoreToBlob()
    }
  },
}
