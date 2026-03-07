'use client'

import { SessionProvider } from 'next-auth/react'
import { Toaster } from 'sonner'

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <Toaster
        theme="dark"
        position="bottom-right"
        richColors
        toastOptions={{
          style: {
            background: '#1a160f',
            border: '1px solid #2a2218',
            color: '#f0ebe3',
          },
        }}
      />
    </SessionProvider>
  )
}
