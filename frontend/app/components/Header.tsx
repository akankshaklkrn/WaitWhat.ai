'use client';

import Image from 'next/image';
import Link from 'next/link';

export default function Header() {
  return (
    <div className="flex items-center gap-3">
      <div className="h-12 w-12 overflow-hidden rounded-full border border-white/10 bg-white/5">
        <Image
          src="/logo.png"
          alt="WaitWhat.ai"
          width={48}
          height={48}
          className="object-cover"
        />
      </div>
      <div className="text-white">
        <div className="text-xl font-semibold leading-none">
          Wait What?!?
        </div>
        <div className="text-sm text-white/60">
          Demo therapist
        </div>
      </div>
    </div>
  );
}
