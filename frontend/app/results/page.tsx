'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useRef, useState, useEffect, useMemo } from 'react';

interface Issue {
  id: string;
  type: 'warning' | 'error' | 'success';
  title: string;
  description: string;
  timestamp: string;
  segmentId: number;
  startSec: number;
  endSec: number;
  fix: string;
}

type BackendSegment = {
  segment_id: number;
  start_sec: number;
  end_sec: number;
  risk: number;
  severity: string;
  label: string;
  fix: string;
  tone?: { kind?: string; honest?: string; brutal?: string };
};

type BackendAnalysis = {
  run_id: string;
  video_id: string;
  video_title: string;
  clarity_score: number;
  clarity_tier: string;
  segments: BackendSegment[];
};

function makeAnalysisStorageKey(filename: string, intensity: string) {
  return `analysis:${filename}:${intensity}`;
}

export default function ResultsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filename = searchParams.get('file');
  const intensityParam = searchParams.get('intensity') ?? '1';
  const [selectedIntensity, setSelectedIntensity] = useState<string>(intensityParam);
  useEffect(() => setSelectedIntensity(intensityParam), [intensityParam]);
  const [intensityOpen, setIntensityOpen] = useState(false);
  const intensityRef = useRef<HTMLDivElement | null>(null);
  
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalIssues, setTotalIssues] = useState(0);
  const [clarityScore, setClarityScore] = useState<number | null>(null);
  const [clarityTier, setClarityTier] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<BackendAnalysis | null>(null);
  const [selectedSegmentId, setSelectedSegmentId] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState<number>(0);

  const intensityOptions = useMemo(
    () => [
      {
        value: '0',
        label: 'Kind',
        desc: 'Gentle feedback',
        dotClass: 'bg-emerald-400',
      },
      {
        value: '1',
        label: 'Honest',
        desc: 'Balanced criticism',
        dotClass: 'bg-amber-400',
      },
      {
        value: '2',
        label: 'Brutal',
        desc: 'No sugarcoating',
        dotClass: 'bg-rose-400',
      },
    ],
    []
  );

  const selectedIntensityMeta =
    intensityOptions.find((o) => o.value === selectedIntensity) ?? intensityOptions[1];

  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const s = Math.floor(seconds);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  const seekToSeconds = (seconds: number) => {
    const el = videoRef.current;
    if (!el || !Number.isFinite(seconds)) return;
    const clamped = Math.max(0, Number.isFinite(el.duration) ? Math.min(seconds, el.duration) : seconds);
    el.currentTime = clamped;
    if (el.paused) {
      void el.play().catch(() => {});
    }
  };

  const onTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = videoRef.current;
    const timeline = timelineRef.current;
    if (!el || !timeline) return;

    const d = Number.isFinite(el.duration) ? el.duration : duration;
    if (!d || !Number.isFinite(d) || d <= 0) return;

    const rect = timeline.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.min(1, Math.max(0, x / rect.width));
    seekToSeconds(pct * d);
  };

  const togglePlay = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      void el.play().catch(() => {});
    } else {
      el.pause();
    }
  };

  const toggleMute = () => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = !el.muted;
  };

  const toggleFullscreen = () => {
    const el = videoRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen?.();
    } else {
      void el.requestFullscreen?.();
    }
  };

  const markers = issues.map((issue) => ({
      id: issue.id,
      type: issue.type,
    seconds: issue.startSec,
    segmentId: issue.segmentId,
  }));
  const issueCounts = issues.reduce(
    (acc, issue) => {
      acc.total += 1;
      if (issue.type === 'warning') acc.warnings += 1;
      else if (issue.type === 'error') acc.errors += 1;
      else acc.success += 1;
      return acc;
    },
    { total: 0, warnings: 0, errors: 0, success: 0 }
  );

  const selectedIssue =
    selectedSegmentId === null ? null : issues.find((i) => i.segmentId === selectedSegmentId) ?? null;

  const pickTone = (seg: BackendSegment) => {
    const key = selectedIntensity === '0' ? 'kind' : selectedIntensity === '2' ? 'brutal' : 'honest';
    return seg.tone?.[key] ?? seg.fix ?? seg.label;
  };

  const mapBackendToIssues = (analysisToMap: BackendAnalysis): Issue[] => {
    return (analysisToMap.segments ?? []).map((seg) => {
      const type: Issue['type'] =
        seg.severity === 'high' ? 'error' : seg.severity === 'medium' ? 'warning' : 'warning';
      return {
        id: String(seg.segment_id),
        type,
        title: seg.label,
        description: pickTone(seg),
        timestamp: formatTime(seg.start_sec),
        segmentId: seg.segment_id,
        startSec: seg.start_sec,
        endSec: seg.end_sec,
        fix: seg.fix,
      };
    });
  };

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!filename) {
        setIssues([]);
        setTotalIssues(0);
        setClarityScore(null);
        setClarityTier(null);
        setAnalysis(null);
        setSelectedSegmentId(null);
        setLoading(false);
        return;
      }

      setLoading(true);

      // 1) Instant path: use analysis that Waiting page cached
      const key = makeAnalysisStorageKey(filename, intensityParam);
      const cached = sessionStorage.getItem(key);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as BackendAnalysis;
          if (!cancelled && parsed && Array.isArray(parsed.segments)) {
            setClarityScore(typeof parsed.clarity_score === 'number' ? parsed.clarity_score : null);
            setClarityTier(typeof parsed.clarity_tier === 'string' ? parsed.clarity_tier : null);
            setAnalysis(parsed);
            setLoading(false);
            sessionStorage.removeItem(key);
            return;
          }
        } catch {
          // ignore and fall back
        }
      }

      // 2) Fallback: analyze on-demand (direct visit to /results)
      try {
        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ video_id: filename }),
        });
        const data = (await res.json()) as { success: boolean; analysis?: BackendAnalysis };
        if (!data?.success || !data.analysis) throw new Error('Analyze failed');
        if (cancelled) return;
        setClarityScore(typeof data.analysis.clarity_score === 'number' ? data.analysis.clarity_score : null);
        setClarityTier(typeof data.analysis.clarity_tier === 'string' ? data.analysis.clarity_tier : null);
        setAnalysis(data.analysis);
        setLoading(false);
      } catch {
        if (cancelled) return;
        setIssues([]);
        setTotalIssues(0);
        setClarityScore(null);
        setClarityTier(null);
        setAnalysis(null);
        setSelectedSegmentId(null);
        setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [filename, intensityParam]);

  // Derive UI issues from analysis + selectedIntensity (no re-analyze required)
  useEffect(() => {
    if (!analysis) {
      setIssues([]);
      setTotalIssues(0);
      setSelectedSegmentId(null);
      return;
    }
    const mapped = mapBackendToIssues(analysis);
    setIssues(mapped);
    setTotalIssues(mapped.length);
    setSelectedSegmentId((prev) => (prev !== null ? prev : mapped[0]?.segmentId ?? null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis, selectedIntensity]);

  const getIntensityLabel = () => {
    if (selectedIntensity === '0') return 'Kind';
    if (selectedIntensity === '1') return 'Honest';
    return 'Brutal';
  };

  const onChangeIntensity = (next: string) => {
    setSelectedIntensity(next);
    const qp = new URLSearchParams(searchParams.toString());
    qp.set('intensity', next);
    router.replace(`/results?${qp.toString()}`);
  };

  useEffect(() => {
    if (!intensityOpen) return;
    const onDown = (e: MouseEvent) => {
      const el = intensityRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) {
        setIntensityOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIntensityOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [intensityOpen]);

  const getIconForType = (type: string) => {
    if (type === 'warning') {
      return (
        <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
          <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
      );
    }
    if (type === 'error') {
      return (
        <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
          <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      );
    }
    return (
      <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
        <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
    );
  };

  return (
    <div className="min-h-screen animated-gradient relative overflow-hidden text-white">
      <section className="max-w-7xl mx-auto px-8 pt-10 pb-16">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => window.location.href = '/'}
            className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors mb-2"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>

          <h1 className="text-3xl font-semibold mb-2 tracking-tight">Analysis Results</h1>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
            {/* Clarity */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/15 px-5 py-4">
              <div className="text-xs text-white/60 uppercase tracking-wide">Clarity Score</div>
              <div className="mt-2 flex items-baseline gap-2">
                <div className="text-3xl font-semibold tabular-nums">
                  {clarityScore !== null ? clarityScore : '—'}
                </div>
                <div className="text-sm text-white/60">/100</div>
              </div>
              <div className="mt-1 text-sm text-white/70">{clarityTier ?? '—'}</div>
            </div>

            {/* Intensity */}
            <div
              className={`bg-white/10 backdrop-blur-md rounded-2xl border border-white/15 px-5 py-4 relative ${
                intensityOpen ? 'z-50' : ''
              }`}
            >
              <div className="text-xs text-white/60 uppercase tracking-wide">Intensity</div>
              <div className="mt-3">
                <div className="relative" ref={intensityRef}>
                  <button
                    type="button"
                    onClick={() => setIntensityOpen((v) => !v)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white/20 flex items-center justify-between gap-3"
                    aria-haspopup="listbox"
                    aria-expanded={intensityOpen}
                  >
                    <span className="flex items-center gap-3">
                      <span className={`w-2.5 h-2.5 rounded-full ${selectedIntensityMeta.dotClass}`} />
                      <span className="font-medium">{selectedIntensityMeta.label}</span>
                      <span className="text-white/55 text-sm hidden sm:inline">{selectedIntensityMeta.desc}</span>
                    </span>
                    <svg
                      className={`w-5 h-5 text-white/70 transition-transform ${intensityOpen ? 'rotate-180' : ''}`}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {intensityOpen && (
                    <div
                      className="absolute z-[80] mt-2 w-full rounded-2xl border border-white/15 bg-black/35 backdrop-blur-xl shadow-2xl overflow-hidden"
                      role="listbox"
                      aria-label="Select intensity"
                    >
                      <div className="p-1.5">
                        {intensityOptions.map((opt) => {
                          const active = opt.value === selectedIntensity;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              role="option"
                              aria-selected={active}
                              onClick={() => {
                                onChangeIntensity(opt.value);
                                setIntensityOpen(false);
                              }}
                              className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-3 transition-colors ${
                                active ? 'bg-white/15' : 'hover:bg-white/10'
                              }`}
                            >
                              <span className={`w-2.5 h-2.5 rounded-full ${opt.dotClass}`} />
                              <div className="flex-1">
                                <div className="text-white font-medium">{opt.label}</div>
                                <div className="text-xs text-white/60">{opt.desc}</div>
                              </div>
                              {active && (
                                <svg className="w-5 h-5 text-white/80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 6L9 17l-5-5" />
                                </svg>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Total issues */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/15 px-5 py-4">
              <div className="text-xs text-white/60 uppercase tracking-wide">Total issues</div>
              <div className="mt-2 text-3xl font-semibold tabular-nums">{totalIssues}</div>
              <div className="mt-1 text-sm text-white/70">Found in this run</div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Video Player */}
          <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/20">
            <div className="aspect-video bg-black/40 rounded-2xl mb-5 overflow-hidden border border-white/10">
            {filename ? (
              <video 
                className="w-full h-full cursor-pointer"
                ref={videoRef}
                onLoadedMetadata={(e) => {
                  const d = (e.currentTarget as HTMLVideoElement).duration;
                  setDuration(Number.isFinite(d) ? d : 0);
                }}
                onTimeUpdate={(e) => {
                  setCurrentTime((e.currentTarget as HTMLVideoElement).currentTime);
                }}
                onClick={togglePlay}
                src={`/api/video/${filename}`}
              >
                Your browser does not support the video tag.
              </video>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-300">No video selected</p>
              </div>
            )}
          </div>
          
          {/* Custom controls (single scrub line with issue markers) */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={togglePlay}
              className="w-10 h-10 rounded-full bg-white/10 border border-white/10 hover:bg-white/15 transition-colors flex items-center justify-center"
              aria-label="Play/Pause"
            >
              {videoRef.current?.paused !== false ? (
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 5h4v14H6zm8 0h4v14h-4z" />
                </svg>
              )}
            </button>

            <div className="flex-1">
              <div
                ref={timelineRef}
                className="relative h-2 bg-white/10 rounded-full border border-white/10 cursor-pointer"
                onClick={onTimelineClick}
                role="slider"
                aria-label="Video timeline"
                aria-valuemin={0}
                aria-valuemax={duration || undefined}
                aria-valuenow={currentTime}
              >
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-white/20"
                  style={{
                    width: duration > 0 ? `${Math.min(100, (currentTime / duration) * 100)}%` : '0%',
                  }}
                />

                {duration > 0 &&
                  markers.map((m) => {
                    const rawPct = (m.seconds / duration) * 100;
                    const leftPct = Math.min(99.5, Math.max(0.5, rawPct));
                    const color =
                      m.type === 'error' ? 'bg-red-500' : m.type === 'warning' ? 'bg-yellow-500' : 'bg-green-500';
                    return (
                      <button
                        key={m.id}
                        type="button"
                        className={`absolute top-1/2 w-3 h-3 rounded-full ${color} shadow-sm`}
                        style={{ left: `${leftPct}%`, transform: 'translate(-50%, -50%)' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          seekToSeconds(m.seconds);
                        }}
                        aria-label="Jump to issue timestamp"
                        title="Jump to issue"
                      />
                    );
                  })}
              </div>
              <div className="flex items-center justify-between text-xs text-gray-300 mt-2 tabular-nums">
                <span>{formatTime(currentTime)}</span>
                <span>{duration > 0 ? formatTime(duration) : '--:--'}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={toggleMute}
              className="w-10 h-10 rounded-full bg-white/10 border border-white/10 hover:bg-white/15 transition-colors flex items-center justify-center"
              aria-label="Mute/Unmute"
            >
              {videoRef.current?.muted ? (
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16.5 12l3.5 3.5-1.5 1.5L15 13.5 11.5 17H8v-6H5V9h3V7h3.5L15 10.5l3.5-3.5 1.5 1.5z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 10v4h4l5 5V5L7 10H3zm13.5 2c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
                </svg>
              )}
            </button>

            <button
              type="button"
              onClick={toggleFullscreen}
              className="w-10 h-10 rounded-full bg-white/10 border border-white/10 hover:bg-white/15 transition-colors flex items-center justify-center"
              aria-label="Fullscreen"
            >
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 14H5v5h5v-2H7v-3zm0-4h2V7h3V5H5v5zm10 9h-3v2h5v-5h-2v3zm0-14V7h-3v2h5V5h-2z" />
              </svg>
            </button>
          </div>

          <div className="mt-6 pt-5 border-t border-white/10">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold tracking-wide text-white/90">Suggested fix</h2>
              {selectedIssue ? (
                <span className="text-xs text-gray-300 tabular-nums">
                  {formatTime(selectedIssue.startSec)}–{formatTime(selectedIssue.endSec)}
                </span>
              ) : (
                <span className="text-xs text-gray-300">{issueCounts.total} issues</span>
              )}
            </div>

            {selectedIssue ? (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-left">
                <div className="text-sm font-semibold text-white mb-1">{selectedIssue.title}</div>
                <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{selectedIssue.fix}</p>
              </div>
            ) : (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-gray-300 text-sm">
                Click an issue to see the suggested fix.
              </div>
            )}
          </div>
          </div>

          {/* Issues List */}
          <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/20 max-h-[600px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
            </div>
          ) : (
            <div className="space-y-4">
              {issues.map((issue) => (
                <div 
                  key={issue.id}
                  className={`bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/10 transition-colors cursor-pointer ${
                    selectedSegmentId === issue.segmentId ? 'ring-1 ring-white/25' : ''
                  }`}
                  onClick={() => {
                    setSelectedSegmentId(issue.segmentId);
                    seekToSeconds(issue.startSec);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedSegmentId(issue.segmentId);
                      seekToSeconds(issue.startSec);
                    }
                  }}
                >
                  <div className="flex items-start gap-4">
                    {getIconForType(issue.type)}
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-1">
                        <h3 className="font-semibold text-lg">{issue.title}</h3>
                        <span className="text-yellow-500 font-mono text-sm">{issue.timestamp}</span>
                      </div>
                      <p className="text-gray-300 text-sm">{issue.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>
        </div>
      </section>
    </div>
  );
}
