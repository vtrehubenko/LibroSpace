export type DemoBook = {
  id: number
  title: string
  author: string
  format: 'PDF' | 'EPUB'
  category: string
  description: string
  progress: number
  pages: number
  tags: string[]
  size: string
  added: string
  // Cover gradient
  from: string
  to: string
  spine: string
  accent: string
}

export const demoLibrary: DemoBook[] = [
  {
    id: 1,
    title: 'The Call of the Wild',
    author: 'Jack London',
    format: 'PDF',
    category: 'Adventure',
    description:
      'A gripping tale of a domesticated dog thrust into the brutal Yukon wilderness during the Gold Rush, where primal instincts awaken and the call of nature becomes irresistible.',
    progress: 68,
    pages: 232,
    tags: ['adventure', 'nature', 'classic'],
    size: '4.2 MB',
    added: '2 days ago',
    from: '#1a1008',
    to: '#302010',
    spine: '#0e0804',
    accent: '#d4a853',
  },
  {
    id: 2,
    title: 'The Hound of the Baskervilles',
    author: 'Arthur Conan Doyle',
    format: 'EPUB',
    category: 'Mystery',
    description:
      'Sherlock Holmes investigates a legendary curse on the Baskerville family, as a spectral hound haunts the misty moors of Devonshire in this masterpiece of detective fiction.',
    progress: 100,
    pages: 256,
    tags: ['mystery', 'detective', 'classic'],
    size: '3.8 MB',
    added: '1 week ago',
    from: '#0c1420',
    to: '#182838',
    spine: '#060a10',
    accent: '#60a5fa',
  },
  {
    id: 3,
    title: 'The Master and Margarita',
    author: 'Mikhail Bulgakov',
    format: 'PDF',
    category: 'Russian Literature',
    description:
      'A dazzling satire interweaving the Devil\'s visit to Soviet Moscow with Pontius Pilate\'s encounter with Christ — a novel of love, art, and the eternal struggle between good and evil.',
    progress: 45,
    pages: 412,
    tags: ['russian', 'satire', 'classic'],
    size: '6.1 MB',
    added: '3 days ago',
    from: '#200810',
    to: '#3a1020',
    spine: '#140408',
    accent: '#f87171',
  },
  {
    id: 4,
    title: 'Crime and Punishment',
    author: 'Fyodor Dostoevsky',
    format: 'EPUB',
    category: 'Russian Literature',
    description:
      'A young intellectual commits a terrible crime and descends into psychological torment, exploring guilt, redemption, and the limits of human reason in tsarist St. Petersburg.',
    progress: 90,
    pages: 671,
    tags: ['russian', 'psychological', 'classic'],
    size: '8.4 MB',
    added: 'Today',
    from: '#0e0020',
    to: '#1a0038',
    spine: '#080014',
    accent: '#a78bfa',
  },
  {
    id: 5,
    title: 'Pride and Prejudice',
    author: 'Jane Austen',
    format: 'EPUB',
    category: 'Romance',
    description:
      'The spirited Elizabeth Bennet navigates society, family, and her own stubborn pride as she discovers that first impressions can be dangerously misleading.',
    progress: 22,
    pages: 432,
    tags: ['romance', 'society', 'classic'],
    size: '5.2 MB',
    added: '5 days ago',
    from: '#001810',
    to: '#002e1e',
    spine: '#000e08',
    accent: '#34d399',
  },
  {
    id: 6,
    title: 'The Picture of Dorian Gray',
    author: 'Oscar Wilde',
    format: 'PDF',
    category: 'Gothic',
    description:
      'A beautiful young man sells his soul for eternal youth while his portrait ages and records every sin — a haunting exploration of vanity, corruption, and aestheticism.',
    progress: 12,
    pages: 254,
    tags: ['gothic', 'philosophical', 'classic'],
    size: '3.9 MB',
    added: '1 week ago',
    from: '#001424',
    to: '#002040',
    spine: '#000a14',
    accent: '#22d3ee',
  },
  {
    id: 7,
    title: 'Anna Karenina',
    author: 'Leo Tolstoy',
    format: 'EPUB',
    category: 'Russian Literature',
    description:
      'A tragic love affair unfolds against the backdrop of Russian high society, weaving together themes of passion, family, faith, and the search for meaning in life.',
    progress: 55,
    pages: 864,
    tags: ['russian', 'romance', 'classic'],
    size: '9.8 MB',
    added: '2 weeks ago',
    from: '#1a0808',
    to: '#300a0a',
    spine: '#0e0404',
    accent: '#fb923c',
  },
  {
    id: 8,
    title: 'The Great Gatsby',
    author: 'F. Scott Fitzgerald',
    format: 'PDF',
    category: 'Fiction',
    description:
      'In the glittering Jazz Age, the mysterious Jay Gatsby pursues an impossible dream across Long Island, revealing the hollowness behind the American promise of reinvention.',
    progress: 80,
    pages: 180,
    tags: ['fiction', 'american', 'classic'],
    size: '3.1 MB',
    added: '3 weeks ago',
    from: '#001418',
    to: '#002028',
    spine: '#000c10',
    accent: '#67e8f9',
  },
]
