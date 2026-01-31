import { Suspense } from 'react';
import ResultsClient from './ResultsClient';

export default function ResultsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen animated-gradient relative overflow-hidden text-white">
          <div className="max-w-7xl mx-auto px-8 pt-10 pb-16">
            <div className="text-white/70">Loading results…</div>
          </div>
        </div>
      }
    >
      <ResultsClient />
    </Suspense>
  );
}
