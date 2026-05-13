import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'MBtek Executive Dashboard',
  description: 'Executive analytics dashboard for MBtek',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-[#FAFAFA] text-[#1A1A1A] antialiased">{children}</body>
    </html>
  )
}
