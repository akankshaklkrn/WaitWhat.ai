'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

type Issue = {
  id: string;
  type: 'warning' | 'error' | 'success';
  title: string;
  description: string;
  timestamp: string;
};

function makeAnalysisStorageKey(filename: string) {
  return `analysis:${filename}`;
}

function makeContextStorageKey(videoId: string) {
  return `context:${videoId}`;
}

type PresentationContext = {
  mode?: string;
  audience?: string;
  goal?: string;
  one_liner?: string;
  target_user?: string;
  tone_preference?: string;
  success_metrics?: string[];
  domain?: string;
  time_limit?: string;
};

export default function WaitingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filename = searchParams.get('file') ?? searchParams.get('videoId');
  const intensity = searchParams.get('intensity') ?? '1';

  /**
   * Cache-buster for refreshed PNGs.
   * IMPORTANT: must be stable during SSR + hydration to avoid mismatches.
   * - If NEXT_PUBLIC_ASSET_VERSION is set, we use it (stable).
   * - Otherwise we start with "1" (stable), then switch to Date.now() after mount (client-only).
   */
  const [assetV, setAssetV] = useState(() => process.env.NEXT_PUBLIC_ASSET_VERSION ?? '1');

  const [stage, setStage] = useState(0);
  const [done, setDone] = useState(false);
  const [context, setContext] = useState<PresentationContext | null>(null);
  const stages = useMemo(
    () => [
      { label: 'Watching your demo…', img: '/watchboy.png' }, // waiting
      { label: 'Almost there…', img: '/angry.png' }, // frustrated/angry
      { label: 'Double-checking details…', img: '/nervous.png' }, // nervous
    ],
    []
  );

  useEffect(() => {
    // If no explicit version is set, bust cache after mount (safe: happens post-hydration).
    if (!process.env.NEXT_PUBLIC_ASSET_VERSION) {
      setAssetV(String(Date.now()));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!filename) {
      setContext(null);
      return;
    }
    try {
      const raw = sessionStorage.getItem(makeContextStorageKey(filename));
      setContext(raw ? (JSON.parse(raw) as PresentationContext) : null);
    } catch {
      setContext(null);
    }
  }, [filename]);

  useEffect(() => {
    if (done) return;
    const t = window.setInterval(() => {
      setStage((s) => (s + 1) % stages.length);
    }, 4000);
    return () => window.clearInterval(t);
  }, [done, stages.length]);

  const tips = useMemo(() => {
    const list: string[] = [
      'Heatmap highlights the most problematic moments in your talk.',
      'You’ll get a rephrased pitch / suggested rewrite for unclear parts.',
      'You can change intensity later — the analysis stays the same, only the wording changes.',
      'Click any issue in Results to jump to that exact moment in the video.',
      'We prioritize clarity first: what’s confusing, why it matters, and exactly how to fix it.',
    ];

    const bits: string[] = [];
    if (context?.mode) bits.push(context.mode);
    if (context?.audience) bits.push(`for ${context.audience}`);
    if (context?.goal) bits.push(`goal: ${context.goal}`);
    if (bits.length) {
      list.unshift(`Using your context (${bits.join(' • ')}) to tailor the feedback.`);
    }
    return list;
  }, [context?.audience, context?.goal, context?.mode]);

  const [tipIndex, setTipIndex] = useState(0);
  useEffect(() => {
    setTipIndex(0);
  }, [tips.length]);

  useEffect(() => {
    if (done) return;
    if (tips.length <= 1) return;
    let cancelled = false;
    let t: number | null = null;

    const schedule = () => {
      const ms = 10_000 + Math.floor(Math.random() * 2_001); // 10–12s
      t = window.setTimeout(() => {
        if (cancelled) return;
        setTipIndex((i) => (i + 1) % tips.length);
        schedule();
      }, ms);
    };

    schedule();
    return () => {
      cancelled = true;
      if (t) window.clearTimeout(t);
    };
  }, [done, tips.length]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!filename) return;

      try {
        // 1) Poll transcript until available
        const maxWaitMs = 2 * 60 * 1000; // UI says ~1–2 mins
        const start = Date.now();
        while (Date.now() - start < maxWaitMs) {
          const tRes = await fetch(`/api/transcript/${encodeURIComponent(filename)}`, { cache: 'no-store' });
          if (tRes.status === 200) break;
          if (tRes.status !== 409) {
            // Not ready is expected (409). Any other error -> stop polling and try analyze anyway.
            break;
          }
          await new Promise((r) => setTimeout(r, 2000));
        }

        // 2) Analyze (backend does transcript+LLM)
        const contextRaw = (() => {
          try {
            return filename ? sessionStorage.getItem(makeContextStorageKey(filename)) : null;
          } catch {
            return null;
          }
        })();
        const context = (() => {
          if (!contextRaw) return undefined;
          try {
            return JSON.parse(contextRaw) as unknown;
          } catch {
            return undefined;
          }
        })();

        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ video_id: filename, ...(context ? { context } : {}) }),
        });

        const data = (await res.json()) as { success: boolean; analysis?: unknown };
        if (!data?.success || !data.analysis) throw new Error('Analyze failed');
        if (cancelled) return;

        // Store the full backend AnalysisResponse for results page
        sessionStorage.setItem(makeAnalysisStorageKey(filename), JSON.stringify(data.analysis));
        setDone(true);
        // Small beat so the "happy" state is visible before redirect.
        window.setTimeout(() => {
          if (cancelled) return;
          router.replace(`/results?file=${encodeURIComponent(filename)}&intensity=${encodeURIComponent(intensity)}`);
        }, 900);
      } catch {
        // Fallback: still go to results; results page can try again.
        if (cancelled) return;
        router.replace(`/results?file=${encodeURIComponent(filename)}&intensity=${encodeURIComponent(intensity)}`);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [filename, intensity, router]);

  const [useBoyImage, setUseBoyImage] = useState(true);
  const boySrcRaw = done ? '/happy.png' : stages[stage]?.img ?? '/watchboy.png';
  const boySrc = `${boySrcRaw}?v=${assetV}`;
  const mood: 'neutral' | 'frustrated' | 'happy' = done ? 'happy' : stage === 1 ? 'frustrated' : 'neutral';

  // Make the sequence feel like a single "gif": crossfade between frames.
  const [currentSrc, setCurrentSrc] = useState<string>(boySrc);
  const [nextSrc, setNextSrc] = useState<string | null>(null);
  const [nextVisible, setNextVisible] = useState(false);

  useEffect(() => {
    // Preload all frames so swaps are instant.
    const frames = ['/watchboy.png', '/angry.png', '/nervous.png', '/happy.png'].map((s) => `${s}?v=${assetV}`);
    frames.forEach((src) => {
      const img = new window.Image();
      img.src = src;
    });
  }, [assetV]);

  useEffect(() => {
    if (boySrc === currentSrc) return;
    setNextSrc(boySrc);
    setNextVisible(false);
    // Trigger opacity transition on the next frame without ever hiding the current frame.
    const raf = window.requestAnimationFrame(() => setNextVisible(true));
    const t = window.setTimeout(() => {
      setCurrentSrc(boySrc);
      setNextSrc(null);
      setNextVisible(false);
    }, 220);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(t);
    };
  }, [boySrc, currentSrc]);

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
                  {useBoyImage ? (
                    <div
                      className={`wait-bob boy-wrap ${done ? 'boy-happy' : stage === 2 ? 'boy-frustrated' : ''}`}
                      style={
                        {
                          // Tune these if you want tighter "continuous gif" alignment across frames.
                          // (Try small px nudges: --boy-y: 6px, --boy-x: -2px, etc.)
                          ['--boy-scale' as any]: 1.14,
                          ['--boy-x' as any]: '0px',
                          ['--boy-y' as any]: '6px',
                          ['--boy-pos' as any]: '50% 35%',
                        } as React.CSSProperties
                      }
                    >
                      <div className="boy-stack">
                        <img
                          src={currentSrc}
                          alt="Waiting boy"
                          width={180}
                          height={180}
                          className="boy-img boy-frame boy-current"
                          onError={() => setUseBoyImage(false)}
                          draggable={false}
                        />
                        {nextSrc && (
                          <img
                            src={nextSrc}
                            alt="Waiting boy"
                            width={180}
                            height={180}
                            className={`boy-img boy-frame boy-next ${nextVisible ? 'boy-next--show' : ''}`}
                            onError={() => setUseBoyImage(false)}
                            draggable={false}
                          />
                        )}
                      </div>
                    </div>
                  ) : (
                    <svg
                      className="wait-bob"
                      width="180"
                      height="180"
                      viewBox="0 0 180 180"
                      role="img"
                      aria-label="Cute character waiting"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                    <defs>
                      <linearGradient id="shirt" x1="40" y1="70" x2="140" y2="140" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#60A5FA" />
                        <stop offset="0.6" stopColor="#7C3AED" />
                        <stop offset="1" stopColor="#EC4899" />
                      </linearGradient>
                      <linearGradient id="bench" x1="20" y1="140" x2="160" y2="160" gradientUnits="userSpaceOnUse">
                        <stop stopColor="rgba(255,255,255,0.10)" />
                        <stop offset="1" stopColor="rgba(255,255,255,0.06)" />
                      </linearGradient>
                    </defs>

                    {/* Bench */}
                    <rect x="28" y="132" width="124" height="14" rx="7" fill="url(#bench)" stroke="rgba(255,255,255,0.12)" />
                    <rect x="40" y="146" width="10" height="18" rx="5" fill="rgba(255,255,255,0.08)" />
                    <rect x="130" y="146" width="10" height="18" rx="5" fill="rgba(255,255,255,0.08)" />

                    {/* Body */}
                    <path
                      d="M62 120c0-22 12-38 28-38s28 16 28 38v12H62v-12z"
                      fill="url(#shirt)"
                      opacity="0.95"
                    />
                    <path d="M66 130h48" stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeLinecap="round" />

                    {/* Head */}
                    <circle cx="90" cy="62" r="26" fill="rgba(255,255,255,0.92)" />
                    {/* Hair */}
                    <path
                      d="M64 58c4-14 14-22 26-22s22 8 26 22c-6-7-16-10-26-10s-20 3-26 10z"
                      fill="rgba(0,0,0,0.92)"
                    />

                    {/* Face: eyes */}
                    <g className="wait-blink">
                      <circle cx="80" cy="66" r="2.2" fill="rgba(15,23,42,0.8)" />
                      <circle cx="100" cy="66" r="2.2" fill="rgba(15,23,42,0.8)" />
                    </g>

                    {/* Eyebrows + mouth (mood) */}
                    {mood === 'frustrated' ? (
                      <>
                        <path
                          d="M75 60l10 3"
                          stroke="rgba(15,23,42,0.7)"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />
                        <path
                          d="M105 60l-10 3"
                          stroke="rgba(15,23,42,0.7)"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />
                        <path
                          d="M82 80c3-3 13-3 16 0"
                          stroke="rgba(15,23,42,0.65)"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          fill="none"
                        />
                        {/* tiny stress mark */}
                        <path
                          d="M112 72c4-2 4-6 0-8"
                          stroke="rgba(255,255,255,0.35)"
                          strokeWidth="2"
                          strokeLinecap="round"
                          fill="none"
                        />
                      </>
                    ) : mood === 'happy' ? (
                      <>
                        <path
                          d="M75 60l10-2"
                          stroke="rgba(15,23,42,0.6)"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />
                        <path
                          d="M105 60l-10-2"
                          stroke="rgba(15,23,42,0.6)"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />
                        <path
                          d="M82 77c3 4 13 4 16 0"
                          stroke="rgba(15,23,42,0.65)"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          fill="none"
                        />
                        {/* sparkle */}
                        <path
                          d="M122 56l2 5l5 2l-5 2l-2 5l-2-5l-5-2l5-2l2-5z"
                          fill="rgba(255,255,255,0.35)"
                        />
                      </>
                    ) : (
                      <>
                        <path
                          d="M75 60h10"
                          stroke="rgba(15,23,42,0.55)"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />
                        <path
                          d="M95 60h10"
                          stroke="rgba(15,23,42,0.55)"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />
                        <path
                          d="M83 77c3 3 11 3 14 0"
                          stroke="rgba(15,23,42,0.65)"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          fill="none"
                        />
                      </>
                    )}

                    {/* Left arm */}
                    <path
                      d="M64 104c-10 4-16 12-18 22"
                      stroke="rgba(255,255,255,0.55)"
                      strokeWidth="10"
                      strokeLinecap="round"
                      opacity="0.9"
                    />

                    {/* Right arm checking watch (animated) */}
                    <g className="wait-arm" transform="translate(0,0)">
                      <path
                        d="M116 104c12 2 20 10 22 22"
                        stroke="rgba(255,255,255,0.55)"
                        strokeWidth="10"
                        strokeLinecap="round"
                        opacity="0.9"
                      />
                      {/* Watch */}
                      <circle cx="142" cy="132" r="8.5" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.25)" />
                      <path
                        className="wait-watchhand"
                        d="M142 132l4-3"
                        stroke="rgba(255,255,255,0.75)"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </g>

                    {/* Thought bubble dots */}
                    <circle cx="128" cy="42" r="2.5" fill="rgba(255,255,255,0.35)" />
                    <circle cx="140" cy="35" r="3.2" fill="rgba(255,255,255,0.35)" />
                    <circle cx="153" cy="30" r="4.2" fill="rgba(255,255,255,0.35)" />
                    </svg>
                  )}
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

              <div className="mt-4 text-xs text-gray-400 text-center max-w-lg mx-auto leading-relaxed">
                Tip: {tips[Math.min(tips.length - 1, tipIndex)]}
              </div>
            </div>
          </div>
        </div>
      </section>

      <style jsx global>{`
        @keyframes waitBob {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-6px);
          }
        }
        @keyframes waitArm {
          0%,
          100% {
            transform: rotate(-6deg);
          }
          50% {
            transform: rotate(10deg);
          }
        }
        @keyframes waitBlink {
          0%,
          92%,
          100% {
            opacity: 1;
          }
          94%,
          96% {
            opacity: 0;
          }
        }
        @keyframes waitHand {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
        @keyframes waitProgress {
          0% {
            transform: translateX(-65%);
          }
          100% {
            transform: translateX(125%);
          }
        }
        .wait-bob {
          animation: waitBob 2.2s ease-in-out infinite;
          will-change: transform;
        }
        .wait-arm {
          transform-origin: 116px 104px;
          animation: waitArm 1.8s ease-in-out infinite;
          will-change: transform;
        }
        .wait-blink {
          animation: waitBlink 4.5s ease-in-out infinite;
          will-change: opacity;
        }
        .wait-watchhand {
          transform-origin: 142px 132px;
          animation: waitHand 1.25s linear infinite;
          will-change: transform;
        }
        .wait-progress {
          width: 45%;
          border-radius: 999px;
          animation: waitProgress 1.4s ease-in-out infinite;
          will-change: transform;
        }
        .boy-img {
          width: 180px;
          height: 180px;
          object-fit: cover;
          object-position: var(--boy-pos, 50% 35%);
          filter: drop-shadow(0 10px 30px rgba(0, 0, 0, 0.25));
          transform: translate(var(--boy-x, 0px), var(--boy-y, 6px)) scale(var(--boy-scale, 1.14));
          transform-origin: center;
        }
        .boy-wrap {
          position: relative;
          width: 180px;
          height: 180px;
          border-radius: 999px;
          overflow: hidden;
        }
        .boy-stack {
          position: relative;
          width: 180px;
          height: 180px;
        }
        .boy-frame {
          position: absolute;
          inset: 0;
          transition: opacity 220ms ease-in-out;
          opacity: 1;
        }
        .boy-current {
          opacity: 1;
        }
        .boy-next {
          opacity: 0;
          pointer-events: none;
        }
        .boy-next--show {
          opacity: 1;
        }
        .boy-wrap::before {
          content: '';
          position: absolute;
          inset: -10px;
          border-radius: 999px;
          background: radial-gradient(
            60% 60% at 35% 25%,
            rgba(59, 130, 246, 0.35) 0%,
            rgba(236, 72, 153, 0.18) 55%,
            rgba(255, 255, 255, 0) 100%
          );
          filter: blur(10px);
          opacity: 0.9;
          pointer-events: none;
          z-index: 0;
        }
        .boy-wrap::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.10);
          pointer-events: none;
          z-index: 3;
        }
        .boy-img {
          position: relative;
          z-index: 1;
          background: rgba(255, 255, 255, 0.04);
        }
        @keyframes boyWiggle {
          0%,
          100% {
            transform: rotate(0deg);
          }
          25% {
            transform: rotate(-2deg);
          }
          75% {
            transform: rotate(2deg);
          }
        }
        .boy-frustrated .boy-img {
          filter: drop-shadow(0 10px 30px rgba(0, 0, 0, 0.25)) saturate(0.85) contrast(1.05);
          animation: boyWiggle 0.35s ease-in-out infinite;
        }
        @keyframes boyPop {
          0% {
            transform: scale(1);
          }
          45% {
            transform: scale(1.06);
          }
          100% {
            transform: scale(1);
          }
        }
        .boy-happy {
          animation: boyPop 0.6s ease-out 1;
        }
        @keyframes boyLookUp {
          0% {
            transform: translateY(0) scale(1);
          }
          55% {
            transform: translateY(-6px) scale(1.02);
          }
          100% {
            transform: translateY(-4px) scale(1.01);
          }
        }
        .boy-happy .boy-img {
          animation: boyLookUp 0.7s ease-out 1;
        }
        @keyframes confetti {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 0;
          }
          25% {
            opacity: 1;
          }
          100% {
            transform: translateY(18px) rotate(25deg);
            opacity: 0;
          }
        }
        .boy-happy::after {
          box-shadow:
            0 0 0 1px rgba(255, 255, 255, 0.10),
            26px 10px 0 0 rgba(34, 211, 238, 0.0),
            -18px 22px 0 0 rgba(236, 72, 153, 0.0);
        }
      `}</style>
    </div>
  );
}

