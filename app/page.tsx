import Navbar from '@/components/Navbar'
import HeroSection from '@/components/HeroSection'
import FeaturedShelf from '@/components/FeaturedShelf'
import FeaturesGrid from '@/components/FeaturesGrid'
import ReaderPreview from '@/components/ReaderPreview'
import LibraryDashboard from '@/components/LibraryDashboard'
import Footer from '@/components/Footer'

export default function Home() {
  return (
    <main className="min-h-screen bg-bv-bg overflow-x-hidden">
      <Navbar />
      <HeroSection />
      <FeaturedShelf />
      <FeaturesGrid />
      <ReaderPreview />
      <LibraryDashboard />
      <Footer />
    </main>
  )
}
