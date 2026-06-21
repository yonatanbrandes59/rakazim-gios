import { ChatStep } from '@/lib/types'

export const OPEN_QUESTIONS: ChatStep[] = [
  {
    key: 'first_name',
    questionText: 'קודם כל — מה שמך הפרטי?',
    type: 'text',
    placeholder: 'שם פרטי',
  },
  {
    key: 'last_name',
    questionText: 'ומה שם המשפחה שלך?',
    type: 'text',
    placeholder: 'שם משפחה',
    optional: true,
  },
  {
    key: 'phone',
    questionText: 'מה מספר הטלפון שלך?',
    type: 'text',
    placeholder: '05X-XXXXXXX',
  },
  {
    key: 'email',
    questionText: 'מה כתובת האימייל שלך? (רשות)',
    type: 'text',
    placeholder: 'example@email.com',
    optional: true,
  },
  {
    key: 'army_role',
    questionText: 'מה היה תפקידך בצבא? (רשות)',
    type: 'text',
    placeholder: 'למשל: מ״כ, קצין, מדריכ/ה...',
    optional: true,
  },
  {
    key: 'release_date',
    questionText: 'מתי שוחררת / אתה/את משתחרר/ת מהצבא?',
    type: 'date',
  },
  {
    key: 'guidance_experience',
    questionText: 'האם יש לך ניסיון בהדרכה או חינוך נוער? (מחנות, תנועות נוער, חוגים...)',
    type: 'confirm',
    options: [
      { value: 'true', label: 'כן, יש לי ✅' },
      { value: 'false', label: 'לא ממש ❌' },
    ],
  },
  {
    key: 'leadership_experience',
    questionText: 'האם יש לך ניסיון בהנהגה? (ראש צוות, פיקוד, מנהל/ת פרויקט...)',
    type: 'confirm',
    options: [
      { value: 'true', label: 'כן ✅' },
      { value: 'false', label: 'לא ממש ❌' },
    ],
  },
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
    ],
  },
  {
    key: 'trip_return_date',
    questionText: 'מתי אתה/את חוזר/ת מהטיול? (בערך)',
    type: 'date',
    optional: true,
    condition: (answers) => answers['looking_for_work'] === 'after_trip',
  },
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
  {
    key: 'has_driving_license',
    questionText: 'יש לך רישיון נהיגה?',
    type: 'confirm',
    options: [
      { value: 'true', label: 'כן ✅' },
      { value: 'false', label: 'לא ❌' },
    ],
  },
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
  {
    key: 'can_commit_full_year',
    questionText: 'האם תוכל/י להתחייב לשנה מלאה?',
    type: 'confirm',
    options: [
      { value: 'true', label: 'כן ✅' },
      { value: 'false', label: 'לא בטוח/ה' },
    ],
  },
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
  {
    key: 'open_answer',
    questionText: 'יש משהו שחשוב לך שנדע? (רשות)',
    type: 'open',
    placeholder: 'ספר/י לנו קצת על עצמך...',
    optional: true,
  },
]
