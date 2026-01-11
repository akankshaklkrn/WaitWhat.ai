'use client';

import { useMemo, useRef, useState } from 'react';
import Image from 'next/image';

type PresentationContext = {
  mode: string;
  audience: string;
  goal: string;
  one_liner?: string;
  target_user?: string;
  tone_preference?: string;
  success_metrics?: string[];
  domain?: string;
  time_limit?: string;
};

function makeContextStorageKey(videoId: string) {
  return `context:${videoId}`;
}

export default function Home() {
  const [intensity, setIntensity] = useState(1); // 0=Kind, 1=Honest, 2=Brutal
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [videoId, setVideoId] = useState<string>(''); // Backend video_id
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadStatusText, setUploadStatusText] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [contextOpen, setContextOpen] = useState(false);
  const [mode, setMode] = useState('');
  const [modeOther, setModeOther] = useState('');
  const [audience, setAudience] = useState('');
  const [audienceOther, setAudienceOther] = useState('');
  const [goal, setGoal] = useState('');
  const [goalOther, setGoalOther] = useState('');

  const [oneLiner, setOneLiner] = useState('');
  const [targetUser, setTargetUser] = useState('');
  const [targetUserOther, setTargetUserOther] = useState('');
  const [tonePreference, setTonePreference] = useState('');
  const [domain, setDomain] = useState('');
  const [domainOther, setDomainOther] = useState('');
  const [timeLimit, setTimeLimit] = useState('');
  const [successMetrics, setSuccessMetrics] = useState<string[]>([]);

  const contextEnabled = contextOpen; // simple UX: if they open it, we include it

  const resolveOther = (v: string, other: string) => (v === 'Other' ? other.trim() : v);

  const contextIsValid = useMemo(() => {
    if (!contextEnabled) return true;
    const m = resolveOther(mode, modeOther);
    const a = resolveOther(audience, audienceOther);
    const g = resolveOther(goal, goalOther);
    return Boolean(m && a && g);
  }, [audience, audienceOther, contextEnabled, goal, goalOther, mode, modeOther]);

  const contextPayload: PresentationContext | null = useMemo(() => {
    if (!contextEnabled) return null;
    const m = resolveOther(mode, modeOther);
    const a = resolveOther(audience, audienceOther);
    const g = resolveOther(goal, goalOther);
    if (!m || !a || !g) return null;

    const payload: PresentationContext = { mode: m, audience: a, goal: g };
    if (oneLiner.trim()) payload.one_liner = oneLiner.trim();
    const tu = resolveOther(targetUser, targetUserOther);
    if (tu) payload.target_user = tu;
    if (tonePreference) payload.tone_preference = tonePreference;
    const d = resolveOther(domain, domainOther);
    if (d) payload.domain = d;
    if (timeLimit) payload.time_limit = timeLimit;
    if (successMetrics.length) payload.success_metrics = successMetrics.slice(0, 2);
    return payload;
  }, [
    audience,
    audienceOther,
    contextEnabled,
    domain,
    domainOther,
    goal,
    goalOther,
    mode,
    modeOther,
    oneLiner,
    successMetrics,
    targetUser,
    targetUserOther,
    timeLimit,
    tonePreference,
  ]);

  const getIntensityText = () => {
    if (intensity === 0) return "We'll be gentle with you";
    if (intensity === 1) return "The truth, nothing more";
    return "No mercy, no sugarcoating";
  };

  const getIntensityColor = () => {
    if (intensity === 0) return "text-green-600";
    if (intensity === 1) return "text-orange-600";
    return "text-red-600";
  };

  const getSliderColor = () => {
    if (intensity === 0) return "bg-gradient-to-r from-green-500 to-green-400";
    if (intensity === 1) return "bg-gradient-to-r from-green-500 via-yellow-500 to-orange-500";
    return "bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500";
  };

  const getActiveLabel = () => {
    if (intensity === 0) return "kind";
    if (intensity === 1) return "honest";
    return "brutal";
  };

  const getBackgroundColor = () => {
    if (intensity === 0) return "bg-gradient-to-br from-green-50 via-emerald-100 to-teal-50";
    if (intensity === 1) return "bg-gradient-to-br from-amber-50 via-yellow-100 to-orange-50";
    return "bg-gradient-to-br from-rose-50 via-red-100 to-pink-50";
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check if it's a video file
    if (!file.type.startsWith('video/')) {
      alert('Please select a video file');
      return;
    }

    setUploadedFile(file);
    setUploading(true);
    setUploadSuccess(false);
    setUploadStatusText('Uploading…');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!result?.success || !result?.video_id) {
        alert('Upload failed: ' + (result?.error ?? 'Unknown error'));
        setUploadedFile(null);
        setVideoId('');
        setUploadSuccess(false);
        setUploadStatusText('');
        return;
      }

      setVideoId(result.video_id);
      setUploadStatusText('Processing…');

      // Poll backend status until ready
      const maxWaitMs = 3 * 60 * 1000; // 3 minutes
      const start = Date.now();
      while (Date.now() - start < maxWaitMs) {
        const statusRes = await fetch(`/api/status/${encodeURIComponent(result.video_id)}`, { cache: 'no-store' });
        const statusJson = await statusRes.json().catch(() => null);
        if (statusJson?.status === 'ready') {
          setUploadSuccess(true);
          setUploadStatusText('✓ Upload successful!');
          return;
        }
        if (statusJson?.status === 'failed' || statusJson?.status === 'error') {
          alert('Processing failed. Please try again.');
          setUploadedFile(null);
          setVideoId('');
          setUploadSuccess(false);
          setUploadStatusText('');
          return;
        }
        await new Promise((r) => setTimeout(r, 2000));
      }

      alert('Processing is taking longer than expected. Please try again in a bit.');
      setUploadSuccess(false);
      setUploadStatusText('');
      setVideoId('');
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed');
      setUploadedFile(null);
      setVideoId('');
      setUploadSuccess(false);
      setUploadStatusText('');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen animated-gradient relative overflow-hidden">
      {/* Logo in top left corner */}
      <div className="absolute top-8 left-8 flex items-center gap-3 z-10">
        <div className="w-10 h-10 bg-white/10 backdrop-blur-sm rounded-lg flex items-center justify-center border border-white/15">
          <Image
            src="/Wait.png"
            alt="Wait What logo"
            width={32}
            height={32}
            priority
            className="w-8 h-8 object-contain"
          />
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">
          Wait What?!?
        </h1>
      </div>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-8 py-20">
        <div className="text-center mb-20">
          <p className="text-5xl md:text-6xl text-white mb-6 font-medium tracking-tight max-w-4xl mx-auto leading-[1.08]">
            Get feedback on your demos that <span className="italic font-medium">actually helps.</span>
          </p>
          <p className="text-lg md:text-xl text-white/70 max-w-2xl mx-auto leading-relaxed">
            AI-powered video analysis that doesn't sugarcoat. Upload, choose your intensity, and get actionable improvements in seconds.
          </p>
        </div>

        {/* Main Content - Vertical Stepper */}
        <div className="max-w-3xl mx-auto space-y-6">
          
          {/* Step 1 - Upload Section */}
          <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/20 relative">
            {/* Step Number */}
            <div className="absolute -top-4 -left-4 w-12 h-12 bg-white rounded-full flex items-center justify-center text-2xl font-bold text-purple-600 shadow-lg">
              1
            </div>
            
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-white mb-2">Upload your demo</h2>
              <p className="text-gray-300 text-sm">Drop your video here</p>
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleFileChange}
              className="hidden"
            />
            
            <div 
              onClick={handleFileClick}
              className="bg-white/5 border-2 border-dashed border-white/30 rounded-2xl p-10 hover:border-white/50 hover:bg-white/10 transition-all cursor-pointer"
            >
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-4">
                  {uploading ? (
                    <svg className="w-8 h-8 text-white animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  ) : uploadSuccess ? (
                    <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  )}
                </div>
                <h4 className="text-lg text-white mb-2 font-medium text-center">
                  {uploadedFile ? uploadedFile.name : 'Click to upload'}
                </h4>
                <p className="text-gray-300 text-sm text-center">
                  {uploading ? (uploadStatusText || 'Uploading…') : uploadSuccess ? '✓ Upload successful!' : 'MP4, MOV, WebM • Max 5 min'}
                </p>
              </div>
            </div>
          </div>

          {/* Connector Line */}
          {uploadSuccess && (
            <div className="flex justify-center">
              <div className="w-0.5 h-8 bg-gradient-to-b from-white to-transparent"></div>
            </div>
          )}

          {/* Step 2 - Feedback Intensity */}
          <div className={`bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/20 relative transition-all ${
            !uploadSuccess ? 'opacity-50' : ''
          }`}>
            {/* Step Number */}
            <div className={`absolute -top-4 -left-4 w-12 h-12 rounded-full flex items-center justify-center text-2xl font-bold shadow-lg ${
              uploadSuccess ? 'bg-white text-purple-600' : 'bg-gray-400 text-gray-600'
            }`}>
              2
            </div>
            
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-white mb-2">Choose intensity</h2>
              <p className="text-gray-300 text-sm">How honest should we be?</p>
            </div>
            
            <div className="space-y-3">
              {/* Kind Option */}
              <div 
                onClick={() => uploadSuccess && setIntensity(0)}
                className={`p-4 rounded-xl border-2 transition-all flex items-center gap-4 ${
                  !uploadSuccess 
                    ? 'cursor-not-allowed border-white/20 bg-white/5' 
                    : intensity === 0 
                      ? 'border-white bg-white/20 shadow-lg cursor-pointer' 
                      : 'border-white/30 hover:border-white/50 hover:bg-white/10 cursor-pointer'
                }`}
              >
                <span className="text-3xl">😊</span>
                <div className="flex-1">
                  <h4 className="text-lg font-semibold text-white">Kind</h4>
                  <p className="text-gray-300 text-sm">Gentle feedback</p>
                </div>
                {intensity === 0 && uploadSuccess && (
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
              </div>

              {/* Honest Option */}
              <div 
                onClick={() => uploadSuccess && setIntensity(1)}
                className={`p-4 rounded-xl border-2 transition-all flex items-center gap-4 ${
                  !uploadSuccess 
                    ? 'cursor-not-allowed border-white/20 bg-white/5' 
                    : intensity === 1 
                      ? 'border-white bg-white/20 shadow-lg cursor-pointer' 
                      : 'border-white/30 hover:border-white/50 hover:bg-white/10 cursor-pointer'
                }`}
              >
                <span className="text-3xl">🎯</span>
                <div className="flex-1">
                  <h4 className="text-lg font-semibold text-white">Honest</h4>
                  <p className="text-gray-300 text-sm">Balanced criticism</p>
                </div>
                {intensity === 1 && uploadSuccess && (
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
              </div>

              {/* Brutal Option */}
              <div 
                onClick={() => uploadSuccess && setIntensity(2)}
                className={`p-4 rounded-xl border-2 transition-all flex items-center gap-4 ${
                  !uploadSuccess 
                    ? 'cursor-not-allowed border-white/20 bg-white/5' 
                    : intensity === 2 
                      ? 'border-white bg-white/20 shadow-lg cursor-pointer' 
                      : 'border-white/30 hover:border-white/50 hover:bg-white/10 cursor-pointer'
                }`}
              >
                <span className="text-3xl">🔥</span>
                <div className="flex-1">
                  <h4 className="text-lg font-semibold text-white">Brutal</h4>
                  <p className="text-gray-300 text-sm">No sugarcoating</p>
                </div>
                {intensity === 2 && uploadSuccess && (
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
            </div>
          </div>

          {/* Connector Line */}
          {uploadSuccess && (
            <div className="flex justify-center">
              <div className="w-0.5 h-8 bg-gradient-to-b from-white to-transparent"></div>
            </div>
          )}

          {/* Step 3 - Submit Button */}
          <div className={`bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/20 relative transition-all ${
            !uploadSuccess ? 'opacity-50' : ''
          }`}>
            {/* Step Number */}
            <div className={`absolute -top-4 -left-4 w-12 h-12 rounded-full flex items-center justify-center text-2xl font-bold shadow-lg ${
              uploadSuccess ? 'bg-white text-purple-600' : 'bg-gray-400 text-gray-600'
            }`}>
              3
            </div>
            
            <div className="mb-4">
              <h2 className="text-2xl font-semibold text-white mb-2">Get your feedback</h2>
              <p className="text-gray-300 text-sm">AI analysis in seconds</p>
            </div>

            {/* Optional context */}
            <div className="mb-5">
              <button
                type="button"
                onClick={() => setContextOpen((v) => !v)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 flex items-center justify-between gap-3 hover:bg-white/10 transition-colors"
              >
                <div className="text-left">
                  <div className="text-sm font-semibold text-white">Add more context (optional)</div>
                  <div className="text-xs text-white/65">For more detailed, relevant analysis</div>
                </div>
                <svg
                  className={`w-5 h-5 text-white/70 transition-transform ${contextOpen ? 'rotate-180' : ''}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {contextOpen && (
                <div className="mt-3 bg-white/5 border border-white/10 rounded-2xl p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Required */}
                    <div>
                      <label className="text-xs text-white/70">
                        What are you presenting? <span className="text-white">*</span>
                      </label>
                      <select
                        value={mode}
                        onChange={(e) => setMode(e.target.value)}
                        className="mt-1 w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white/20"
                      >
                        <option value="">Select…</option>
                        <option value="Startup pitch">Startup pitch</option>
                        <option value="Product demo">Product demo</option>
                        <option value="Technical presentation">Technical presentation</option>
                        <option value="Interview answer">Interview answer</option>
                        <option value="Sales pitch">Sales pitch</option>
                        <option value="Classroom / academic presentation">Classroom / academic presentation</option>
                        <option value="Other">Other</option>
                      </select>
                      {mode === 'Other' && (
                        <input
                          value={modeOther}
                          onChange={(e) => setModeOther(e.target.value)}
                          placeholder="Type your mode…"
                          className="mt-2 w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
                        />
                      )}
                    </div>

                    <div>
                      <label className="text-xs text-white/70">
                        Who is the audience? <span className="text-white">*</span>
                      </label>
                      <select
                        value={audience}
                        onChange={(e) => setAudience(e.target.value)}
                        className="mt-1 w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white/20"
                      >
                        <option value="">Select…</option>
                        <option value="Investors">Investors</option>
                        <option value="Recruiters">Recruiters</option>
                        <option value="Customers / users">Customers / users</option>
                        <option value="Technical team">Technical team</option>
                        <option value="Non-technical stakeholders">Non-technical stakeholders</option>
                        <option value="Professors / evaluators">Professors / evaluators</option>
                        <option value="General audience">General audience</option>
                        <option value="Other">Other</option>
                      </select>
                      {audience === 'Other' && (
                        <input
                          value={audienceOther}
                          onChange={(e) => setAudienceOther(e.target.value)}
                          placeholder="Type your audience…"
                          className="mt-2 w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
                        />
                      )}
                    </div>

                    <div>
                      <label className="text-xs text-white/70">
                        What is the goal? <span className="text-white">*</span>
                      </label>
                      <select
                        value={goal}
                        onChange={(e) => setGoal(e.target.value)}
                        className="mt-1 w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white/20"
                      >
                        <option value="">Select…</option>
                        <option value="Get funding">Get funding</option>
                        <option value="Get hired">Get hired</option>
                        <option value="Explain an idea clearly">Explain an idea clearly</option>
                        <option value="Convince / persuade">Convince / persuade</option>
                        <option value="Educate">Educate</option>
                        <option value="Get feedback">Get feedback</option>
                        <option value="Other">Other</option>
                      </select>
                      {goal === 'Other' && (
                        <input
                          value={goalOther}
                          onChange={(e) => setGoalOther(e.target.value)}
                          placeholder="Type your goal…"
                          className="mt-2 w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
                        />
                      )}
                    </div>

                    {/* Optional */}
                    <div>
                      <label className="text-xs text-white/70">One-liner (recommended)</label>
                      <input
                        value={oneLiner}
                        onChange={(e) => setOneLiner(e.target.value)}
                        placeholder="An AI tool that helps founders detect unclear messaging…"
                        className="mt-1 w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-white/70">Target user</label>
                      <select
                        value={targetUser}
                        onChange={(e) => setTargetUser(e.target.value)}
                        className="mt-1 w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white/20"
                      >
                        <option value="">Select…</option>
                        <option value="Founders">Founders</option>
                        <option value="Students">Students</option>
                        <option value="Developers">Developers</option>
                        <option value="Enterprises">Enterprises</option>
                        <option value="Small businesses">Small businesses</option>
                        <option value="Consumers">Consumers</option>
                        <option value="Other">Other</option>
                      </select>
                      {targetUser === 'Other' && (
                        <input
                          value={targetUserOther}
                          onChange={(e) => setTargetUserOther(e.target.value)}
                          placeholder="Type your target user…"
                          className="mt-2 w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
                        />
                      )}
                    </div>

                    <div>
                      <label className="text-xs text-white/70">Tone preference</label>
                      <select
                        value={tonePreference}
                        onChange={(e) => setTonePreference(e.target.value)}
                        className="mt-1 w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white/20"
                      >
                        <option value="">Select…</option>
                        <option value="Confident">Confident</option>
                        <option value="Friendly">Friendly</option>
                        <option value="Professional">Professional</option>
                        <option value="Bold">Bold</option>
                        <option value="Technical">Technical</option>
                        <option value="Story-driven">Story-driven</option>
                        <option value="Minimal / concise">Minimal / concise</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-white/70">Domain / topic</label>
                      <select
                        value={domain}
                        onChange={(e) => setDomain(e.target.value)}
                        className="mt-1 w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white/20"
                      >
                        <option value="">Select…</option>
                        <option value="AI / Machine Learning">AI / Machine Learning</option>
                        <option value="SaaS / Software">SaaS / Software</option>
                        <option value="Consumer app">Consumer app</option>
                        <option value="Healthcare">Healthcare</option>
                        <option value="Fintech">Fintech</option>
                        <option value="Hardware / IoT">Hardware / IoT</option>
                        <option value="Education">Education</option>
                        <option value="Media / content">Media / content</option>
                        <option value="Other">Other</option>
                      </select>
                      {domain === 'Other' && (
                        <input
                          value={domainOther}
                          onChange={(e) => setDomainOther(e.target.value)}
                          placeholder="Type your domain…"
                          className="mt-2 w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
                        />
                      )}
                    </div>

                    <div>
                      <label className="text-xs text-white/70">Time limit</label>
                      <select
                        value={timeLimit}
                        onChange={(e) => setTimeLimit(e.target.value)}
                        className="mt-1 w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white/20"
                      >
                        <option value="">Select…</option>
                        <option value="30 seconds">30 seconds</option>
                        <option value="60 seconds">60 seconds</option>
                        <option value="2 minutes">2 minutes</option>
                        <option value="5 minutes">5 minutes</option>
                        <option value="No fixed limit">No fixed limit</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="text-xs text-white/70 mb-2">Success metrics (optional, pick up to 2)</div>
                    <div className="flex flex-wrap gap-2">
                      {[
                        'Audience clearly understands the idea',
                        'Sounds credible and trustworthy',
                        'Feels compelling and exciting',
                        'Clear problem → solution flow',
                        'Strong call-to-action',
                        'Memorable takeaway',
                      ].map((m) => {
                        const active = successMetrics.includes(m);
                        const disabled = !active && successMetrics.length >= 2;
                        return (
                          <button
                            key={m}
                            type="button"
                            onClick={() => {
                              setSuccessMetrics((prev) => {
                                if (prev.includes(m)) return prev.filter((x) => x !== m);
                                if (prev.length >= 2) return prev;
                                return [...prev, m];
                              });
                            }}
                            disabled={disabled}
                            className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                              active
                                ? 'bg-white/15 border-white/20 text-white'
                                : disabled
                                  ? 'bg-white/5 border-white/10 text-white/40 cursor-not-allowed'
                                  : 'bg-white/5 border-white/10 text-white/75 hover:bg-white/10'
                            }`}
                          >
                            {m}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {!contextIsValid && (
                    <div className="mt-3 text-xs text-amber-200">
                      Please fill the required fields (mode, audience, goal) or collapse this section to continue.
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <button 
              onClick={() => {
                if (uploadedFile && videoId) {
                  try {
                    if (contextPayload) {
                      sessionStorage.setItem(makeContextStorageKey(videoId), JSON.stringify(contextPayload));
                    } else {
                      sessionStorage.removeItem(makeContextStorageKey(videoId));
                    }
                  } catch {
                    // ignore
                  }
                  window.location.href = `/waiting?file=${encodeURIComponent(videoId)}&intensity=${intensity}`;
                }
              }}
              disabled={!uploadSuccess || uploading || !contextIsValid}
              className={`w-full text-lg font-semibold px-8 py-4 rounded-xl transition-all inline-flex items-center justify-center gap-3 ${
                uploadSuccess && !uploading && contextIsValid
                  ? 'bg-white hover:bg-gray-100 text-purple-600 cursor-pointer shadow-lg hover:shadow-xl'
                  : 'bg-gray-400 text-gray-600 cursor-not-allowed'
              }`}
            >
              Analyze My Demo
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
