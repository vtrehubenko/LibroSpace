'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { toast } from 'sonner'

interface User {
  id: string
  name: string | null
  username: string | null
  bio: string | null
  avatarUrl: string | null
  isPrivate: boolean
}

export default function EditProfileClient({ user }: { user: User }) {
  const router = useRouter()
  const [name, setName] = useState(user.name ?? '')
  const [username, setUsername] = useState(user.username ?? '')
  const [bio, setBio] = useState(user.bio ?? '')
  const [isPrivate, setIsPrivate] = useState(user.isPrivate)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), username, bio, isPrivate }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('Profile updated!')
        router.push(`/profile/${data.username}`)
        router.refresh()
      } else {
        toast.error(data.error)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-bv-surface rounded-2xl border border-bv-border p-6"
      >
        <h1 className="text-xl font-bold text-bv-text mb-6">Edit Profile</h1>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-bv-muted mb-1.5">Display Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={50}
              className="w-full px-3 py-2 rounded-lg bg-bv-elevated border border-bv-border text-bv-text text-sm focus:outline-none focus:border-bv-gold/40"
              placeholder="Your display name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-bv-muted mb-1.5">Username</label>
            <div className="flex items-center">
              <span className="text-sm text-bv-subtle mr-1">@</span>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                maxLength={30}
                className="flex-1 px-3 py-2 rounded-lg bg-bv-elevated border border-bv-border text-bv-text text-sm focus:outline-none focus:border-bv-gold/40"
                placeholder="username"
              />
            </div>
            <p className="text-xs text-bv-subtle mt-1">3-30 characters, letters, numbers, hyphens, underscores</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-bv-muted mb-1.5">Bio</label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              maxLength={500}
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-bv-elevated border border-bv-border text-bv-text text-sm focus:outline-none focus:border-bv-gold/40 resize-none"
              placeholder="Tell others about yourself..."
            />
            <p className="text-xs text-bv-subtle mt-1">{bio.length}/500</p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-bv-muted">Private Profile</p>
              <p className="text-xs text-bv-subtle">Only friends can see your posts and bookshelves</p>
            </div>
            <button
              onClick={() => setIsPrivate(!isPrivate)}
              className={`w-11 h-6 rounded-full transition-colors relative ${
                isPrivate ? 'bg-bv-gold' : 'bg-bv-elevated'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
                  isPrivate ? 'translate-x-[22px]' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving || !username || username.length < 3}
              className="px-6 py-2 rounded-lg bg-bv-gold text-bv-bg font-medium text-sm hover:bg-bv-gold-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={() => router.back()}
              className="px-6 py-2 rounded-lg bg-bv-elevated text-bv-muted text-sm hover:text-bv-text transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
