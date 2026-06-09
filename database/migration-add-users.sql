-- =============================================================
-- migration-add-users.sql
-- Run this once in the Supabase SQL Editor:
--   https://supabase.com/dashboard/project/gmuvmdffvvzyrjjpxjdr/sql
--
-- This script:
--   1. Adds the "role" column to regional_coordinators
--   2. Creates all 13 system users with a temporary password
--
-- Temporary password for all users: Merakzim@2025
-- Change via Admin → רכזות אזוריות → ✏️ edit each user
-- =============================================================

-- Step 1: Add role column
ALTER TABLE regional_coordinators
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'coordinator';

-- Step 2: Insert users (skip if email already exists)
INSERT INTO regional_coordinators (name, region, role, phone, email, password_hash, settlements, notes)
VALUES
  -- ── רכזי אזור ──────────────────────────────────────────────
  ('רכז/ת אזור צפון',          'north',          'coordinator', '050-0000001', 'north@merakzim.local',          '$2b$12$oqjMpvN/d.6YUn.9F/3R3u/fldb/WSDQXlrYh.fie71olsoVLWvLW', '{}', ''),
  ('רכז/ת אזור עמק חפר ים',    'afek_hayam',     'coordinator', '050-0000002', 'afek-hayam@merakzim.local',     '$2b$12$oqjMpvN/d.6YUn.9F/3R3u/fldb/WSDQXlrYh.fie71olsoVLWvLW', '{}', ''),
  ('רכז/ת אזור עמק חפר מעיין', 'afek_maayan',    'coordinator', '050-0000003', 'afek-maayan@merakzim.local',    '$2b$12$oqjMpvN/d.6YUn.9F/3R3u/fldb/WSDQXlrYh.fie71olsoVLWvLW', '{}', ''),
  ('רכז/ת אזור מרכז צפוני',    'center_north',   'coordinator', '050-0000004', 'center-north@merakzim.local',   '$2b$12$oqjMpvN/d.6YUn.9F/3R3u/fldb/WSDQXlrYh.fie71olsoVLWvLW', '{}', ''),
  ('רכז/ת אזור מרכז',          'center',         'coordinator', '050-0000005', 'center@merakzim.local',         '$2b$12$oqjMpvN/d.6YUn.9F/3R3u/fldb/WSDQXlrYh.fie71olsoVLWvLW', '{}', ''),
  ('רכז/ת אזור חבל מודיעין',   'hevel_modiin',   'coordinator', '050-0000006', 'modiin@merakzim.local',         '$2b$12$oqjMpvN/d.6YUn.9F/3R3u/fldb/WSDQXlrYh.fie71olsoVLWvLW', '{}', ''),
  ('רכז/ת אזור שפלה תמר',      'shfela_tamar',   'coordinator', '050-0000007', 'shfela@merakzim.local',         '$2b$12$oqjMpvN/d.6YUn.9F/3R3u/fldb/WSDQXlrYh.fie71olsoVLWvLW', '{}', ''),
  ('רכז/ת אזור מרחבים',        'merhavim',       'coordinator', '050-0000008', 'merhavim@merakzim.local',       '$2b$12$oqjMpvN/d.6YUn.9F/3R3u/fldb/WSDQXlrYh.fie71olsoVLWvLW', '{}', ''),
  ('רכז/ת אזור אשכול',         'eshkol',         'coordinator', '050-0000009', 'eshkol@merakzim.local',         '$2b$12$oqjMpvN/d.6YUn.9F/3R3u/fldb/WSDQXlrYh.fie71olsoVLWvLW', '{}', ''),
  -- ── מנהלי מרחב ─────────────────────────────────────────────
  ('מנהל/ת מרחב צפון',         'north_manager',  'manager',     '050-0000010', 'manager-north@merakzim.local',  '$2b$12$oqjMpvN/d.6YUn.9F/3R3u/fldb/WSDQXlrYh.fie71olsoVLWvLW', '{}', ''),
  ('מנהל/ת מרחב מרכז',         'center_manager', 'manager',     '050-0000011', 'manager-center@merakzim.local', '$2b$12$oqjMpvN/d.6YUn.9F/3R3u/fldb/WSDQXlrYh.fie71olsoVLWvLW', '{}', ''),
  ('מנהל/ת מרחב דרום',         'south_manager',  'manager',     '050-0000012', 'manager-south@merakzim.local',  '$2b$12$oqjMpvN/d.6YUn.9F/3R3u/fldb/WSDQXlrYh.fie71olsoVLWvLW', '{}', ''),
  -- ── מזכ"ל ──────────────────────────────────────────────────
  ('מזכ"ל התנועה',             'national',       'secretary',        '050-0000013', 'secretary@merakzim.local',        '$2b$12$oqjMpvN/d.6YUn.9F/3R3u/fldb/WSDQXlrYh.fie71olsoVLWvLW', '{}', ''),
  -- ── ראשי מחלקות ────────────────────────────────────────────
  ('רכז/ת גרעין',              'national',       'garin_coordinator', '050-0000014', 'garin@merakzim.local',            '$2b$12$oqjMpvN/d.6YUn.9F/3R3u/fldb/WSDQXlrYh.fie71olsoVLWvLW', '{}', ''),
  ('מנהל/ת מחלקת חינוך',       'national',       'education_dept',    '050-0000015', 'education@merakzim.local',        '$2b$12$oqjMpvN/d.6YUn.9F/3R3u/fldb/WSDQXlrYh.fie71olsoVLWvLW', '{}', ''),
  ('מנהל/ת מחלקת מפעלים',      'national',       'factories_dept',    '050-0000016', 'factories@merakzim.local',        '$2b$12$oqjMpvN/d.6YUn.9F/3R3u/fldb/WSDQXlrYh.fie71olsoVLWvLW', '{}', ''),
  ('מנהל/ת מחלקת תפעול',       'national',       'operations_dept',   '050-0000017', 'operations@merakzim.local',       '$2b$12$oqjMpvN/d.6YUn.9F/3R3u/fldb/WSDQXlrYh.fie71olsoVLWvLW', '{}', ''),
  ('מנהל/ת מחלקת סניפים',      'national',       'branches_dept',     '050-0000018', 'branches@merakzim.local',         '$2b$12$oqjMpvN/d.6YUn.9F/3R3u/fldb/WSDQXlrYh.fie71olsoVLWvLW', '{}', '')
ON CONFLICT (email) DO NOTHING;
