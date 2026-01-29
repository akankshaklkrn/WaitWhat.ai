'use client';

import Image from 'next/image';
import { motion, useScroll, useTransform } from 'framer-motion';

export default function StickyHeader() {
  const { scrollYProgress } = useScroll();

  // Header becomes visible as hero fades
  const headerOpacity = useTransform(scrollYProgress, 
    [0.15, 0.2, 0.25], 
    [0, 0, 1]
  );
  const blurOpacity = useTransform(scrollYProgress, 
    [0.2, 0.25], 
    [0, 0.35]
  );

  return (
    <motion.div 
      className="fixed left-0 top-0 z-50 w-full" 
      style={{ opacity: headerOpacity }}
    >
      <div className="relative mx-auto flex w-full items-center justify-between px-6 py-4">
        <motion.div
          className="absolute inset-0 backdrop-blur-xl"
          style={{ opacity: blurOpacity }}
        />
        <div className="relative z-10 flex items-center gap-3">
          <div className="h-10 w-10 overflow-hidden rounded-full border border-white/10 bg-white/5">
            <Image 
              src="/logo.png" 
              alt="Wait What?!?" 
              width={40} 
              height={40} 
              className="scale-110"
            />
          </div>
          <div className="text-white">
            <div className="text-lg font-semibold leading-none">Wait What?!?</div>
            <div className="text-xs text-white/60">Clarity feedback for demos & pitches</div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
