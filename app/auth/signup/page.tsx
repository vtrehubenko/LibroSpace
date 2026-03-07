'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'

export default function SignUpPage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (form.password !== form.confirm) {
      setError('Passwords do not match')
      return
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name, email: form.email, password: form.password }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'Sign up failed')
      setLoading(false)
      return
    }

    // Auto sign-in after registration
    const result = await signIn('credentials', {
      email: form.email,
      password: form.password,
      redirect: false,
    })

    if (result?.error) {
      setError('Account created. Please sign in.')
      router.push('/auth/signin')
    } else {
      router.push('/library')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen bg-bv-bg flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background */}
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
          <Link href="/" className="inline-flex items-center gap-2.5 group">
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
          <h1 className="text-2xl font-bold text-bv-text mt-4">Create your library</h1>
          <p className="text-bv-muted text-sm mt-1">Start building your personal collection</p>
        </div>

        {/* Form card */}
        <div className="bg-bv-surface border border-bv-border rounded-2xl p-8 shadow-2xl shadow-black/40">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-bv-muted mb-1.5">
                Name <span className="text-bv-subtle">(optional)</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={set('name')}
                placeholder="Your name"
                autoFocus
                className="w-full px-4 py-3 rounded-xl bg-bv-elevated border border-bv-border text-sm text-bv-text placeholder-bv-subtle focus:outline-none focus:border-bv-gold/50 focus:ring-1 focus:ring-bv-gold/20 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-bv-muted mb-1.5">
                Email address
              </label>
              <input
                type="email"
                value={form.email}
                onChange={set('email')}
                placeholder="you@example.com"
                required
                className="w-full px-4 py-3 rounded-xl bg-bv-elevated border border-bv-border text-sm text-bv-text placeholder-bv-subtle focus:outline-none focus:border-bv-gold/50 focus:ring-1 focus:ring-bv-gold/20 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-bv-muted mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={form.password}
                onChange={set('password')}
                placeholder="At least 6 characters"
                required
                className="w-full px-4 py-3 rounded-xl bg-bv-elevated border border-bv-border text-sm text-bv-text placeholder-bv-subtle focus:outline-none focus:border-bv-gold/50 focus:ring-1 focus:ring-bv-gold/20 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-bv-muted mb-1.5">
                Confirm password
              </label>
              <input
                type="password"
                value={form.confirm}
                onChange={set('confirm')}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 rounded-xl bg-bv-elevated border border-bv-border text-sm text-bv-text placeholder-bv-subtle focus:outline-none focus:border-bv-gold/50 focus:ring-1 focus:ring-bv-gold/20 transition-all"
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
              className="w-full py-3 rounded-xl bg-bv-gold text-bv-bg font-semibold text-sm hover:bg-bv-gold-light disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 shadow-gold-sm hover:shadow-gold hover:-translate-y-px active:translate-y-0 flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-bv-bg/30 border-t-bv-bg rounded-full animate-spin" />
                  Creating account…
                </>
              ) : (
                'Create account'
              )}
            </button>
          </form>

          <p className="text-center text-sm text-bv-subtle mt-6">
            Already have an account?{' '}
            <Link href="/auth/signin" className="text-bv-gold hover:text-bv-gold-light transition-colors font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
