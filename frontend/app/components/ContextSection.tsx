'use client';

import { useState } from 'react';

export type PresentationContext = {
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

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: PresentationContext | null;
  onContextChange: (context: PresentationContext | null) => void;
};

export default function ContextSection({ open, onOpenChange, context, onContextChange }: Props) {
  const [mode, setMode] = useState(context?.mode ?? '');
  const [modeOther, setModeOther] = useState('');
  const [audience, setAudience] = useState(context?.audience ?? '');
  const [audienceOther, setAudienceOther] = useState('');
  const [goal, setGoal] = useState(context?.goal ?? '');
  const [goalOther, setGoalOther] = useState('');
  const [oneLiner, setOneLiner] = useState(context?.one_liner ?? '');
  const [targetUser, setTargetUser] = useState(context?.target_user ?? '');
  const [targetUserOther, setTargetUserOther] = useState('');
  const [tonePreference, setTonePreference] = useState(context?.tone_preference ?? '');
  const [domain, setDomain] = useState(context?.domain ?? '');
  const [domainOther, setDomainOther] = useState('');
  const [timeLimit, setTimeLimit] = useState(context?.time_limit ?? '');
  const [successMetrics, setSuccessMetrics] = useState<string[]>(context?.success_metrics ?? []);

  const resolveOther = (v: string, other: string) => (v === 'Other' ? other.trim() : v);

  const isValid = !open || (Boolean(mode) && Boolean(audience) && Boolean(goal));

  const updateContext = () => {
    if (!open) {
      onContextChange(null);
      return;
    }

    const m = resolveOther(mode, modeOther);
    const a = resolveOther(audience, audienceOther);
    const g = resolveOther(goal, goalOther);
    if (!m || !a || !g) {
      onContextChange(null);
      return;
    }

    const payload: PresentationContext = { mode: m, audience: a, goal: g };
    if (oneLiner.trim()) payload.one_liner = oneLiner.trim();
    const tu = resolveOther(targetUser, targetUserOther);
    if (tu) payload.target_user = tu;
    if (tonePreference) payload.tone_preference = tonePreference;
    const d = resolveOther(domain, domainOther);
    if (d) payload.domain = d;
    if (timeLimit) payload.time_limit = timeLimit;
    if (successMetrics.length) payload.success_metrics = successMetrics.slice(0, 2);
    onContextChange(payload);
  };

  return (
    <div className="mb-5">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 flex items-center justify-between gap-3 hover:bg-white/10 transition-colors"
      >
        <div className="text-left">
          <div className="text-sm font-semibold text-white">Add more context (optional)</div>
          <div className="text-xs text-white/65">For more detailed, relevant analysis</div>
        </div>
        <svg
          className={`w-5 h-5 text-white/70 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="mt-3 bg-white/5 border border-white/10 rounded-2xl p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Required */}
            <div>
              <label className="text-xs text-white/70">
                What are you presenting? <span className="text-white">*</span>
              </label>
              <select
                value={mode}
                onChange={(e) => {
                  setMode(e.target.value);
                  updateContext();
                }}
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
                  onChange={(e) => {
                    setModeOther(e.target.value);
                    updateContext();
                  }}
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
                onChange={(e) => {
                  setAudience(e.target.value);
                  updateContext();
                }}
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
                  onChange={(e) => {
                    setAudienceOther(e.target.value);
                    updateContext();
                  }}
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
                onChange={(e) => {
                  setGoal(e.target.value);
                  updateContext();
                }}
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
                  onChange={(e) => {
                    setGoalOther(e.target.value);
                    updateContext();
                  }}
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
                onChange={(e) => {
                  setOneLiner(e.target.value);
                  updateContext();
                }}
                placeholder="An AI tool that helps founders detect unclear messaging…"
                className="mt-1 w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
              />
            </div>

            <div>
              <label className="text-xs text-white/70">Target user</label>
              <select
                value={targetUser}
                onChange={(e) => {
                  setTargetUser(e.target.value);
                  updateContext();
                }}
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
                  onChange={(e) => {
                    setTargetUserOther(e.target.value);
                    updateContext();
                  }}
                  placeholder="Type your target user…"
                  className="mt-2 w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
                />
              )}
            </div>

            <div>
              <label className="text-xs text-white/70">Tone preference</label>
              <select
                value={tonePreference}
                onChange={(e) => {
                  setTonePreference(e.target.value);
                  updateContext();
                }}
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
                onChange={(e) => {
                  setDomain(e.target.value);
                  updateContext();
                }}
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
                  onChange={(e) => {
                    setDomainOther(e.target.value);
                    updateContext();
                  }}
                  placeholder="Type your domain…"
                  className="mt-2 w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
                />
              )}
            </div>

            <div>
              <label className="text-xs text-white/70">Time limit</label>
              <select
                value={timeLimit}
                onChange={(e) => {
                  setTimeLimit(e.target.value);
                  updateContext();
                }}
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
                        if (prev.includes(m)) {
                          const newMetrics = prev.filter((x) => x !== m);
                          updateContext();
                          return newMetrics;
                        }
                        if (prev.length >= 2) return prev;
                        const newMetrics = [...prev, m];
                        updateContext();
                        return newMetrics;
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

          {!isValid && (
            <div className="mt-3 text-xs text-amber-200">
              Please fill the required fields (mode, audience, goal) or collapse this section to continue.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
