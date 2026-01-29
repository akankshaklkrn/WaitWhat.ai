'use client';

import IntroHero from './components/IntroHero';
import StickyHeader from './components/StickyHeader';
import LandingContent from './components/LandingContent';

export default function Page() {
  return (
    <main className="min-h-[200vh] bg-gradient-to-br from-[#0B1020] to-[#1E1B4B]">
      {/* Fixed header that appears on scroll */}
      <StickyHeader />

      {/* Section A: Full-height hero with big logo */}
      <section className="h-screen">
        <IntroHero />
      </section>

      {/* Section B: Content that appears after scroll */}
      <section className="min-h-screen pt-24">
        <div className="mx-auto max-w-6xl px-6 pb-24">
          <LandingContent />
        </div>
      </section>
    </main>
  );
}
