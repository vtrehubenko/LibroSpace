#LibroSpace#

LibroSpace is a modern platform for reading books and discovering new stories through community and personalization.
The project combines an online reader, personal library, and social network for readers in one ecosystem.
The goal of LibroSpace is to create a space where people can:
read books
organize their personal libraries
discover new authors
share recommendations
interact with other readers
LibroSpace is inspired by platforms like Goodreads but aims to build a more modern, social, and interactive reading experience.

#Vision#

Most existing book platforms suffer from several problems:
outdated user experience
weak recommendation systems
limited social interaction
inconvenient reading interfaces
LibroSpace aims to solve these issues by combining:

- a modern reading experience
- intelligent recommendations
- social interaction between readers
- gamification elements that encourage reading

#Tech Stack#

@Frontend@
- Next.js (App Router)
- React
- TypeScript
- Tailwind CSS
- Framer Motion

@Backend@
- Next.js API Routes
- Prisma ORM
- PostgreSQL / Neon
- Authentication
- NextAuth
- External APIs
- Google Books API

#Core Features#

@Personal Library@
- Users can create and manage their own library.
-Features include:
  -adding books, done
  -organizing books into shelves, done
  -tracking reading progress, done
-Reading statuses:
  -Want to Read
  -Currently Reading
  -Finished

@Online Reader@
- LibroSpace includes a built-in reader that allows users to read books directly in the browser.
 Planned features:
  - bookmarks, done
  - highlights, done 
  - notes
  - progress tracking, done
  - customizable reading interface,  done

@Book Discovery@
- Users can discover books through:
 - search powered by Google Books API
 - curated recommendations
 - community activity

@User Profiles@
- Every user has a public profile containing:
  - username
  - avatar
  - bio
- Reading statistics
  - Example stats:
  - books finished
  - pages read
  - reading streak

@Social Features@
LibroSpace includes social functionality that allows users to interact with each other.
- Users can:
 - follow other readers
 - see activity updates
 - share books and recommendations
 - discover what others are reading
- Example activity feed:
 - Vova finished "Dune"
 - Anna added 3 books to Science shelf
 - Mark started reading "Atomic Habits"

@Recommendation System@
Future versions of LibroSpace will include personalized recommendations based on:
- reading history
- favorite genres
- onboarding quiz results
- community behavior

@Gamification@
To encourage consistent reading, the platform will include gamification elements such as:
 - reader levels
 - achievements
 - reading streaks
 - badges
-Example achievements:
🏆 10 books finished
🔥 7-day reading streak
📚 genre explorer

#Roadmap#

@Phase 1 — Foundation, done@

Landing page, done
Authentication, done
Personal library, done
Book search (Google Books API)
Basic reader functionality, done

@Phase 2 — Social Layer@

User profiles, done
Follow system, done
Activity feed, done
Public shelves, done

@Phase 3 — Community@

Book reviews
Ratings
Quotes
Discussion threads

@Phase 4 — Creator Platform@

Upload books
Author profiles
Publishing original works
Support for independent writers

#Long-Term Goal#

LibroSpace aims to become:
A modern social ecosystem for readers and writers.
Not just a tool for tracking books —
but a place where people discover stories, ideas, and new authors.
