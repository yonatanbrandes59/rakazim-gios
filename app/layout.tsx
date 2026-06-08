import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'רכזים בדרך – מאתרים את דור רכזי הנוער הבא',
  description: 'מערכת גיוס חכמה לרכזי נוער – בוגרי גרעינים לקראת שחרור ולאחריו',
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
    shortcut: '/logo.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  )
}
