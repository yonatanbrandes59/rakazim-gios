-- ════════════════════════════════════════════════════════════════
-- Migration: automation engine + WhatsApp conversation tables
-- ────────────────────────────────────────────────────────────────
-- Adds the 3 tables that exist in the app code but were missing from
-- the original schema.sql:
--   • conversation_messages — WhatsApp chat history per candidate
--   • automation_rules      — the AI-brain automation rules
--   • automation_log        — audit of every rule firing
--
-- HOW TO RUN: Supabase Dashboard → SQL Editor → paste this file → Run.
-- Safe to run multiple times (idempotent).
-- ════════════════════════════════════════════════════════════════

create extension if not exists "uuid-ossp";

-- ── conversation_messages ─────────────────────────────────────
-- candidate_id is TEXT (not a uuid FK) on purpose: the WhatsApp webhook
-- stores 'unknown' for messages from numbers not yet in the system.

create table if not exists conversation_messages (
  id            uuid primary key default uuid_generate_v4(),
  candidate_id  text not null,
  direction     text not null check (direction in ('in', 'out')),
  body          text not null,
  sent_at       timestamptz not null default now(),
  status        text not null default 'sent',
  wa_message_id text,
  template_key  text,
  created_at    timestamptz not null default now()
);

create index if not exists cm_candidate_idx on conversation_messages(candidate_id);
create index if not exists cm_wa_message_idx on conversation_messages(wa_message_id);

-- ── automation_rules ──────────────────────────────────────────

create table if not exists automation_rules (
  id              uuid primary key default uuid_generate_v4(),
  trigger         text not null,
  condition_json  jsonb default '{}'::jsonb,
  action          text not null,
  template_key    text not null,
  delay_hours     integer not null default 0,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

-- ── automation_log ────────────────────────────────────────────

create table if not exists automation_log (
  id            uuid primary key default uuid_generate_v4(),
  candidate_id  text not null,
  rule_id       text not null,
  fired_at      timestamptz not null default now(),
  result        text not null default 'ok'
);

create index if not exists alog_candidate_idx on automation_log(candidate_id);

-- ── RLS (same pattern as schema.sql — service role only) ──────

alter table conversation_messages enable row level security;
alter table automation_rules      enable row level security;
alter table automation_log        enable row level security;

drop policy if exists "service_role_all_conversations" on conversation_messages;
drop policy if exists "service_role_all_automation_rules" on automation_rules;
drop policy if exists "service_role_all_automation_log" on automation_log;

create policy "service_role_all_conversations"    on conversation_messages for all to service_role using (true) with check (true);
create policy "service_role_all_automation_rules" on automation_rules      for all to service_role using (true) with check (true);
create policy "service_role_all_automation_log"   on automation_log        for all to service_role using (true) with check (true);

-- ── Seed default automation rules (only when table is empty) ──

insert into automation_rules (trigger, action, template_key, delay_hours, active, condition_json)
select * from (values
  ('candidate_created',       'notify_admin',       'alert_to_coordinator',  0,  true, '{}'::jsonb),
  ('questionnaire_completed', 'send_whatsapp',      'thank_you_candidate',   0,  true, '{}'::jsonb),
  ('questionnaire_completed', 'notify_coordinator', 'alert_to_coordinator',  0,  true, '{}'::jsonb),
  ('questionnaire_completed', 'notify_admin',       'alert_to_coordinator',  0,  true, '{}'::jsonb),
  ('3_days_no_response',      'send_whatsapp',      'reminder_to_candidate', 72, true, '{}'::jsonb),
  ('coordinator_assigned',    'notify_coordinator', 'alert_to_coordinator',  0,  true, '{}'::jsonb),
  ('fit_score_high',          'flag_priority',      'alert_to_coordinator',  0,  true, '{"minInterestLevel":"very_hot"}'::jsonb)
) as seed(trigger, action, template_key, delay_hours, active, condition_json)
where not exists (select 1 from automation_rules);

-- Done. Verify with:
--   select trigger, action, active from automation_rules order by created_at;
