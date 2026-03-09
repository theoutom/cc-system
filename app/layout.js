import './globals.css'

export const metadata = {
  title: 'CC System — Creative Corner',
  description: 'Sistem manajemen peminjaman & jadwal Creative Corner',
}

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  )
}
