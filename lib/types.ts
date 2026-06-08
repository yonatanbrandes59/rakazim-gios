// ── Enums ──────────────────────────────────────────────────────────────────

export type Region =
  | 'north'
  | 'afek_hayam'
  | 'afek_maayan'
  | 'center_north'
  | 'center'
  | 'hevel_modiin'
  | 'shfela_tamar'
  | 'merhavim'
  | 'eshkol'

export const REGION_LABELS: Record<Region, string> = {
  north:          'צפון',
  afek_hayam:     'עמק חפר ים',
  afek_maayan:    'עמק חפר מעיין',
  center_north:   'מרכז צפוני',
  center:         'מרכז',
  hevel_modiin:   'חבל מודיעין',
  shfela_tamar:   'שפלה תמר',
  merhavim:       'מרחבים',
  eshkol:         'אשכול',
}

export const REGIONS = Object.keys(REGION_LABELS) as Region[]

export type CandidateStatus =
  | 'new'
  | 'questionnaire_sent'
  | 'questionnaire_opened'
  | 'questionnaire_started'
  | 'questionnaire_completed'
  | 'contact_pending'
  | 'contacted'
  | 'call_scheduled'
  | 'accepted'
  | 'not_relevant'
  | 'not_interested'
  | 'follow_up_later'

export const CANDIDATE_STATUS_LABELS: Record<CandidateStatus, string> = {
  new:                    'חדש',
  questionnaire_sent:     'נשלח שאלון',
  questionnaire_opened:   'פתח שאלון',
  questionnaire_started:  'התחיל שאלון',
  questionnaire_completed:'סיים שאלון',
  contact_pending:        'ממתין לפנייה',
  contacted:              'נוצר קשר',
  call_scheduled:         'נקבעה שיחה',
  accepted:               'התקבל',
  not_relevant:           'לא רלוונטי',
  not_interested:         'לא מעוניין',
  follow_up_later:        'מעקב עתידי',
}

export const CANDIDATE_STATUS_COLORS: Record<CandidateStatus, string> = {
  new:                    'bg-gray-100 text-gray-700',
  questionnaire_sent:     'bg-blue-100 text-blue-800',
  questionnaire_opened:   'bg-sky-100 text-sky-800',
  questionnaire_started:  'bg-cyan-100 text-cyan-800',
  questionnaire_completed:'bg-indigo-100 text-indigo-800',
  contact_pending:        'bg-amber-100 text-amber-800',
  contacted:              'bg-yellow-100 text-yellow-800',
  call_scheduled:         'bg-purple-100 text-purple-800',
  accepted:               'bg-green-100 text-green-800',
  not_relevant:           'bg-red-100 text-red-800',
  not_interested:         'bg-rose-100 text-rose-800',
  follow_up_later:        'bg-orange-100 text-orange-800',
}

export type InterestLevel =
  | 'very_hot'
  | 'interested'
  | 'needs_explanation'
  | 'keep_warm'
  | 'future'
  | 'not_relevant_now'
  | 'not_interested'

export const INTEREST_LEVEL_LABELS: Record<InterestLevel, string> = {
  very_hot:          'חם מאוד 🔥',
  interested:        'מתעניין ✨',
  needs_explanation: 'צריך הסבר 💬',
  keep_warm:         'לשמור חם ☀️',
  future:            'עתידי 📅',
  not_relevant_now:  'לא רלוונטי כרגע',
  not_interested:    'לא מעוניין',
}

export type MessageStatus =
  | 'pending'
  | 'sent'
  | 'failed'
  | 'cancelled'
  | 'mock_sent'
  | 'blocked_paid_provider'
  | 'ready_for_manual_whatsapp'

export type MessageChannel = 'whatsapp' | 'email' | 'sms'

export type PositionStatus = 'open' | 'in_progress' | 'closed'

// ── Entities ───────────────────────────────────────────────────────────────

export interface Candidate {
  id: string
  first_name: string
  last_name: string
  full_name: string
  phone: string
  email?: string
  garin?: string
  garin_year?: string
  army_role?: string
  release_date?: string           // ISO date string
  candidate_token: string
  preferred_region?: Region
  blocked_regions?: Region[]
  has_driving_license?: boolean
  has_car?: boolean
  guidance_experience?: boolean
  leadership_experience?: boolean
  availability_text?: string
  looking_for_work?: string       // e.g. 'now', 'one_two_months', 'after_trip', 'after_psychometric', 'dont_know', 'not_looking'
  interest_in_role?: string       // e.g. 'yes', 'maybe', 'not_sure', 'not_relevant'
  role_attraction?: string[]      // what attracts them to the role
  work_days_per_week?: number
  can_commit_full_year?: boolean
  has_cv?: boolean
  cv_file_url?: string
  preferred_contact_method?: string  // 'whatsapp' | 'call' | 'any'
  best_time_to_contact?: string
  open_answer?: string
  trip_return_date?: string
  studies_end_date?: string

  // Calculated fields
  interest_level?: InterestLevel
  fit_score?: number
  fit_reason?: string
  recommended_contact_date?: string  // ISO date string

  // Management fields
  assigned_region_id?: Region
  assigned_coordinator_id?: string
  status: CandidateStatus
  opt_out: boolean
  consent_given: boolean
  notes?: string
  questionnaire_completed_at?: string
  questionnaire_started_at?: string
  created_at: string
  updated_at: string
}

export interface QuestionnaireAnswer {
  id: string
  candidate_id: string
  question_key: string
  question_text: string
  answer: string
  created_at: string
}

export interface RegionalCoordinator {
  id: string
  name: string
  region: Region
  phone: string
  email: string
  password_hash?: string
  settlements?: string[]
  notes?: string
  created_at: string
  updated_at: string
}

export interface OpenPosition {
  id: string
  settlement_name: string
  region: Region
  coordinator_id?: string
  position_type: 'רכז/ת נוער / רכז/ת סניף'
  job_scope?: string             // e.g. '100%', '80%'
  desired_start_date?: string
  requires_car?: boolean
  notes?: string
  status: PositionStatus
  created_at: string
  updated_at: string
}

export interface MessageTemplate {
  id: string
  template_key: string
  name: string
  channel: MessageChannel
  subject?: string
  body: string
  active: boolean
  created_at: string
  updated_at: string
}

export interface MessageQueueItem {
  id: string
  candidate_id?: string
  coordinator_id?: string
  recipient_phone?: string
  recipient_email?: string
  recipient_type: 'candidate' | 'coordinator' | 'admin'
  channel: MessageChannel
  message_type: string
  message_body: string
  scheduled_for: string          // ISO datetime
  sent_at?: string
  status: MessageStatus
  error_message?: string
  retry_count: number
  provider: string
  whatsapp_manual_link?: string
  created_at: string
  updated_at: string
}

export interface ActivityLogItem {
  id: string
  candidate_id?: string
  user_type: 'admin' | 'coordinator' | 'candidate' | 'system'
  action: string
  details?: Record<string, unknown>
  created_at: string
}

export interface AdminSetting {
  id: string
  key: string
  value: string
  created_at: string
  updated_at: string
}

// ── DTOs ───────────────────────────────────────────────────────────────────

export interface CreateCandidateDto {
  first_name: string
  last_name: string
  phone: string
  email?: string
  garin?: string
  garin_year?: string
  army_role?: string
  release_date?: string
  notes?: string
}

export interface UpdateCandidateDto extends Partial<Omit<Candidate, 'id' | 'created_at' | 'candidate_token'>> {}

export interface CandidateFilters {
  region?: Region
  status?: CandidateStatus
  coordinator_id?: string
  interest_level?: InterestLevel
  search?: string
  contact_date_from?: string
  contact_date_to?: string
}

// ── Auth ───────────────────────────────────────────────────────────────────

export interface AdminUser {
  id: string
  email: string
  role: 'admin'
}

export interface CoordinatorUser {
  id: string
  name: string
  region: Region
  role: 'coordinator'
}

export type AuthUser = AdminUser | CoordinatorUser

// ── Chatbot ────────────────────────────────────────────────────────────────

export interface ChatStep {
  key: string
  questionText: string
  type: 'text' | 'options' | 'multiselect' | 'date' | 'file' | 'confirm' | 'open'
  options?: { value: string; label: string }[]
  optional?: boolean
  condition?: (answers: Record<string, unknown>) => boolean
  placeholder?: string
}

// ── WhatsApp / Automation / Brain ──────────────────────────────────────────

export interface ConversationMessage {
  id: string
  candidate_id: string
  direction: 'in' | 'out'
  body: string
  sent_at: string
  status: 'sent' | 'delivered' | 'read' | 'failed' | 'received'
  wa_message_id?: string
  template_key?: string
  created_at: string
}

export interface AutomationRule {
  id: string
  trigger: 'candidate_created' | 'questionnaire_completed' | '3_days_no_response' | 'coordinator_assigned' | 'fit_score_high'
  condition_json?: Record<string, unknown>
  action: 'send_whatsapp' | 'notify_coordinator' | 'notify_admin' | 'flag_priority'
  template_key: string
  delay_hours: number
  active: boolean
  created_at: string
}

export interface AutomationLog {
  id: string
  candidate_id: string
  rule_id: string
  fired_at: string
  result: string
}

export type CandidatePriority = 'hot' | 'warm' | 'cold'
export type NextAction = 'send_questionnaire' | 'follow_up' | 'schedule_call' | 'archive'

export interface BrainAnalysis {
  priority: CandidatePriority
  nextAction: NextAction
  bestTimeToContact: string
  suggestedMessage: string
  reasoning: string[]
  urgencyScore: number // 0-10
}

export interface DailyBriefing {
  priorityCount: number
  actionItems: Array<{ candidateId: string; action: NextAction; reason: string }>
  summary: string // Hebrew
}
