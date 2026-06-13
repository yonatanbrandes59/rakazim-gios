import { ChatStep } from '@/lib/types'

export const PUBLIC_QUESTIONS: ChatStep[] = [
  // Q1: First name
  {
    key: 'first_name',
    questionText: 'קודם כל — מה שמך הפרטי?',
    type: 'text',
    placeholder: 'שם פרטי',
  },

  // Q2: Last name
  {
    key: 'last_name',
    questionText: 'ומה שם המשפחה שלך?',
    type: 'text',
    placeholder: 'שם משפחה',
  },

  // Q3: Phone
  {
    key: 'phone',
    questionText: 'מה מספר הטלפון שלך? (נשתמש בו ליצירת קשר)',
    type: 'text',
    placeholder: '05X-XXXXXXX',
  },

  // Q4: Email (optional)
  {
    key: 'email',
    questionText: 'מה כתובת האימייל שלך? (רשות – ניתן לדלג)',
    type: 'text',
    placeholder: 'example@email.com',
    optional: true,
  },

  // Q5: How did you hear
  {
    key: 'source',
    questionText: 'איך שמעת עלינו?',
    type: 'options',
    options: [
      { value: 'facebook', label: '📘 פייסבוק' },
      { value: 'friend', label: '👥 חבר/ה' },
      { value: 'instagram', label: '📸 אינסטגרם' },
      { value: 'google', label: '🔍 גוגל' },
      { value: 'event', label: '🎪 אירוע / כנס' },
      { value: 'other', label: '✨ אחר' },
    ],
  },

  // Q6: Army role (optional)
  {
    key: 'army_role',
    questionText: 'מה היה תפקידך בצבא? (רשות – ניתן לדלג)',
    type: 'text',
    placeholder: 'למשל: מ״כ, קצין, מדריכ/ה, תומ״ל...',
    optional: true,
  },

  // Q7: Release date
  {
    key: 'release_date',
    questionText: 'מתי אתה/את משתחרר/ת מהצבא? (תאריך שחרור)',
    type: 'date',
  },

  // Q8: Looking for work
  {
    key: 'looking_for_work',
    questionText: 'מתי תהיה/תהיי פנוי/ה לעבודה?',
    type: 'options',
    options: [
      { value: 'now', label: 'כבר עכשיו 🔥' },
      { value: 'one_two_months', label: 'בעוד חודש-חודשיים' },
      { value: 'after_trip', label: 'אחרי טיול' },
      { value: 'after_psychometric', label: 'אחרי פסיכומטרי/לימודים' },
      { value: 'dont_know', label: 'עוד לא יודע/ת' },
      { value: 'not_looking', label: 'לא מחפש/ת כרגע' },
    ],
  },

  // Q9: Trip return date (conditional)
  {
    key: 'trip_return_date',
    questionText: 'מתי אתה/את חוזר/ת מהטיול? (בערך)',
    type: 'date',
    optional: true,
    condition: (answers) => answers['looking_for_work'] === 'after_trip',
  },

  // Q10: Studies end date (conditional)
  {
    key: 'studies_end_date',
    questionText: 'מתי מסתיים הפסיכומטרי/לימודים? (בערך)',
    type: 'date',
    optional: true,
    condition: (answers) => answers['looking_for_work'] === 'after_psychometric',
  },

  // Q11: Preferred region
  {
    key: 'preferred_region',
    questionText: 'באיזה אזור תרצה/י לעבוד?',
    type: 'options',
    options: [
      { value: 'north',        label: 'צפון' },
      { value: 'afek_hayam',   label: 'עמק חפר ים' },
      { value: 'afek_maayan',  label: 'עמק חפר מעיין' },
      { value: 'center_north', label: 'מרכז צפוני' },
      { value: 'center',       label: 'מרכז' },
      { value: 'hevel_modiin', label: 'חבל מודיעין' },
      { value: 'shfela_tamar', label: 'שפלה תמר' },
      { value: 'merhavim',     label: 'מרחבים' },
      { value: 'eshkol',       label: 'אשכול' },
      { value: 'nationwide',   label: 'כל הארץ' },
    ],
  },

  // Q12: Has driving license
  {
    key: 'has_driving_license',
    questionText: 'יש לך רישיון נהיגה?',
    type: 'confirm',
    options: [
      { value: 'true', label: 'כן ✅' },
      { value: 'false', label: 'לא ❌' },
    ],
  },

  // Q13: Has car (conditional)
  {
    key: 'has_car',
    questionText: 'יש לך רכב?',
    type: 'confirm',
    options: [
      { value: 'true', label: 'כן ✅' },
      { value: 'false', label: 'לא ❌' },
    ],
    condition: (answers) => answers['has_driving_license'] === 'true',
  },

  // Q14: Guidance experience
  {
    key: 'guidance_experience',
    questionText: 'האם יש לך ניסיון בהדרכה? (מחנות, נוער, חינוך וכדומה)',
    type: 'confirm',
    options: [
      { value: 'true', label: 'כן, יש לי ניסיון ✅' },
      { value: 'false', label: 'לא ממש ❌' },
    ],
  },

  // Q15: Leadership experience
  {
    key: 'leadership_experience',
    questionText: 'האם יש לך ניסיון בהנהגה? (ראש צוות, מנהל פרויקט, פיקוד וכדומה)',
    type: 'confirm',
    options: [
      { value: 'true', label: 'כן ✅' },
      { value: 'false', label: 'לא ממש ❌' },
    ],
  },

  // Q16: Interest in role
  {
    key: 'interest_in_role',
    questionText: 'כמה אתה/את מעוניין/ת בתפקיד רכז/ת נוער?',
    type: 'options',
    options: [
      { value: 'yes', label: 'מאוד מעוניין/ת! 🔥' },
      { value: 'maybe', label: 'מתעניין/ת, רוצה לשמוע עוד' },
      { value: 'not_sure', label: 'לא בטוח/ה' },
      { value: 'not_relevant', label: 'לא בשבילי' },
    ],
  },

  // Q17: What attracts you (conditional)
  {
    key: 'role_attraction',
    questionText: 'מה מושך אותך בתפקיד? (ניתן לבחור כמה)',
    type: 'multiselect',
    options: [
      { value: 'impact', label: '🌱 להשפיע על נוער' },
      { value: 'community', label: '🤝 בניית קהילה' },
      { value: 'experience', label: '📚 ניסיון מקצועי' },
      { value: 'leadership', label: '👑 הנהגה' },
      { value: 'values', label: '💙 ערכים ושליחות' },
      { value: 'salary', label: '💰 פרנסה' },
    ],
    condition: (answers) => answers['interest_in_role'] !== 'not_relevant',
  },

  // Q18: Work days per week
  {
    key: 'work_days_per_week',
    questionText: 'כמה ימים בשבוע תוכל/י לעבוד?',
    type: 'options',
    options: [
      { value: '2', label: '2 ימים' },
      { value: '3', label: '3 ימים' },
      { value: '4', label: '4 ימים' },
      { value: '5', label: '5 ימים (משרה מלאה)' },
    ],
  },

  // Q19: Can commit full year
  {
    key: 'can_commit_full_year',
    questionText: 'האם תוכל/י להתחייב לשנה מלאה?',
    type: 'confirm',
    options: [
      { value: 'true', label: 'כן, אני מתחייב/ת לשנה ✅' },
      { value: 'false', label: 'לא בטוח/ה לגבי שנה מלאה' },
    ],
  },

  // Q20: Preferred contact method
  {
    key: 'preferred_contact_method',
    questionText: 'איך הכי נוח לך שנתקשר?',
    type: 'options',
    options: [
      { value: 'whatsapp', label: '💬 וואטסאפ' },
      { value: 'call', label: '📞 שיחת טלפון' },
      { value: 'any', label: 'לא משנה לי' },
    ],
  },

  // Q21: Best time to contact
  {
    key: 'best_time_to_contact',
    questionText: 'מהי השעה הכי טובה לפנות אליך?',
    type: 'options',
    options: [
      { value: 'morning', label: '☀️ בוקר (9:00-12:00)' },
      { value: 'afternoon', label: '🌤️ צהריים (12:00-16:00)' },
      { value: 'evening', label: '🌙 ערב (17:00-20:00)' },
      { value: 'anytime', label: 'כל שעה' },
    ],
  },

  // Q22: Has CV (optional)
  {
    key: 'has_cv',
    questionText: 'האם יש לך קורות חיים מוכנים?',
    type: 'confirm',
    options: [
      { value: 'true', label: 'כן, יש לי ✅' },
      { value: 'false', label: 'עדיין לא' },
    ],
  },

  // Q23: Open answer (optional)
  {
    key: 'open_answer',
    questionText: 'יש משהו שחשוב לך שנדע? (רשות – ניתן לדלג)',
    type: 'open',
    placeholder: 'הרגשות, תקוות, שאלות, כל מה שעל הלב...',
    optional: true,
  },
]
