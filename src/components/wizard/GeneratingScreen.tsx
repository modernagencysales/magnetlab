'use client';

import { motion } from 'framer-motion';
import { Sparkles, Brain, Lightbulb, Target, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';

const LOADING_MESSAGES = [
  { icon: Brain, text: 'Analyzing your expertise...' },
  { icon: Target, text: 'Understanding your audience...' },
  { icon: Lightbulb, text: 'Brainstorming unique angles...' },
  { icon: Zap, text: 'Checking viral potential...' },
  { icon: Sparkles, text: 'Crafting 10 lead magnet ideas...' },
];

export function GeneratingScreen() {
  const [messageIndex, setMessageIndex] = useState(0);
  const [progressDone, setProgressDone] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const currentMessage = LOADING_MESSAGES[messageIndex];
  const Icon = currentMessage.icon;

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-center"
      >
        {/* Animated icon */}
        <div className="relative mx-auto mb-8 h-24 w-24">
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              rotate: [0, 5, -5, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="flex h-24 w-24 items-center justify-center rounded-2xl bg-primary/10"
          >
            <Icon className="h-12 w-12 text-primary" />
          </motion.div>

          {/* Orbiting dots */}
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="absolute h-3 w-3 rounded-full bg-primary"
              animate={{
                rotate: 360,
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: 'linear',
                delay: i * 1,
              }}
              style={{
                top: '50%',
                left: '50%',
                transformOrigin: '0 -50px',
              }}
            />
          ))}
        </div>

        <motion.h2
          key={messageIndex}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="mb-4 text-2xl font-bold"
        >
          {currentMessage.text}
        </motion.h2>

        <p className="text-muted-foreground">
          {progressDone ? 'Almost there — finalizing your ideas...' : 'This usually takes 1-2 minutes'}
        </p>

        {/* Progress bar */}
        <div className="relative mx-auto mt-8 h-1.5 w-64 overflow-hidden rounded-full bg-muted">
          <motion.div
            className="absolute inset-0 bg-primary"
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{
              duration: 90,
              ease: 'linear',
            }}
            onAnimationComplete={() => setProgressDone(true)}
          />
          {progressDone && (
            <motion.div
              className="absolute inset-0 bg-primary"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
        </div>

        <p className="mt-6 max-w-md text-sm text-muted-foreground">
          We&apos;re using AI to generate 10 unique lead magnet concepts based on your
          specific expertise. Each one is designed to attract your ideal clients.
        </p>
      </motion.div>
    </div>
  );
}
