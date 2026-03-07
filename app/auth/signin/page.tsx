'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'

export default function SignInPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    if (result?.error) {
      setError('Invalid email or password')
      setLoading(false)
    } else {
      router.push('/library')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen bg-bv-bg flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full bg-amber-950/15 blur-[120px] pointer-events-none" />
      <div className="absolute inset-0 grid-bg pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2.5 group mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-bv-gold-light via-bv-gold to-amber-700 flex items-center justify-center shadow-gold">
              <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
                <rect x="2" y="2" width="5" height="12" rx="1" fill="white" fillOpacity="0.95" />
                <rect x="9" y="2" width="5" height="12" rx="1" fill="white" fillOpacity="0.7" />
                <rect x="7.5" y="2" width="1" height="12" fill="white" fillOpacity="0.2" />
              </svg>
            </div>
            <span className="font-serif font-bold text-xl tracking-tight">
              Libro<span className="text-bv-gold">Space</span>
            </span>
          </Link>
          <h1 className="text-2xl font-bold text-bv-text mt-2">Welcome back</h1>
          <p className="text-bv-muted text-sm mt-1">Sign in to your library</p>
        </div>

        {/* Form card */}
        <div className="bg-bv-surface border border-bv-border rounded-2xl p-8 shadow-2xl shadow-black/40">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-bv-muted mb-1.5">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoFocus
                className="w-full px-4 py-3 rounded-xl bg-bv-elevated border border-bv-border text-sm text-bv-text placeholder-bv-subtle focus:outline-none focus:border-bv-gold/50 focus:ring-1 focus:ring-bv-gold/20 transition-all duration-200"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-bv-muted mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 rounded-xl bg-bv-elevated border border-bv-border text-sm text-bv-text placeholder-bv-subtle focus:outline-none focus:border-bv-gold/50 focus:ring-1 focus:ring-bv-gold/20 transition-all duration-200"
              />
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-950/40 border border-red-800/40 text-red-400 text-sm"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-bv-gold text-bv-bg font-semibold text-sm hover:bg-bv-gold-light disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 shadow-gold-sm hover:shadow-gold hover:-translate-y-px active:translate-y-0 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-bv-bg/30 border-t-bv-bg rounded-full animate-spin" />
                  Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          <p className="text-center text-sm text-bv-subtle mt-6">
            Don&apos;t have an account?{' '}
            <Link href="/auth/signup" className="text-bv-gold hover:text-bv-gold-light transition-colors font-medium">
              Create one
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
