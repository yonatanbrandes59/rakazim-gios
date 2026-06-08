-- ════════════════════════════════════════════════════════════════
-- רכזים בדרך – Seed Data for Supabase
-- ════════════════════════════════════════════════════════════════
-- Run AFTER schema.sql
-- ════════════════════════════════════════════════════════════════

-- Coordinators
insert into regional_coordinators (id, name, region, phone, email, password_hash, settlements) values
  ('11111111-0000-0000-0000-000000000001', 'מיכל לוי',   'north',     '052-1111111', 'michal@demo.com', 'demo', array['קרית שמונה', 'מטולה', 'שלומי']),
  ('11111111-0000-0000-0000-000000000002', 'נועה כהן',   'center',    '052-2222222', 'noa@demo.com',    'demo', array['פתח תקווה', 'רמת גן', 'בני ברק']),
  ('11111111-0000-0000-0000-000000000003', 'יואב שפירא', 'jerusalem', '052-3333333', 'yoav@demo.com',   'demo', array['ירושלים', 'בית שמש', 'מבשרת ציון']),
  ('11111111-0000-0000-0000-000000000004', 'שיר גולן',   'south',     '052-4444444', 'shir@demo.com',   'demo', array['באר שבע', 'דימונה', 'אשדוד'])
on conflict (id) do nothing;

-- Message Templates
insert into message_templates (template_key, name, channel, subject, body) values
  ('opening_whatsapp', 'פתיחה – וואטסאפ', 'whatsapp', null,
   'היי {first_name}! 👋
אני {coordinator_name} מצוות רכזים בדרך 🌟

שמעתי שאתה/את בוגר/ת גרעין ולא מזמן השתחררת.
יש לנו תפקיד שמחכה לך – רכז/ת נוער! 🏕️

זה בדיוק השלב לחבר בין הניסיון שצברת לבין משמעות אמיתית.

רגע אחד מהזמן שלך? 👇
{questionnaire_link}'),

  ('thank_you_whatsapp', 'תודה על שאלון – וואטסאפ', 'whatsapp', null,
   'היי {first_name}! 🙏
תודה שמילאת את השאלון – זה אומר לנו הרבה!

נסקור את התשובות שלך ונחזור אליך בהקדם.
אם יש שאלות – תרגיש/י חופשי/ה לכתוב 💙

– {coordinator_name}'),

  ('reminder_whatsapp', 'תזכורת – וואטסאפ', 'whatsapp', null,
   'היי {first_name}! 👋
שלחתי לך לינק לשאלון לפני כמה ימים.

אם לא הספקת עוד – ממש שווה דקה:
{questionnaire_link}

אם לא הגיע הזמן הנכון – אין בעיה, פשוט תגיד/י 🙏'),

  ('coordinator_alert', 'התראה לרכזת – מועמד חדש', 'whatsapp', null,
   'היי {coordinator_name}! 🔔
מועמד/ת חדש/ה סיים/ה שאלון:

👤 {full_name}
📍 {preferred_region}
🎯 ציון התאמה: {fit_score}
📞 {phone}

מומלץ לפנות עד: {recommended_contact_date}'),

  ('opening_email', 'פתיחה – אימייל', 'email', 'הזדמנות לתפקיד משמעותי – רכז/ת נוער',
   'שלום {first_name},

אנחנו מצוות "רכזים בדרך" – מיזם שמחבר בוגרי גרעינים לתפקיד רכז/ת נוער.

בהמשך לסיום השירות הצבאי, יש לנו תפקיד שמחכה לך: רכז/ת נוער / רכז/ת סניף.

מלא/י שאלון קצר ונחזור אליך:
{questionnaire_link}

בברכה,
{coordinator_name}')
on conflict (template_key) do nothing;

-- Open Positions
insert into open_positions (settlement_name, region, coordinator_id, job_scope, desired_start_date, requires_car) values
  ('קרית שמונה',   'north',     '11111111-0000-0000-0000-000000000001', '100%', current_date + 30, true),
  ('פתח תקווה',   'center',    '11111111-0000-0000-0000-000000000002', '80%',  current_date + 45, false),
  ('ירושלים מרכז','jerusalem', '11111111-0000-0000-0000-000000000003', '100%', current_date + 60, false),
  ('באר שבע',     'south',     '11111111-0000-0000-0000-000000000004', '100%', current_date + 30, true),
  ('חדרה',        'sharon',    null,                                    '80%',  current_date + 90, false),
  ('חיפה',        'haifa_valleys', null,                               '100%', current_date + 30, false);
