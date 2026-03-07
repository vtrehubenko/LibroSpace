'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useUploadThing } from '@/lib/uploadthing-client'
import type { LibraryFile } from '@prisma/client'
import { toast } from 'sonner'

const CATEGORIES = ['Programming', 'Frontend', 'Design', 'Notes', 'Science', 'Fiction', 'History', 'Other']

interface UploadModalProps {
  open: boolean
  onClose: () => void
  onSuccess: (book: LibraryFile) => void
}

type Step = 'form' | 'uploading' | 'saving'

export default function UploadModal({ open, onClose, onSuccess }: UploadModalProps) {
  const [step, setStep] = useState<Step>('form')
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [category, setCategory] = useState('Programming')
  const [bookFile, setBookFile] = useState<File | null>(null)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)

  const bookInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)

  const { startUpload: uploadBook } = useUploadThing('bookUploader', {
    onUploadProgress: (p) => setUploadProgress(p / 2),
  })
  const { startUpload: uploadCover } = useUploadThing('coverUploader', {
    onUploadProgress: (p) => setUploadProgress(50 + p / 2),
  })

  const reset = () => {
    setStep('form')
    setTitle('')
    setAuthor('')
    setCategory('Programming')
    setBookFile(null)
    setCoverFile(null)
    setUploadProgress(0)
  }

  const handleClose = () => {
    if (step === 'uploading' || step === 'saving') return
    reset()
    onClose()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBookFile(file)
    if (!title) {
      const name = file.name.replace(/\.(pdf|epub|mobi)$/i, '').replace(/[-_]/g, ' ')
      setTitle(name.charAt(0).toUpperCase() + name.slice(1))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!bookFile || !title.trim()) {
      toast.error('Please provide a title and select a file')
      return
    }

    try {
      setStep('uploading')
      setUploadProgress(0)

      // Detect format
      const format = bookFile.name.toLowerCase().endsWith('.epub') ? 'EPUB' : 'PDF'

      // Upload book file
      const bookResult = await uploadBook([bookFile])
      if (!bookResult?.[0]) throw new Error('Book upload failed')
      const fileUrl = bookResult[0].url
      const fileKey = (bookResult[0] as any).key ?? ''

      // Upload cover if provided
      let coverUrl: string | null = null
      let coverKey: string | null = null
      if (coverFile) {
        const coverResult = await uploadCover([coverFile])
        if (coverResult?.[0]) {
          coverUrl = coverResult[0].url
          coverKey = (coverResult[0] as any).key ?? ''
        }
      }

      // Save to database
      setStep('saving')
      const res = await fetch('/api/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          author: author.trim() || null,
          fileUrl,
          fileKey,
          coverUrl,
          coverKey,
          format,
          category,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save book')
      }

      const book: LibraryFile = await res.json()
      toast.success(`"${book.title}" added to your library!`)
      reset()
      onClose()
      onSuccess(book)
    } catch (err: any) {
      toast.error(err.message || 'Upload failed. Please try again.')
      setStep('form')
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="relative w-full max-w-lg bg-bv-surface border border-bv-border rounded-2xl shadow-2xl shadow-black/60 overflow-hidden"
              initial={{ scale: 0.95, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 16 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-bv-border">
                <div>
                  <h2 className="font-semibold text-bv-text">Add to Library</h2>
                  <p className="text-xs text-bv-subtle mt-0.5">Upload a PDF or EPUB file</p>
                </div>
                <button
                  onClick={handleClose}
                  disabled={step !== 'form'}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-bv-subtle hover:text-bv-text hover:bg-bv-elevated transition-colors disabled:opacity-40"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Body */}
              <div className="p-6">
                {(step === 'uploading' || step === 'saving') ? (
                  <div className="py-8 flex flex-col items-center gap-6">
                    {/* Animated book icon */}
                    <div className="relative w-16 h-20 rounded-r-lg overflow-hidden border-l-4 border-amber-900 bg-gradient-to-br from-amber-950 to-orange-900">
                      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
                      <motion.div
                        className="absolute bottom-0 left-0 right-0 bg-bv-gold/30"
                        initial={{ height: 0 }}
                        animate={{ height: `${uploadProgress}%` }}
                        transition={{ ease: 'linear' }}
                      />
                    </div>

                    <div className="w-full max-w-xs">
                      <div className="flex justify-between text-xs text-bv-muted mb-2">
                        <span>{step === 'saving' ? 'Saving to library…' : 'Uploading file…'}</span>
                        <span>{Math.round(uploadProgress)}%</span>
                      </div>
                      <div className="h-1.5 bg-bv-border rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-bv-gold rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${step === 'saving' ? 100 : uploadProgress}%` }}
                          transition={{ ease: 'linear' }}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {/* File upload zone */}
                    <div>
                      <label className="block text-sm font-medium text-bv-muted mb-2">
                        Book file <span className="text-red-400">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => bookInputRef.current?.click()}
                        className={`w-full rounded-xl border-2 border-dashed py-6 px-4 flex flex-col items-center gap-2 transition-all duration-200 ${
                          bookFile
                            ? 'border-bv-gold/50 bg-bv-gold-subtle'
                            : 'border-bv-border hover:border-bv-border-light bg-bv-elevated hover:bg-bv-elevated/80'
                        }`}
                      >
                        {bookFile ? (
                          <>
                            <span className="text-bv-gold text-2xl">📄</span>
                            <span className="text-sm text-bv-gold font-medium truncate max-w-full">{bookFile.name}</span>
                            <span className="text-xs text-bv-muted">
                              {(bookFile.size / 1024 / 1024).toFixed(1)} MB
                            </span>
                          </>
                        ) : (
                          <>
                            <svg className="w-8 h-8 text-bv-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                            </svg>
                            <span className="text-sm text-bv-muted">Click to select PDF or EPUB</span>
                            <span className="text-xs text-bv-subtle">Up to 128 MB</span>
                          </>
                        )}
                      </button>
                      <input
                        ref={bookInputRef}
                        type="file"
                        accept=".pdf,.epub"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </div>

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
                        <label className="block text-xs font-medium text-bv-muted mb-1.5">
                          Author
                        </label>
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
                          <option key={c} value={c} className="bg-bv-elevated">
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Cover upload (optional) */}
                    <div>
                      <label className="block text-xs font-medium text-bv-muted mb-1.5">
                        Cover image <span className="text-bv-subtle">(optional)</span>
                      </label>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => coverInputRef.current?.click()}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-bv-border bg-bv-elevated text-sm text-bv-muted hover:text-bv-text hover:border-bv-border-light transition-all"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {coverFile ? 'Change cover' : 'Add cover'}
                        </button>
                        {coverFile && (
                          <span className="text-xs text-bv-muted truncate">{coverFile.name}</span>
                        )}
                      </div>
                      <input
                        ref={coverInputRef}
                        type="file"
                        accept="image/*"
                        onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
                        className="hidden"
                      />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={handleClose}
                        className="flex-1 py-2.5 rounded-xl border border-bv-border text-sm text-bv-muted hover:text-bv-text hover:bg-bv-elevated transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={!bookFile || !title.trim()}
                        className="flex-1 py-2.5 rounded-xl bg-bv-gold text-bv-bg font-semibold text-sm hover:bg-bv-gold-light disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-gold-sm hover:shadow-gold"
                      >
                        Upload Book
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
