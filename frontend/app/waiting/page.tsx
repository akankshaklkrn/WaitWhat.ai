'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function WaitingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filename = searchParams.get('file') ?? searchParams.get('videoId');
  const intensity = searchParams.get('intensity') ?? '1';

  const [stage, setStage] = useState(0);
  const [done, setDone] = useState(false);
  const [useBoyImage, setUseBoyImage] = useState(true);

  const stages = useMemo(
    () => [
      { label: 'Watching your demo…', img: '/watchboy.png' },
      { label: 'Almost there…', img: '/angry.png' },
      { label: 'Double-checking details…', img: '/nervous.png' },
    ],
    []
  );

  useEffect(() => {
    if (done) return;
    const t = window.setInterval(() => {
      setStage((s) => (s + 1) % stages.length);
    }, 4000);
    return () => window.clearInterval(t);
  }, [done, stages.length]);

  return (
    <div className="min-h-screen animated-gradient relative overflow-hidden text-white">
      <section className="max-w-7xl mx-auto px-8 pt-14 pb-16">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors mb-10"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <div className="max-w-3xl mx-auto">
          <div className="bg-white/10 backdrop-blur-md rounded-3xl p-10 border border-white/20">
            <div className="flex flex-col items-center text-center">
              <div className="relative w-[220px] h-[220px] mb-7">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative w-[180px] h-[180px] aspect-square">
                    {useBoyImage ? (
                      <div className={`wait-bob boy-wrap ${done ? 'boy-happy' : stage === 2 ? 'boy-frustrated' : ''}`}>
                        <div className="boy-inner rounded-full overflow-hidden bg-white/5 border border-white/10">
                          <img
                            src={done ? '/happy.png' : stages[stage]?.img ?? '/watchboy.png'}
                            alt="Waiting character"
                            width={180}
                            height={180}
                            className="boy-img"
                            style={{ aspectRatio: '1/1' }}
                            onError={() => setUseBoyImage(false)}
                            draggable={false}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-full overflow-hidden bg-white/5 border border-white/10 p-4">
                        <svg className="w-full h-full text-white/60" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-sm text-gray-300">
                  Hang tight…
                </div>
              </div>

              <h1 className="text-3xl font-semibold tracking-tight mb-2">Analyzing your demo</h1>
              <p className="text-gray-300 mb-8">{done ? 'Done — opening results…' : stages[stage]?.label}</p>

              <div className="w-full max-w-xl">
                <div className="h-2 bg-white/10 rounded-full border border-white/10 overflow-hidden">
                  <div className="wait-progress h-full bg-white/25" />
                </div>
                <div className="mt-4 flex items-center justify-center text-xs text-gray-300">
                  <span className="text-center">Usually takes ~1–2 mins</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <style jsx global>{`
        .boy-wrap {
          position: relative;
          width: 180px;
          height: 180px;
          aspect-ratio: 1/1;
        }
        .boy-inner {
          position: relative;
          width: 100%;
          height: 100%;
          aspect-ratio: 1/1;
          mask-image: radial-gradient(white, black);
          -webkit-mask-image: radial-gradient(white, black);
        }
        .boy-img {
          width: 180px;
          height: 180px;
          aspect-ratio: 1/1;
          object-fit: cover;
          object-position: center;
          transform: scale(1.1);
        }
        @keyframes waitBob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        .wait-bob {
          animation: waitBob 2.2s ease-in-out infinite;
          will-change: transform;
        }
        @keyframes waitProgress {
          0% { transform: translateX(-65%); }
          100% { transform: translateX(125%); }
        }
        .wait-progress {
          width: 45%;
          border-radius: 999px;
          animation: waitProgress 1.4s ease-in-out infinite;
          will-change: transform;
        }
      `}</style>
    </div>
  );
}
