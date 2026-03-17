/** useCountUp — Animated counter that counts from 0 to target using requestAnimationFrame.
 * Respects prefers-reduced-motion. Never imports Next.js server modules. */
'use client';

import { useEffect, useState } from 'react';

export function useCountUp(target: number, isActive: boolean, duration = 1500): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isActive) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setCount(target);
      return;
    }

    let startTime: number | null = null;
    let frameId: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) {
        frameId = requestAnimationFrame(animate);
      }
    };

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [target, isActive, duration]);

  return count;
}
