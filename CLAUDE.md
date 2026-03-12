# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

## Environment Setup

Copy `.env.example` to `.env` and fill in:
- `DATABASE_URL` — PostgreSQL connection string
- `NEXTAUTH_SECRET` — generate with `openssl rand -base64 32`
- `NEXTAUTH_URL` — `http://localhost:3000` for local dev
- `UPLOADTHING_SECRET` / `UPLOADTHING_APP_ID` — from UploadThing dashboard

## Architecture

**Next.js 14 App Router** with PostgreSQL (Prisma), NextAuth (credentials/JWT), and UploadThing for file storage.

### Data Flow

1. **Auth**: NextAuth credentials provider → bcrypt password check → JWT session with injected `userId`. Middleware at `middleware.ts` protects `/library/*` and `/reader/*` routes.

2. **File Uploads**: Two-step process — UploadThing handles the file (returns `fileUrl` + `fileKey`), then a separate POST to `/api/books` stores metadata in the DB.

3. **Library Page Pattern**: `app/library/page.tsx` fetches books server-side via `getServerSession` → passes as `initialBooks` prop to `LibraryClient` (client component that owns filter/search state).

### Key Directories

- `app/api/` — Route handlers: `auth/[...nextauth]`, `auth/signup`, `books/[id]`, `uploadthing`
- `components/` — Page-level components (`LibraryClient`, `ReaderView`, `UploadModal`) and feature components (`PDFViewer`, `EPUBViewer`, `BookCard`)
- `lib/` — `auth.ts` (NextAuth config), `prisma.ts` (singleton client), `uploadthing.ts` / `uploadthing-client.ts`
- `types/` — Augments NextAuth session/JWT types with `userId`; declares EPUB.js types

### Database Models

- **User**: id, email (unique), password (hashed), name, image
- **LibraryFile**: title, author, format (PDF/EPUB), fileUrl/fileKey, coverUrl/coverKey, category, readingProgress (0–100), currentPage, totalPages, isFavorite, lastOpenedAt — all linked to User with cascade delete

### Styling

Custom Tailwind dark theme (`tailwind.config.ts`): background `#0c0a08`, gold accent `#d4a853`, cream text `#f0ebe3`. Fonts: Inter (sans) + Playfair Display (serif). Framer Motion for animations, Sonner for toasts.

### PDF/EPUB Notes

`next.config.js` aliases `canvas` and `encoding` to `false` for browser compatibility with `pdfjs-dist`. EPUB rendering uses `epubjs`; custom type declarations are in `types/epubjs.d.ts`.
