'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}

const features = [
  {
    icon: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    title: 'PDF & EPUB Support',
    description:
      'Native rendering for PDF, EPUB, MOBI, and more. Every format opens beautifully with correct typography and layout.',
    accent: '#f59e0b',
    bg: '#1a1200',
    scrollTarget: 'reader',
  },
  {
    icon: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
      </svg>
    ),
    title: 'Categories & Tags',
    description:
      'Organize your entire library with custom categories, color-coded tags, and nested collections. Find any book instantly.',
    accent: '#a78bfa',
    bg: '#0e0018',
    scrollTarget: 'library',
  },
  {
    icon: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
    title: 'Favorites & Progress',
    description:
      'Bookmark any page, highlight passages, and track your reading progress across every book automatically.',
    accent: '#f87171',
    bg: '#180a0a',
    scrollTarget: 'shelf',
  },
  {
    icon: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: 'Recently Opened',
    description:
      'Jump straight back into your last session. Recently opened files are always a single click away.',
    accent: '#22d3ee',
    bg: '#001418',
    scrollTarget: 'library',
  },
  {
    icon: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
      </svg>
    ),
    title: 'Reading Mode',
    description:
      'Distraction-free reading with customizable fonts, line spacing, sepia, dark, and night modes for every environment.',
    accent: '#34d399',
    bg: '#001810',
    scrollTarget: 'reader',
  },
  {
    icon: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
    title: 'Smart Search',
    description:
      'Full-text search across your entire library. Find any passage, annotation, or document in milliseconds.',
    accent: '#60a5fa',
    bg: '#071828',
    scrollTarget: 'library',
  },
]

export default function FeaturesGrid() {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.1, delayChildren: 0.15 } },
  }

  const cardVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
    },
  }

  return (
    <section id="features" className="relative py-24 lg:py-36 bg-bv-surface">
      {/* Gradient fade top */}
      <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-bv-bg to-transparent pointer-events-none" />
      <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-bv-bg to-transparent pointer-events-none" />

      <div ref={ref} className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center max-w-2xl mx-auto mb-16 lg:mb-20"
        >
          <p className="text-bv-gold text-xs font-semibold tracking-[0.15em] uppercase mb-3">
            Everything you need
          </p>
          <h2 className="font-serif font-bold text-3xl lg:text-5xl leading-tight mb-4">
            Crafted for readers
          </h2>
          <p className="text-bv-muted text-lg leading-relaxed">
            Every feature designed around a seamless reading experience. No clutter, no distractions.
          </p>
        </motion.div>

        {/* Features grid */}
        <motion.div
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5"
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
        >
          {features.map((feature, i) => (
            <motion.div key={i} variants={cardVariants}>
              <FeatureCard
                feature={feature}
                onClick={() => scrollToSection(feature.scrollTarget)}
              />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

function FeatureCard({
  feature,
  onClick,
}: {
  feature: (typeof features)[0]
  onClick: () => void
}) {
  return (
    <motion.div
      onClick={onClick}
      className="group relative p-6 rounded-2xl border border-bv-border bg-bv-elevated cursor-pointer overflow-hidden"
      whileHover={{ y: -4, borderColor: `${feature.accent}40` }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      {/* Hover glow */}
      <motion.div
        className="absolute inset-0 rounded-2xl pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 30% 50%, ${feature.accent}08 0%, transparent 60%)`,
        }}
        initial={{ opacity: 0 }}
        whileHover={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      />

      {/* Icon container */}
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 border"
        style={{
          background: feature.bg,
          borderColor: `${feature.accent}25`,
          color: feature.accent,
        }}
      >
        {feature.icon}
      </div>

      {/* Text */}
      <h3 className="font-semibold text-base text-bv-text mb-2 group-hover:text-white transition-colors duration-200">
        {feature.title}
      </h3>
      <p className="text-bv-muted text-sm leading-relaxed">{feature.description}</p>

      {/* Scroll hint — fades in on hover */}
      <motion.div
        className="flex items-center gap-1 mt-3 text-xs font-medium"
        style={{ color: feature.accent }}
        initial={{ opacity: 0, y: 4 }}
        whileHover={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        See it in action
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </motion.div>

      {/* Bottom accent line on hover */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${feature.accent}50, transparent)` }}
        initial={{ opacity: 0, scaleX: 0 }}
        whileHover={{ opacity: 1, scaleX: 1 }}
        transition={{ duration: 0.4 }}
      />
    </motion.div>
  )
}
