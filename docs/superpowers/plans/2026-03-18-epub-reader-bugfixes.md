# EPUB Reader Bugfixes Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 8 bugs in the EPUB reader — page counting, position restore, reading time calculation, and dead UI elements.

**Architecture:** All changes are in two files: `components/EPUBViewer.tsx` (core reader) and `components/ReaderView.tsx` (wrapper). The page counting system is replaced from spine-walking to lazy accumulation. Position restore uses percentage-based display. Tasks are ordered so each produces a working reader.

**Tech Stack:** React, epubjs 0.3.93, TypeScript, Next.js 14

---

## File Structure

### Modified files

| File | Changes |
|------|---------|
| `components/EPUBViewer.tsx` | Remove spine-walking page count, add lazy page counting with estimation, fix reading time calc, add `initialPercentage` prop, reset page counts on font size change |
| `components/ReaderView.tsx` | Pass `initialPercentage` to EPUBViewer, remove bookmark button |

---

## Task 1: Remove spine-walking page count and suppress relocated during init

**Why:** The spine-walking loop (lines 183-204) calls `rendition.display()` for each section during load. This crashes on some screen sizes (spine.items undefined), fires `relocated` events that corrupt saved progress, and delays book loading.

**Files:**
- Modify: `components/EPUBViewer.tsx:183-234`

- [ ] **Step 1: Remove the spine-walking block and simplify initialization**

Replace lines 183-234 (from `// Count total visual pages` through the `relocated` handler) with:

```tsx
        // Display the book (no spine-walking — pages are counted lazily)
        await rendition.display()
        if (active) setLoading(false)

        // Track location changes using actual displayed pages
        rendition.on('relocated', (location: any) => {
          if (!active) return

          const pct = location?.start?.percentage ?? 0
          const rounded = Math.round(pct * 100)
          setPercentage(rounded)
          calcReadingTime(rounded)

          // Use epubjs displayed page info (visual pages per section)
          const sectionIndex = location?.start?.index ?? 0
          const displayedPage = location?.start?.displayed?.page ?? 1
          const displayedTotal = location?.start?.displayed?.total ?? 1

          // Record this section's visual page count
          sectionPagesRef.current.set(sectionIndex, displayedTotal)

          // Calculate absolute page: sum known sections + current
          let absolutePage = 0
          for (let i = 0; i < sectionIndex; i++) {
            absolutePage += sectionPagesRef.current.get(i) ?? estimateSectionPages(i, sectionIndex)
          }
          absolutePage += displayedPage

          // Estimate total from known data
          const knownSections = sectionPagesRef.current.size
          const totalSections = (bookRef.current as any)?.spine?.length ?? knownSections
          let estimatedTotal: number

          if (knownSections > 0 && totalSections > 0) {
            // Average pages per known section × total sections
            let knownPagesSum = 0
            sectionPagesRef.current.forEach((count) => { knownPagesSum += count })
            const avgPerSection = knownPagesSum / knownSections
            estimatedTotal = Math.round(avgPerSection * totalSections)
          } else {
            estimatedTotal = displayedTotal
          }

          // Lock total once we've seen enough sections (>25% of spine)
          if (stableTotalRef.current === 0 && knownSections >= Math.max(totalSections * 0.25, 2)) {
            stableTotalRef.current = estimatedTotal
          }

          const total = stableTotalRef.current || estimatedTotal
          setCurrentPage(absolutePage)
          setTotalPages(total)
          onLocationChange?.(pct, absolutePage, total)
        })
```

- [ ] **Step 2: Add the `estimateSectionPages` helper function**

Add this inside the `EPUBViewer` component, before the `useEffect` that loads the book (before line 110):

```tsx
  // Estimate pages for an unvisited section based on average of known sections
  const estimateSectionPages = (targetIndex: number, currentIndex: number) => {
    if (sectionPagesRef.current.size === 0) return 1
    let sum = 0
    sectionPagesRef.current.forEach((count) => { sum += count })
    return Math.round(sum / sectionPagesRef.current.size)
  }
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

Expected: No errors.

---

## Task 2: Reset page counts on font size change

**Why:** Changing font size reflows all content, changing the number of visual pages per section. The cached section page counts become stale.

**Files:**
- Modify: `components/EPUBViewer.tsx` (font size useEffect, around line 387)

- [ ] **Step 1: Add page count reset to the font size effect**

Find the font size `useEffect` and replace it with:

```tsx
  // Font size changes
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

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

Expected: No errors.

---

## Task 3: Fix resize handler to also reset stable total display

**Why:** The resize handler already clears `sectionPagesRef` and `stableTotalRef`, but `totalPages` state still shows the old value until enough sections are revisited. Reset the state too so the UI falls back to percentage until new data is available.

**Files:**
- Modify: `components/EPUBViewer.tsx` (ResizeObserver block)

- [ ] **Step 1: Add `setTotalPages(0)` to the resize handler**

Find the ResizeObserver block and replace it with:

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

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

Expected: No errors.

---

## Task 4: Add saved position restore

**Why:** The EPUB reader always starts at page 1, losing the user's reading position. The `LibraryFile` model has `readingProgress` (0-100) which can be converted to a percentage for `rendition.display()`.

**Files:**
- Modify: `components/EPUBViewer.tsx` (props interface + display call)
- Modify: `components/ReaderView.tsx` (pass initial position)

- [ ] **Step 1: Add `initialPercentage` prop to EPUBViewerProps**

Update the interface:

```tsx
interface EPUBViewerProps {
  url: string
  bookId: string
  theme: 'dark' | 'sepia' | 'light'
  fontSize?: number
  initialPercentage?: number
  onLocationChange?: (percentage: number, currentPage: number, totalPages: number) => void
  onProgressUpdate?: (info: { percentage: number; estimatedMinutesLeft: number }) => void
}
```

And add `initialPercentage` to the destructured props:

```tsx
export default function EPUBViewer({
  url,
  bookId,
  theme,
  fontSize = 16,
  initialPercentage,
  onLocationChange,
  onProgressUpdate,
}: EPUBViewerProps) {
```

- [ ] **Step 2: Use `initialPercentage` to restore position after load**

Find the `await rendition.display()` line (the one that shows the book after load) and replace it:

```tsx
        // Display at saved position or beginning
        if (initialPercentage && initialPercentage > 0 && initialPercentage < 1) {
          const cfi = book.locations?.cfiFromPercentage?.(initialPercentage)
          if (cfi) {
            await rendition.display(cfi)
          } else {
            await rendition.display()
          }
        } else {
          await rendition.display()
        }
        if (active) setLoading(false)
```

**Important:** This requires locations to be generated first. Move the `book.locations.generate()` call to BEFORE the display, and await it:

Find the locations generation block and move it before the display call. Replace:

```tsx
        // Generate locations for reading time calculation
        book.locations.generate(1024).then(() => {
          if (!active) return
          locationsReadyRef.current = true
          totalLocationsRef.current = (book.locations as any).length()
        })
```

With (placed BEFORE the display call):

```tsx
        // Generate locations (needed for position restore and reading time)
        try {
          await book.locations.generate(1024)
          if (!active) return
          locationsReadyRef.current = true
          totalLocationsRef.current = (book.locations as any).length()
        } catch {
          // Locations failed — book still works, just no position restore
        }
```

- [ ] **Step 3: Pass `initialPercentage` from ReaderView**

In `components/ReaderView.tsx`, update the EPUBViewer usage:

```tsx
          <EPUBViewer
            url={book.fileUrl}
            bookId={book.id}
            theme={theme}
            fontSize={fontSize}
            initialPercentage={book.readingProgress ? book.readingProgress / 100 : undefined}
            onLocationChange={(pct, epubPage, epubTotal) => {
              if (epubTotal > 0) {
                handlePageChange(epubPage, epubTotal)
              } else {
                const syntheticPage = Math.round(pct * 1000)
                handlePageChange(syntheticPage, 1000)
              }
            }}
            onProgressUpdate={setReaderProgress}
          />
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

Expected: No errors.

---

## Task 5: Remove non-functional bookmark button

**Why:** The bookmark button in ReaderView toggles a local boolean and shows a toast but never persists. It misleads users into thinking their bookmarks are saved.

**Files:**
- Modify: `components/ReaderView.tsx`

- [ ] **Step 1: Remove bookmark state and handler**

Remove these lines:

```tsx
  const [bookmarked, setBookmarked] = useState(false)
```

```tsx
  const handleBookmark = () => {
    setBookmarked((b) => !b)
    toast.success(bookmarked ? 'Bookmark removed' : `Page ${page} bookmarked`)
  }
```

- [ ] **Step 2: Remove bookmark button from JSX**

Remove the entire bookmark button block (the `{/* Bookmark */}` comment and the `<button>` that follows it).

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

Expected: No errors.

---

## Task 6: Fix reading time calculation

**Why:** The current formula `totalWords = (locations * 1024) / 5` treats each location's 1024 characters as pure text, but locations include HTML markup. This overestimates word count by ~40%.

**Files:**
- Modify: `components/EPUBViewer.tsx` (calcReadingTime function)

- [ ] **Step 1: Apply markup discount factor**

Replace the `calcReadingTime` callback:

```tsx
  const calcReadingTime = useCallback(
    (pct: number) => {
      if (!locationsReadyRef.current || totalLocationsRef.current === 0) return
      // Each location ≈ 1024 chars, but ~40% is HTML markup
      // Effective text chars ≈ 1024 * 0.6 = ~614 chars ≈ ~123 words per location
      const totalWords = (totalLocationsRef.current * 1024 * 0.6) / 5
      const totalMinutes = totalWords / 250
      const minutesLeft = Math.max(0, Math.round(totalMinutes * (1 - pct / 100)))
      onProgressUpdate?.({ percentage: pct, estimatedMinutesLeft: minutesLeft })
    },
    [onProgressUpdate]
  )
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

Expected: No errors.

---

## Task 7: Verify full build

**Files:** None (verification only)

- [ ] **Step 1: Run TypeScript check**

Run: `npx tsc --noEmit --pretty`

Expected: No errors.

- [ ] **Step 2: Run build**

Run: `npm run build`

Expected: Build succeeds.

- [ ] **Step 3: Manual verification checklist**

1. Open an EPUB book — loads without error, no spine-walking delay
2. Page counter shows `X / Y` after navigating a few pages
3. Total pages stabilizes and doesn't fluctuate wildly
4. Change font size — page count resets and rebuilds
5. Resize window — page count resets and rebuilds
6. Close and reopen the book — position is restored
7. Reading time estimate shows in toolbar
8. No bookmark button visible
