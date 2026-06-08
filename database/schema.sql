-- ════════════════════════════════════════════════════════════════
-- רכזים בדרך – Supabase PostgreSQL Schema
-- ════════════════════════════════════════════════════════════════
-- Run this in the Supabase SQL Editor to set up your database.
-- ════════════════════════════════════════════════════════════════

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── regional_coordinators ──────────────────────────────────────

create table if not exists regional_coordinators (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null,
  region          text not null,
  phone           text not null,
  email           text not null unique,
  password_hash   text,
  settlements     text[],
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ── candidates ────────────────────────────────────────────────

create table if not exists candidates (
  id                          uuid primary key default uuid_generate_v4(),
  first_name                  text not null,
  last_name                   text not null,
  full_name                   text not null,
  phone                       text not null,
  email                       text,
  garin                       text,
  garin_year                  text,
  army_role                   text,
  release_date                date,
  candidate_token             text not null unique,
  preferred_region            text,
  blocked_regions             text[],
  has_driving_license         boolean,
  has_car                     boolean,
  guidance_experience         boolean,
  leadership_experience       boolean,
  availability_text           text,
  looking_for_work            text,
  interest_in_role            text,
  role_attraction             text[],
  work_days_per_week          int,
  can_commit_full_year        boolean,
  has_cv                      boolean,
  cv_file_url                 text,
  preferred_contact_method    text,
  best_time_to_contact        text,
  open_answer                 text,
  trip_return_date            date,
  studies_end_date            date,

  -- Calculated fields
  interest_level              text,
  fit_score                   int,
  fit_reason                  text,
  recommended_contact_date    date,

  -- Management fields
  assigned_region_id          text,
  assigned_coordinator_id     uuid references regional_coordinators(id) on delete set null,
  status                      text not null default 'new',
  opt_out                     boolean not null default false,
  consent_given               boolean not null default false,
  notes                       text,
  questionnaire_completed_at  timestamptz,
  questionnaire_started_at    timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create index if not exists candidates_status_idx           on candidates(status);
create index if not exists candidates_region_idx           on candidates(preferred_region);
create index if not exists candidates_coordinator_idx      on candidates(assigned_coordinator_id);
create index if not exists candidates_fit_score_idx        on candidates(fit_score desc);
create index if not exists candidates_contact_date_idx     on candidates(recommended_contact_date);

-- ── questionnaire_answers ─────────────────────────────────────

create table if not exists questionnaire_answers (
  id              uuid primary key default uuid_generate_v4(),
  candidate_id    uuid not null references candidates(id) on delete cascade,
  question_key    text not null,
  question_text   text not null,
  answer          text not null,
  created_at      timestamptz not null default now()
);

create index if not exists qa_candidate_idx on questionnaire_answers(candidate_id);

-- ── open_positions ────────────────────────────────────────────

create table if not exists open_positions (
  id                  uuid primary key default uuid_generate_v4(),
  settlement_name     text not null,
  region              text not null,
  coordinator_id      uuid references regional_coordinators(id) on delete set null,
  position_type       text not null default 'רכז/ת נוער / רכז/ת סניף',
  job_scope           text,
  desired_start_date  date,
  requires_car        boolean default false,
  notes               text,
  status              text not null default 'open',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ── message_templates ─────────────────────────────────────────

create table if not exists message_templates (
  id              uuid primary key default uuid_generate_v4(),
  template_key    text not null unique,
  name            text not null,
  channel         text not null,
  subject         text,
  body            text not null,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ── message_queue ─────────────────────────────────────────────

create table if not exists message_queue (
  id                      uuid primary key default uuid_generate_v4(),
  candidate_id            uuid references candidates(id) on delete set null,
  coordinator_id          uuid references regional_coordinators(id) on delete set null,
  recipient_phone         text,
  recipient_email         text,
  recipient_type          text not null,
  channel                 text not null,
  message_type            text not null,
  message_body            text not null,
  scheduled_for           timestamptz not null,
  sent_at                 timestamptz,
  status                  text not null default 'pending',
  error_message           text,
  retry_count             int not null default 0,
  provider                text not null default 'mock',
  whatsapp_manual_link    text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists mq_status_idx        on message_queue(status);
create index if not exists mq_candidate_idx     on message_queue(candidate_id);
create index if not exists mq_scheduled_idx     on message_queue(scheduled_for);

-- ── activity_log ──────────────────────────────────────────────

create table if not exists activity_log (
  id              uuid primary key default uuid_generate_v4(),
  candidate_id    uuid references candidates(id) on delete set null,
  user_type       text not null,
  action          text not null,
  details         jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists al_candidate_idx on activity_log(candidate_id);

-- ── admin_settings ────────────────────────────────────────────

create table if not exists admin_settings (
  id          uuid primary key default uuid_generate_v4(),
  key         text not null unique,
  value       text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════
-- Row Level Security (RLS)
-- ════════════════════════════════════════════════════════════════
-- All access is through the service role key (server-side only).
-- Enable RLS but allow service role to bypass it.

alter table candidates              enable row level security;
alter table regional_coordinators   enable row level security;
alter table questionnaire_answers   enable row level security;
alter table open_positions          enable row level security;
alter table message_templates       enable row level security;
alter table message_queue           enable row level security;
alter table activity_log            enable row level security;
alter table admin_settings          enable row level security;

-- Service role can do everything (used by Next.js server)
create policy "service_role_all_candidates"            on candidates            for all to service_role using (true) with check (true);
create policy "service_role_all_coordinators"          on regional_coordinators for all to service_role using (true) with check (true);
create policy "service_role_all_qa"                    on questionnaire_answers  for all to service_role using (true) with check (true);
create policy "service_role_all_positions"             on open_positions         for all to service_role using (true) with check (true);
create policy "service_role_all_templates"             on message_templates      for all to service_role using (true) with check (true);
create policy "service_role_all_queue"                 on message_queue          for all to service_role using (true) with check (true);
create policy "service_role_all_log"                   on activity_log           for all to service_role using (true) with check (true);
create policy "service_role_all_settings"              on admin_settings         for all to service_role using (true) with check (true);

-- Candidates can read their own questionnaire data (via token – handled server-side)
-- No direct client access needed.

-- ════════════════════════════════════════════════════════════════
-- updated_at trigger
-- ════════════════════════════════════════════════════════════════

create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger set_updated_at_candidates
  before update on candidates
  for each row execute function update_updated_at();

create or replace trigger set_updated_at_coordinators
  before update on regional_coordinators
  for each row execute function update_updated_at();

create or replace trigger set_updated_at_positions
  before update on open_positions
  for each row execute function update_updated_at();

create or replace trigger set_updated_at_templates
  before update on message_templates
  for each row execute function update_updated_at();

create or replace trigger set_updated_at_queue
  before update on message_queue
  for each row execute function update_updated_at();
