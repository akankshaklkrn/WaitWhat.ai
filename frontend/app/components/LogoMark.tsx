import React from 'react';

type Props = {
  className?: string;
  title?: string;
};

export function LogoMark({ className, title = 'Wait What logo' }: Props) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="ww_grad" x1="12" y1="10" x2="52" y2="54" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2563EB" />
          <stop offset="0.55" stopColor="#7C3AED" />
          <stop offset="1" stopColor="#EC4899" />
        </linearGradient>
        <filter id="ww_glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.2" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.55 0"
            result="glow"
          />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Pause bars */}
      <g filter="url(#ww_glow)">
        <rect x="14" y="26" width="9" height="26" rx="4.5" fill="url(#ww_grad)" />
        <rect x="28" y="26" width="9" height="26" rx="4.5" fill="url(#ww_grad)" />

        {/* Question mark */}
        <path
          d="M42.5 47.5c0-2.9 1.9-4.5 4.6-6.1c2.7-1.7 4.9-3.7 4.9-7.1c0-5.8-4.7-9.6-11.1-9.6c-5.2 0-9.2 2.3-11 6.6c-.3.8.2 1.7 1.1 2l3.2 1.1c.8.3 1.7-.1 2-.9c1-2.4 2.6-3.4 4.8-3.4c2.6 0 4.4 1.4 4.4 3.6c0 1.7-1.2 2.7-3.2 4.0c-3.4 2.1-7.0 4.6-7.0 9.8v1.0h6.3v-1.0z"
          fill="url(#ww_grad)"
        />
        <circle cx="41.7" cy="54.2" r="3.2" fill="url(#ww_grad)" />
      </g>
    </svg>
  );
}

