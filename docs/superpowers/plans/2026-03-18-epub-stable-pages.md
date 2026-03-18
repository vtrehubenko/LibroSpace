# EPUB Stable Page Numbers Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fluctuating section-accumulation page counting with stable percentage-derived page numbers that never change during a reading session.

**Architecture:** epubjs's `book.locations.generate(1024)` creates fixed character-based location markers. The `relocated` event provides `percentage` derived from these locations. We derive `currentPage = ceil(percentage × totalLocations)` and `totalPages = totalLocations`. Since both values come from the same immutable location system, the total never fluctuates. All section-tracking refs (`sectionPagesRef`, `stableTotalRef`) and the `estimateSectionPages` helper are removed entirely. Font size and resize changes reflow visual pages but do NOT affect character-based locations, so no reset logic is needed.

**Tech Stack:** React, epubjs 0.3.93, TypeScript, Next.js 14

---

## File Structure

### Modified files

| File | Changes |
|------|---------|
| `components/EPUBViewer.tsx` | Remove `sectionPagesRef`, `stableTotalRef`, `estimateSectionPages`; replace relocated handler with percentage-derived pages; remove page-count resets from font size and resize handlers |
| `components/ReaderView.tsx` | No changes needed (already handles `epubTotal > 0` case) |

---

## Task 1: Replace section-accumulation page counting with percentage-derived pages

**Why:** The current approach estimates total pages by averaging known section page counts × total sections. Different sections have wildly different page counts (cover = 1, long chapter = 30), so the average shifts every time a new section is visited, causing total to fluctuate. The percentage from `book.locations.generate()` is computed once from character positions and never changes — it's the only stable source of truth in epubjs.

**Files:**
- Modify: `components/EPUBViewer.tsx`

- [ ] **Step 1: Remove section-tracking refs and helper**

Remove these three items from the component:

1. Remove the ref declarations (lines ~75-76):
```tsx
  const sectionPagesRef = useRef<Map<number, number>>(new Map()) // section index → total visual pages
  const stableTotalRef = useRef<number>(0) // stable total page count, set once
```

2. Remove the `estimateSectionPages` function (lines ~113-119):
```tsx
  // Estimate pages for an unvisited section based on average of known sections
  const estimateSectionPages = (targetIndex: number, currentIndex: number) => {
    if (sectionPagesRef.current.size === 0) return 1
    let sum = 0
    sectionPagesRef.current.forEach((count) => { sum += count })
    return Math.round(sum / sectionPagesRef.current.size)
  }
```

- [ ] **Step 2: Replace the relocated handler with percentage-derived page numbers**

Find the `relocated` handler inside the `loadBook` function and replace its entire body. The current handler (from `rendition.on('relocated'...` through the closing `})`) should be replaced with:

```tsx
        rendition.on('relocated', (location: any) => {
          if (!active) return

          const pct = location?.start?.percentage ?? 0
          const rounded = Math.round(pct * 100)
          setPercentage(rounded)
          calcReadingTime(rounded)

          // Derive stable page numbers from the locations system
          // totalLocations is fixed after book.locations.generate() — never changes
          const total = totalLocationsRef.current
          if (total > 0) {
            const current = Math.max(1, Math.ceil(pct * total))
            setCurrentPage(current)
            setTotalPages(total)
            onLocationChange?.(pct, current, total)
          } else {
            onLocationChange?.(pct, 0, 0)
          }
        })
```

- [ ] **Step 3: Remove page-count resets from font size effect**

Find the font size `useEffect` and remove the two lines that clear section page counts. Replace:

```tsx
  useEffect(() => {
    if (!renditionRef.current || loading) return
    try {
      renditionRef.current.themes.fontSize(`${fontSize}px`)
      // Font size reflows content — page counts are now stale
      sectionPagesRef.current.clear()
      stableTotalRef.current = 0
    } catch {}
  }, [fontSize, loading])
```

With:

```tsx
  useEffect(() => {
    if (!renditionRef.current || loading) return
    try {
      renditionRef.current.themes.fontSize(`${fontSize}px`)
    } catch {}
  }, [fontSize, loading])
```

**Why no reset needed:** Font size changes reflow visual pages but character-based locations (the source of our page numbers) are unaffected.

- [ ] **Step 4: Simplify the ResizeObserver handler**

Find the ResizeObserver block and remove the page-count reset lines. Replace:

```tsx
        observer = new ResizeObserver(([entry]) => {
          const { width: w, height: h } = entry.contentRect
          if (w && h) {
            try {
              const maxW = Math.min(Math.max(Math.floor(window.innerWidth * 0.5), 480), 900)
              renditionRef.current?.resize(Math.min(Math.floor(w), maxW), Math.floor(h))
              // Reset page counts — they change with new dimensions
              sectionPagesRef.current.clear()
              stableTotalRef.current = 0
              setTotalPages(0)
              setCurrentPage(0)
            } catch {}
          }
        })
```

With:

```tsx
        observer = new ResizeObserver(([entry]) => {
          const { width: w, height: h } = entry.contentRect
          if (w && h) {
            try {
              const maxW = Math.min(Math.max(Math.floor(window.innerWidth * 0.5), 480), 900)
              renditionRef.current?.resize(Math.min(Math.floor(w), maxW), Math.floor(h))
            } catch {}
          }
        })
```

**Why no reset needed:** Resize changes how many visual pages fit per section, but character-based locations are unaffected. The percentage from `relocated` (which fires after resize) will still be correct.

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

Expected: No errors (if there are errors about unused vars from removed refs, those indicate the refs weren't fully removed in step 1).

---

## Task 2: Verify full build

**Files:** None (verification only)

- [ ] **Step 1: Run TypeScript check**

Run: `npx tsc --noEmit --pretty`

Expected: No errors.

- [ ] **Step 2: Run build**

Run: `npm run build`

Expected: Build succeeds.

- [ ] **Step 3: Manual verification checklist**

1. Open an EPUB book — loads without visible spine-walking delay
2. Bottom bar shows `X / Y` where Y is stable (does NOT change as you navigate)
3. X increments smoothly (by 1 or small amounts) on each page turn
4. Change font size — page numbers remain stable (Y unchanged)
5. Resize window — page numbers remain stable (Y unchanged)
6. Close and reopen book — position is restored near where you left off
7. Reading time estimate shows in toolbar and decreases as you progress
