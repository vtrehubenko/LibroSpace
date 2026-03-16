'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { LibraryFile } from '@prisma/client'
import { toast } from 'sonner'
import { CATEGORIES, CATEGORY_COLORS, type CategoryColors } from '@/lib/categories'
import { generateThemeFromAccent, parseCustomTheme } from '@/lib/themeUtils'

interface EditBookModalProps {
  book: LibraryFile | null
  onClose: () => void
  onSuccess: (updated: LibraryFile) => void
}

export default function EditBookModal({ book, onClose, onSuccess }: EditBookModalProps) {
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [category, setCategory] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [customTheme, setCustomTheme] = useState<CategoryColors | null>(null)
  const [pickerColor, setPickerColor] = useState('#d4a853')
  const [showPicker, setShowPicker] = useState(false)
  const [saving, setSaving] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pickerContainerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)

  // Populate form when book changes
  useEffect(() => {
    if (book) {
      setTitle(book.title)
      setAuthor(book.author || '')
      setCategory(book.category || 'Other')
      setTags((book as any).tags || [])
      const parsed = parseCustomTheme((book as any).customTheme)
      setCustomTheme(parsed)
      if (parsed) setPickerColor(parsed.accent)
      setTagInput('')
      setShowPicker(false)
    }
  }, [book])

  // Draw color wheel
  const drawColorWheel = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const size = canvas.width
    const center = size / 2
    const radius = center - 4

    ctx.clearRect(0, 0, size, size)

    // Draw hue/saturation wheel
    for (let angle = 0; angle < 360; angle++) {
      const startRad = (angle - 1) * (Math.PI / 180)
      const endRad = (angle + 1) * (Math.PI / 180)

      const gradient = ctx.createRadialGradient(center, center, 0, center, center, radius)
      gradient.addColorStop(0, `hsl(${angle}, 10%, 100%)`)
      gradient.addColorStop(0.5, `hsl(${angle}, 80%, 55%)`)
      gradient.addColorStop(1, `hsl(${angle}, 100%, 35%)`)

      ctx.beginPath()
      ctx.moveTo(center, center)
      ctx.arc(center, center, radius, startRad, endRad)
      ctx.closePath()
      ctx.fillStyle = gradient
      ctx.fill()
    }

    // Soften center
    const centerGrad = ctx.createRadialGradient(center, center, 0, center, center, radius * 0.15)
    centerGrad.addColorStop(0, 'rgba(255,255,255,0.3)')
    centerGrad.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = centerGrad
    ctx.beginPath()
    ctx.arc(center, center, radius, 0, Math.PI * 2)
    ctx.fill()
  }, [])

  useEffect(() => {
    if (showPicker) {
      requestAnimationFrame(drawColorWheel)
    }
  }, [showPicker, drawColorWheel])

  const getColorFromPosition = (x: number, y: number): string | null => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const cx = x - rect.left
    const cy = y - rect.top
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    const px = Math.round(cx * (canvas.width / rect.width))
    const py = Math.round(cy * (canvas.height / rect.height))

    if (px < 0 || px >= canvas.width || py < 0 || py >= canvas.height) return null

    const center = canvas.width / 2
    const dist = Math.sqrt((px - center) ** 2 + (py - center) ** 2)
    if (dist > center - 4) return null

    const data = ctx.getImageData(px, py, 1, 1).data
    return `#${data[0].toString(16).padStart(2, '0')}${data[1].toString(16).padStart(2, '0')}${data[2].toString(16).padStart(2, '0')}`
  }

  const handleCanvasInteraction = (e: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    const color = getColorFromPosition(clientX, clientY)
    if (color) {
      setPickerColor(color)
      const theme = generateThemeFromAccent(color)
      setCustomTheme(theme)
    }
  }

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true
    handleCanvasInteraction(e)
  }

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (isDragging.current) handleCanvasInteraction(e)
  }

  const handleCanvasMouseUp = () => {
    isDragging.current = false
  }

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase()
    if (!tag || tags.length >= 10) return
    if (tags.some((t) => t.toLowerCase() === tag)) {
      setTagInput('')
      return
    }
    setTags([...tags, tag])
    setTagInput('')
  }

  const removeTag = (index: number) => {
    setTags(tags.filter((_, i) => i !== index))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTag()
    }
    if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
      removeTag(tags.length - 1)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!book || !title.trim()) return

    setSaving(true)
    try {
      const body: Record<string, unknown> = {}

      if (title.trim() !== book.title) body.title = title.trim()
      if ((author.trim() || null) !== (book.author || null)) body.author = author.trim() || null
      if (category !== (book.category || 'Other')) body.category = category

      const origTags = (book as any).tags || []
      if (JSON.stringify(tags) !== JSON.stringify(origTags)) body.tags = tags

      const origTheme = parseCustomTheme((book as any).customTheme)
      if (JSON.stringify(customTheme) !== JSON.stringify(origTheme)) {
        body.customTheme = customTheme
      }

      if (Object.keys(body).length === 0) {
        onClose()
        return
      }

      const res = await fetch(`/api/books/${book.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update')
      }

      const updated: LibraryFile = await res.json()
      toast.success('Book updated')
      onSuccess(updated)
    } catch (err: any) {
      toast.error(err.message || 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  // Preview theme: customTheme > category > fallback
  const previewTheme = customTheme || CATEGORY_COLORS[category] || CATEGORY_COLORS.Other

  return (
    <AnimatePresence>
      {book && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="relative w-full max-w-lg max-h-[90vh] bg-bv-surface border border-bv-border rounded-2xl shadow-2xl shadow-black/60 overflow-hidden flex flex-col"
              initial={{ scale: 0.95, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 16 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-bv-border shrink-0">
                <div>
                  <h2 className="font-semibold text-bv-text">Edit Book</h2>
                  <p className="text-xs text-bv-subtle mt-0.5">Update details, tags, and theme</p>
                </div>
                <button
                  onClick={onClose}
                  disabled={saving}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-bv-subtle hover:text-bv-text hover:bg-bv-elevated transition-colors disabled:opacity-40"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto">
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Title + Author */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-bv-muted mb-1.5">
                        Title <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Book title"
                        required
                        className="w-full px-3 py-2.5 rounded-xl bg-bv-elevated border border-bv-border text-sm text-bv-text placeholder-bv-subtle focus:outline-none focus:border-bv-gold/50 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-bv-muted mb-1.5">Author</label>
                      <input
                        type="text"
                        value={author}
                        onChange={(e) => setAuthor(e.target.value)}
                        placeholder="Author name"
                        className="w-full px-3 py-2.5 rounded-xl bg-bv-elevated border border-bv-border text-sm text-bv-text placeholder-bv-subtle focus:outline-none focus:border-bv-gold/50 transition-all"
                      />
                    </div>
                  </div>

                  {/* Category */}
                  <div>
                    <label className="block text-xs font-medium text-bv-muted mb-1.5">Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-bv-elevated border border-bv-border text-sm text-bv-text focus:outline-none focus:border-bv-gold/50 transition-all appearance-none"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c} className="bg-bv-elevated">{c}</option>
                      ))}
                    </select>
                  </div>

                  {/* Tags */}
                  <div>
                    <label className="block text-xs font-medium text-bv-muted mb-1.5">
                      Tags <span className="text-bv-subtle">({tags.length}/10)</span>
                    </label>
                    <div className="rounded-xl bg-bv-elevated border border-bv-border px-3 py-2 focus-within:border-bv-gold/50 transition-all">
                      <div className="flex flex-wrap gap-1.5 mb-1.5">
                        {tags.map((tag, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-bv-surface border border-bv-border text-bv-muted"
                          >
                            {tag}
                            <button
                              type="button"
                              onClick={() => removeTag(i)}
                              className="text-bv-subtle hover:text-bv-text transition-colors"
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </span>
                        ))}
                      </div>
                      {tags.length < 10 && (
                        <input
                          type="text"
                          value={tagInput}
                          onChange={(e) => setTagInput(e.target.value)}
                          onKeyDown={handleKeyDown}
                          placeholder={tags.length === 0 ? 'Type a tag and press Enter' : 'Add another...'}
                          maxLength={30}
                          className="w-full bg-transparent text-sm text-bv-text placeholder-bv-subtle focus:outline-none"
                        />
                      )}
                    </div>
                  </div>

                  {/* Custom Theme */}
                  <div>
                    <label className="block text-xs font-medium text-bv-muted mb-2">Book Theme</label>

                    {/* Preview card */}
                    <div
                      className="h-16 rounded-xl mb-3 flex items-center px-4 gap-3 border border-white/5"
                      style={{
                        background: `linear-gradient(150deg, ${previewTheme.from} 0%, ${previewTheme.to} 100%)`,
                        borderLeft: `5px solid ${previewTheme.spine}`,
                      }}
                    >
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ background: previewTheme.accent }}
                      />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-1.5 rounded-full w-3/4" style={{ background: `${previewTheme.accent}30` }} />
                        <div className="h-1.5 rounded-full w-1/2" style={{ background: `${previewTheme.accent}20` }} />
                      </div>
                      <span className="text-[10px] text-bv-subtle">Preview</span>
                    </div>

                    {/* Preset swatches */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {Object.entries(CATEGORY_COLORS).map(([name, colors]) => (
                        <button
                          key={name}
                          type="button"
                          title={name}
                          onClick={() => {
                            setCustomTheme(colors)
                            setPickerColor(colors.accent)
                          }}
                          className="relative w-7 h-7 rounded-full border-2 transition-all hover:scale-110"
                          style={{
                            background: `linear-gradient(135deg, ${colors.from}, ${colors.accent})`,
                            borderColor: customTheme?.accent === colors.accent ? colors.accent : 'transparent',
                          }}
                        >
                          {customTheme?.accent === colors.accent && (
                            <svg className="absolute inset-0 m-auto w-3 h-3 text-white drop-shadow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      ))}

                      {/* Custom color toggle */}
                      <button
                        type="button"
                        onClick={() => setShowPicker(!showPicker)}
                        className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all hover:scale-110 ${
                          showPicker ? 'border-bv-gold bg-bv-gold/20' : 'border-bv-border bg-bv-elevated'
                        }`}
                      >
                        <svg className="w-3.5 h-3.5 text-bv-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                        </svg>
                      </button>

                      {/* Reset button */}
                      {customTheme && (
                        <button
                          type="button"
                          onClick={() => {
                            setCustomTheme(null)
                            setShowPicker(false)
                          }}
                          className="text-[10px] text-bv-subtle hover:text-bv-muted transition-colors ml-1"
                        >
                          Reset
                        </button>
                      )}
                    </div>

                    {/* Color wheel picker */}
                    <AnimatePresence>
                      {showPicker && (
                        <motion.div
                          ref={pickerContainerRef}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="pt-3 flex items-center gap-4">
                            <div className="relative shrink-0">
                              <canvas
                                ref={canvasRef}
                                width={160}
                                height={160}
                                className="rounded-full cursor-crosshair"
                                style={{ width: 160, height: 160 }}
                                onMouseDown={handleCanvasMouseDown}
                                onMouseMove={handleCanvasMouseMove}
                                onMouseUp={handleCanvasMouseUp}
                                onMouseLeave={handleCanvasMouseUp}
                              />
                            </div>
                            <div className="flex-1 space-y-3">
                              <div>
                                <label className="block text-[10px] text-bv-subtle mb-1">Hex Color</label>
                                <input
                                  type="text"
                                  value={pickerColor}
                                  onChange={(e) => {
                                    const val = e.target.value
                                    setPickerColor(val)
                                    if (/^#[0-9a-fA-F]{6}$/.test(val)) {
                                      setCustomTheme(generateThemeFromAccent(val))
                                    }
                                  }}
                                  maxLength={7}
                                  className="w-full px-2.5 py-1.5 rounded-lg bg-bv-elevated border border-bv-border text-xs text-bv-text font-mono focus:outline-none focus:border-bv-gold/50 transition-all"
                                />
                              </div>
                              <div
                                className="w-full h-8 rounded-lg border border-white/10"
                                style={{ background: pickerColor }}
                              />
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={onClose}
                      disabled={saving}
                      className="flex-1 py-2.5 rounded-xl border border-bv-border text-sm text-bv-muted hover:text-bv-text hover:bg-bv-elevated transition-all disabled:opacity-40"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!title.trim() || saving}
                      className="flex-1 py-2.5 rounded-xl bg-bv-gold text-bv-bg font-semibold text-sm hover:bg-bv-gold-light disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-gold-sm hover:shadow-gold"
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
