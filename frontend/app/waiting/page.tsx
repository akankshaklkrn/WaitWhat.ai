import { Suspense } from 'react';
import WaitingClient from './WaitingClient';

export default function WaitingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen animated-gradient relative overflow-hidden text-white">
          <section className="max-w-7xl mx-auto px-8 pt-14 pb-16">
            <div className="text-white/70">Loading…</div>
          </section>
        </div>
      }
    >
      <WaitingClient />
    </Suspense>
  );
}
