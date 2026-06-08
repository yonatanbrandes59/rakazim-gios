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
  QuestionnaireAnswer
} from './types'
import {
  getStore, storeGet, storeFind, storeCreate,
  storeUpdate, storeDelete, initStoreFromBlob
} from './store'
import { generateToken } from './utils'

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
      const { data } = await q
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
      const { data } = await supabase.from('candidates').select('*').eq('id', id).single()
      return data
    }
    return storeFind<Candidate>('candidates', id)
  },

  async findByToken(token: string): Promise<Candidate | null> {
    await ensureBlob()
    if (USE_SUPABASE && supabase) {
      const { data } = await supabase.from('candidates').select('*').eq('candidate_token', token).single()
      return data
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
    return storeCreate<Candidate>('candidates', newCand)
  },

  async update(id: string, dto: UpdateCandidateDto): Promise<Candidate | null> {
    await ensureBlob()
    if (USE_SUPABASE && supabase) {
      const { data } = await supabase.from('candidates').update({ ...dto, updated_at: new Date().toISOString() }).eq('id', id).select().single()
      return data
    }
    return storeUpdate<Candidate>('candidates', id, dto)
  },

  async delete(id: string): Promise<void> {
    await ensureBlob()
    if (USE_SUPABASE && supabase) {
      await supabase.from('candidates').delete().eq('id', id)
      return
    }
    storeDelete('candidates', id)
  },
}

// ── Coordinators ───────────────────────────────────────────────────────────

export const coordinatorsDb = {
  async findAll(): Promise<RegionalCoordinator[]> {
    await ensureBlob()
    if (USE_SUPABASE && supabase) {
      const { data } = await supabase.from('regional_coordinators').select('*').order('region')
      return data ?? []
    }
    return [...getStore().regional_coordinators]
  },

  async findById(id: string): Promise<RegionalCoordinator | null> {
    await ensureBlob()
    if (USE_SUPABASE && supabase) {
      const { data } = await supabase.from('regional_coordinators').select('*').eq('id', id).single()
      return data
    }
    return storeFind<RegionalCoordinator>('regional_coordinators', id)
  },

  async findByEmail(email: string): Promise<RegionalCoordinator | null> {
    await ensureBlob()
    if (USE_SUPABASE && supabase) {
      const { data } = await supabase.from('regional_coordinators').select('*').eq('email', email).single()
      return data
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
    return storeCreate<RegionalCoordinator>('regional_coordinators', data)
  },

  async update(id: string, data: Partial<RegionalCoordinator>): Promise<RegionalCoordinator | null> {
    await ensureBlob()
    if (USE_SUPABASE && supabase) {
      const { data: row } = await supabase.from('regional_coordinators').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id).select().single()
      return row
    }
    return storeUpdate<RegionalCoordinator>('regional_coordinators', id, data)
  },

  async delete(id: string): Promise<void> {
    await ensureBlob()
    if (USE_SUPABASE && supabase) {
      await supabase.from('regional_coordinators').delete().eq('id', id)
      return
    }
    storeDelete('regional_coordinators', id)
  },
}

// ── Positions ──────────────────────────────────────────────────────────────

export const positionsDb = {
  async findAll(region?: string): Promise<OpenPosition[]> {
    await ensureBlob()
    if (USE_SUPABASE && supabase) {
      let q = supabase.from('open_positions').select('*').order('created_at', { ascending: false })
      if (region) q = q.eq('region', region)
      const { data } = await q
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
    return storeCreate<OpenPosition>('open_positions', data)
  },

  async update(id: string, data: Partial<OpenPosition>): Promise<OpenPosition | null> {
    await ensureBlob()
    if (USE_SUPABASE && supabase) {
      const { data: row } = await supabase.from('open_positions').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id).select().single()
      return row
    }
    return storeUpdate<OpenPosition>('open_positions', id, data)
  },

  async delete(id: string): Promise<void> {
    await ensureBlob()
    if (USE_SUPABASE && supabase) {
      await supabase.from('open_positions').delete().eq('id', id)
      return
    }
    storeDelete('open_positions', id)
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
      const { data } = await q
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
    return storeCreate<MessageQueueItem>('message_queue', data)
  },

  async update(id: string, data: Partial<MessageQueueItem>): Promise<MessageQueueItem | null> {
    await ensureBlob()
    if (USE_SUPABASE && supabase) {
      const { data: row } = await supabase.from('message_queue').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id).select().single()
      return row
    }
    return storeUpdate<MessageQueueItem>('message_queue', id, data)
  },
}

// ── Templates ──────────────────────────────────────────────────────────────

export const templatesDb = {
  async findAll(): Promise<MessageTemplate[]> {
    await ensureBlob()
    if (USE_SUPABASE && supabase) {
      const { data } = await supabase.from('message_templates').select('*').eq('active', true)
      return data ?? []
    }
    return getStore().message_templates.filter(t => t.active)
  },

  async findByKey(key: string): Promise<MessageTemplate | null> {
    if (USE_SUPABASE && supabase) {
      const { data } = await supabase.from('message_templates').select('*').eq('template_key', key).single()
      return data
    }
    return getStore().message_templates.find(t => t.template_key === key) ?? null
  },

  async update(id: string, data: Partial<MessageTemplate>): Promise<MessageTemplate | null> {
    if (USE_SUPABASE && supabase) {
      const { data: row } = await supabase.from('message_templates').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id).select().single()
      return row
    }
    return storeUpdate<MessageTemplate>('message_templates', id, data)
  },
}

// ── Questionnaire Answers ──────────────────────────────────────────────────

export const answersDb = {
  async findByCandidateId(candidateId: string): Promise<QuestionnaireAnswer[]> {
    await ensureBlob()
    if (USE_SUPABASE && supabase) {
      const { data } = await supabase.from('questionnaire_answers').select('*').eq('candidate_id', candidateId).order('created_at')
      return data ?? []
    }
    return getStore().questionnaire_answers.filter(a => a.candidate_id === candidateId)
  },

  async createMany(answers: Omit<QuestionnaireAnswer, 'id' | 'created_at'>[]): Promise<void> {
    const now = new Date().toISOString()
    if (USE_SUPABASE && supabase) {
      const rows = answers.map(a => ({ ...a, id: uuidv4(), created_at: now }))
      await supabase.from('questionnaire_answers').insert(rows)
      return
    }
    const store = getStore()
    answers.forEach(a => {
      store.questionnaire_answers.push({ ...a, id: uuidv4(), created_at: now })
    })
  },
}

// ── Activity Log ───────────────────────────────────────────────────────────

export const activityDb = {
  async log(entry: Omit<ActivityLogItem, 'id' | 'created_at'>): Promise<void> {
    await ensureBlob()
    const now = new Date().toISOString()
    if (USE_SUPABASE && supabase) {
      await supabase.from('activity_log').insert([{ ...entry, id: uuidv4(), created_at: now }])
      return
    }
    getStore().activity_log.push({ ...entry, id: uuidv4(), created_at: now })
  },

  async findByCandidateId(candidateId: string): Promise<ActivityLogItem[]> {
    if (USE_SUPABASE && supabase) {
      const { data } = await supabase.from('activity_log').select('*').eq('candidate_id', candidateId).order('created_at', { ascending: false })
      return data ?? []
    }
    return getStore().activity_log
      .filter(a => a.candidate_id === candidateId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
  },
}
