'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';

export default function Home() {
  const [intensity, setIntensity] = useState(1); // 0=Kind, 1=Honest, 2=Brutal
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [videoId, setVideoId] = useState<string>(''); // Backend video_id
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadStatusText, setUploadStatusText] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
            
            <button 
              onClick={() => {
                if (uploadedFile && videoId) {
                  window.location.href = `/waiting?file=${encodeURIComponent(videoId)}&intensity=${intensity}`;
                }
              }}
              disabled={!uploadSuccess || uploading}
              className={`w-full text-lg font-semibold px-8 py-4 rounded-xl transition-all inline-flex items-center justify-center gap-3 ${
                uploadSuccess && !uploading
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
