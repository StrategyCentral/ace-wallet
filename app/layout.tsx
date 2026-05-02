import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ACE Wallet',
  description: 'Personal finance and budgeting',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
