import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AI Fashion Store',
  description: 'AIがあなたの好みに合わせて商品をおすすめします',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-gray-50">
        {children}
      </body>
    </html>
  )
}