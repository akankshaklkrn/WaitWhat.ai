'use client';

import Image from 'next/image';
import { motion, useScroll, useTransform } from 'framer-motion';

export default function IntroHero() {
  const { scrollYProgress } = useScroll();

  // Transform values for the hero section
  const heroOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0]);
  const heroY = useTransform(scrollYProgress, [0, 0.15], [0, 30]);

  // Transform values for the logo container
  const logoX = useTransform(scrollYProgress, [0, 0.2], ['0%', '-45vw']);
  const logoY = useTransform(scrollYProgress, [0, 0.2], ['0%', '-40vh']);
  const logoScale = useTransform(scrollYProgress, [0, 0.2], [1, 0.25]);
  const logoOpacity = useTransform(scrollYProgress, 
    [0, 0.15, 0.2, 0.25], 
    [1, 1, 0, 0]
  );

  return (
    <motion.section
      className="fixed inset-0 flex flex-col items-center justify-center px-6 text-center pointer-events-none"
      style={{ opacity: heroOpacity, y: heroY }}
    >
      <div className="flex flex-col items-center">
        <motion.div 
          className="relative h-64 w-64 overflow-hidden rounded-full border border-white/10 bg-white/5 shadow-2xl mb-8"
          style={{
            x: logoX,
            y: logoY,
            scale: logoScale,
            opacity: logoOpacity
          }}
        >
          <Image 
            src="/logo.png" 
            alt="Wait What?!?" 
            width={256} 
            height={256}
            className="scale-110"
            priority
          />
        </motion.div>

        <motion.div 
          className="space-y-6 max-w-3xl"
          style={{ opacity: heroOpacity }}
        >
          <div>
            {/* Logo/Product name - Inter SemiBold */}
            <h1 className="font-semibold text-6xl tracking-tight text-white mb-4">
              Wait What?!?
            </h1>
            {/* Subtitle - Inter Medium */}
            <p className="font-medium text-2xl text-white/80">
              AI-powered clarity feedback for demos and pitches
            </p>
          </div>

          {/* Body text - Inter Regular */}
          <p className="font-normal text-xl text-white/70 max-w-2xl mx-auto">
            Upload a demo or pitch. Get timestamped clarity fixes where your audience gets lost.
          </p>

          {/* Helper text - Inter Regular */}
          <div className="pt-8 text-base text-white/40 font-normal tracking-wide animate-bounce">
            See how it works ↓
          </div>
        </motion.div>
      </div>
    </motion.section>
  );
}
