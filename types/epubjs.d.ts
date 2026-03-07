declare module 'epubjs' {
  interface Rendition {
    display(target?: string | number): Promise<void>
    prev(): void
    next(): void
    destroy(): void
    on(event: string, callback: (...args: any[]) => void): void
    off(event: string, callback?: (...args: any[]) => void): void
    themes: {
      register(name: string, styles: Record<string, any>): void
      select(name: string): void
      fontSize(size: string): void
    }
    currentLocation(): { start: { cfi: string; percentage: number } }
  }

  interface Book {
    renderTo(element: Element | HTMLElement, options?: Record<string, any>): Rendition
    destroy(): void
    ready: Promise<void>
    locations: {
      generate(chars: number): Promise<void>
      percentageFromCfi(cfi: string): number
    }
  }

  function Epub(url: string, options?: Record<string, any>): Book
  export default Epub
}
