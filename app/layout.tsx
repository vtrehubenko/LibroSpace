import type { Metadata } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
import Providers from '@/components/Providers'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  weight: ['400', '600', '700', '900'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'LibroSpace — Your Personal Digital Library',
  description:
    'Store, organize, and read PDF, EPUB, and document files in one elegant place. Your entire library, always with you.',
  keywords: 'digital library, PDF reader, EPUB reader, document organizer',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body className="bg-bv-bg text-bv-text antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
