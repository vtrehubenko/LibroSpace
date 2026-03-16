# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Commands

```bash
# Development
npm run dev         # Start dev server at localhost:3000

# Build & Production
npm run build
npm run start

# Linting
npm run lint

# Database (Prisma)
npx prisma migrate dev        # Run migrations in development
npx prisma migrate deploy     # Apply migrations in production
npx prisma studio             # Open Prisma Studio GUI
npx prisma generate           # Regenerate Prisma client after schema changes
```

---

## Environment Setup

Copy `.env.example` to `.env` and fill in:

- `DATABASE_URL` — PostgreSQL connection string
- `NEXTAUTH_SECRET` — generate with `openssl rand -base64 32`
- `NEXTAUTH_URL` — `http://localhost:3000` for local dev
- `UPLOADTHING_SECRET` / `UPLOADTHING_APP_ID` — from UploadThing dashboard

---

## Agent Rules

### 1. Plan Mode Default

Enter plan mode for any non-trivial task (3+ steps or architectural decisions)

If something goes sideways, STOP and re-plan immediately — don't keep pushing

Use plan mode for verification steps, not just building

Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy

Use subagents liberally to keep main context window clean

Offload research, exploration, and parallel analysis to subagents

For complex problems, throw more compute at it via subagents

One task per subagent for focused execution

### 3. Self-Improvement Loop

After ANY correction from the user: update tasks/lessons.md with the pattern

Write rules for yourself that prevent the same mistake

Ruthlessly iterate on these lessons until mistake rate drops

Review lessons at session start for the relevant project

### 4. Verification Before Done

Never mark a task complete without proving it works

Diff behavior between main and your changes when relevant

Ask yourself: "Would a staff engineer approve this?"

Run tests, check logs, demonstrate correctness

### 5. Demand Elegance (Balanced)

For non-trivial changes: pause and ask "Is there a more elegant way?"

If a fix feels hacky:
"Knowing everything I know now, implement the elegant solution."

Skip this for simple fixes — don't over-engineer

Challenge your own work before presenting it

### 6. Autonomous Bug Fixing

When given a bug report: just fix it. Don't ask for hand-holding

Point at logs, errors, failing tests — then resolve them

Zero context switching required from the user

Go fix failing CI tests without being told how

### Task Management

Plan First – Write plan to tasks/todo.md with checkable items

Verify Plan – Check in before starting implementation

Track Progress – Mark items complete as you go

Explain Changes – High-level summary at each step

Document Results – Add review section to tasks/todo.md

Capture Lessons – Update tasks/lessons.md after corrections

### Core Principles

**Simplicity First**
Make every change as simple as possible. Impact minimal code.

**No Laziness**
Find root causes. No temporary fixes. Senior developer standards.

**Minimal Impact**
Changes should only touch what's necessary. Avoid introducing bugs.

---

# LibroSpace — Landing Page Development Plan

This section defines the rules, architecture, and roadmap for developing the **LibroSpace landing page functionality**.

The landing page is not just a static marketing page. It is an **interactive product showcase** designed to demonstrate the main capabilities of the LibroSpace platform.

Current design is visually complete but many sections are **non-functional placeholders**. The goal of this phase is to implement meaningful interactions for each section.

Footer is not part of the current scope.

---

## 1. Project Overview

LibroSpace is a web-based digital library platform where users can:

- upload PDF and EPUB files
- organize books into a personal library
- read documents using a built-in reader
- track reading progress
- search and filter books

The landing page should act as:

- product homepage
- feature showcase
- guided demo of the platform
- entry point to the application

---

## 2. Tech Stack (Do Not Change)

Claude Code must follow this stack and not replace it unless explicitly instructed.

### Frontend

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Framer Motion

### Backend

- Prisma ORM
- PostgreSQL
- NextAuth

### Storage

- UploadThing

### Reader

- PDF Reader component
- EPUB Reader component

### UI

- Sonner (toasts)

---

## 3. Architecture Rules

Claude Code must follow these rules:

- do not rebuild existing design structure
- reuse existing components when possible
- avoid unnecessary dependencies
- prefer reusable components over large files
- separate UI logic, data logic, and server logic
- avoid mock logic when real reusable logic is possible
- landing interactions must produce meaningful behavior

---

## 4. Code Style Rules

Language: TypeScript

### Variables

Prefer:

```ts
const selectedBook;
const demoLibrary;
const activePreview;
```

Avoid:

```ts
let x;
let data1;
```

### Naming

**Components** — PascalCase:

```
LandingHero
BookshelfPreview
ReaderDemo
LibraryShowcase
```

**Functions / variables** — camelCase:

```
openBookPreview
handleBookClick
filterLibrary
```

**Constants** — `UPPER_CASE` only for true constants.

### Comments

Only explain **non-obvious logic**.

Good:

```ts
// Delay animation until section becomes visible
```

Bad:

```ts
// set books state
```

---

## 5. UX Rules

Every interactive element must do something meaningful.

**Allowed behaviors:**

- navigation
- scroll to section
- open preview
- simulate real feature behavior
- activate demo state

**Disallowed behaviors:**

- dead buttons
- fake interactions
- placeholder clicks without result

Landing page must feel like a guided product demo.

---

## 6. Landing Page Sections

Landing page contains the following sections:

- Hero Section
- Features Block
- Bookshelf Preview
- Reader Demo
- Library Showcase
- Footer _(not current scope)_

Each section must be interactive.

---

## 7. Hero Section

**Purpose:** First impression and main conversion point.

### Required elements

**Primary CTA:**

- Get Started
- Open Library

**Secondary CTA:**

- See Reader
- Explore Features

### Behavior

| State              | Action                        |
| ------------------ | ----------------------------- |
| User is logged out | Redirect to sign-up/auth page |
| User is logged in  | Open `/library`               |
| Secondary CTA      | Scroll to Reader Demo section |

---

## 8. Features Block

**Purpose:** Explain core features.

### Features shown

- Upload PDF / EPUB
- Organize personal library
- Continue reading with progress tracking
- Elegant reading interface
- Search and filter books

### Behavior

Clicking a feature card should:

- scroll to the corresponding section, OR
- activate demo state in the section below

**Example:** Click "Reader Experience" → scroll to Reader Demo

---

## 9. Bookshelf Preview

**Current state:** Books are clickable but meaningless placeholders.

**Goal:** Turn bookshelf into an interactive preview of the user's library.

### Required behavior

Clicking a book should:

- select the book
- open preview panel
- show metadata

Preview must include:

- title
- author
- format
- description
- reading progress
- CTA: "Open Reader Demo"

### Advanced behavior

Selected book should sync with the Reader Demo section.

---

## 10. Reader Demo Section

**Current state:** Visual placeholder only.

**Goal:** Provide an interactive preview of the LibroSpace reader.

### MVP behavior

Reader demo should allow:

- next page
- previous page
- progress indicator
- theme toggle
- font size adjustment (EPUB)

### Strategy

- **Option A** — Mock reader
- **Option B** — Real demo PDF/EPUB _(preferred if stable)_

### CTA

Reader demo must contain:

- "Create Your Library"
- "Upload Your First Book"

---

## 11. Library Showcase Section

**Purpose:** Demonstrate how the real library works.

Should simulate:

- search
- category filters
- author filters
- format filters
- sorting
- book grid

### Required interactions

| Action        | Result                               |
| ------------- | ------------------------------------ |
| Search input  | Filters books                        |
| Tag filter    | Filters books                        |
| Sorting       | Changes order                        |
| Clicking book | Preview panel or redirect to library |

**Important:** This section should feel identical to the real library interface.

---

## 12. Section Connectivity

Landing sections must interact with each other.

| Trigger              | Result                     |
| -------------------- | -------------------------- |
| Hero CTA             | Library page               |
| Feature card         | Scroll to relevant section |
| Bookshelf book click | Open Reader demo           |
| Reader demo CTA      | Sign Up / Library          |
| Library showcase CTA | Open full library          |

---

## 13. Demo Data Rules

Landing page should use a unified demo dataset.

**Location:** `lib/demoLibrary.ts`

Each demo book must include:

```ts
id;
title;
author;
format;
category;
cover;
description;
progress;
tags;
```

This dataset must be reused across:

- Bookshelf Preview
- Reader Demo
- Library Showcase

This ensures all sections stay consistent.

---

## 14. Landing Page Development Roadmap

### Phase 1 — CTA Foundation

**Goal:** Remove all dead buttons.

- implement hero button logic
- connect feature cards with sections
- implement scroll behavior
- implement auth-aware CTA

### Phase 2 — Bookshelf Preview

- create demo dataset
- implement book selection state
- add preview panel
- connect book preview with reader section

### Phase 3 — Reader Demo

- implement reader preview component
- add page navigation
- add progress UI
- add theme controls
- connect demo book with reader

### Phase 4 — Library Showcase

- searchable dataset
- filter system
- sorting system
- interactive book cards
- empty results state

### Phase 5 — UX Polish

- connect bookshelf with reader
- connect features with sections
- refine animations
- improve active states

---

## 15. Completion Criteria

Landing page is considered functional when:

- [ ] hero buttons work
- [ ] feature cards trigger real actions
- [ ] bookshelf preview opens book preview
- [ ] reader demo is interactive
- [ ] library showcase supports search/filter/sort
- [ ] sections feel connected

The landing page should feel like a live preview of the product, not a static design.
