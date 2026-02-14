'use client';

import { useEffect, useState } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

const TOUR_COMPLETED_KEY = 'magnetlab_tour_completed';

interface ProductTourProps {
  isNewUser: boolean;
}

export function ProductTour({ isNewUser }: ProductTourProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !isNewUser) return;
    if (localStorage.getItem(TOUR_COMPLETED_KEY)) return;

    // Small delay to let the sidebar render
    const timer = setTimeout(() => {
      const driverObj = driver({
        showProgress: true,
        animate: true,
        overlayColor: 'rgba(0, 0, 0, 0.6)',
        popoverClass: 'magnetlab-tour-popover',
        steps: [
          {
            element: '[data-tour="home"]',
            popover: {
              title: 'Welcome to MagnetLab!',
              description: 'This is your command center. See real-time metrics, track leads, and access quick actions. Start with the getting started checklist to set up your first lead magnet.',
              side: 'right',
              align: 'start',
            },
          },
          {
            element: '[data-tour="magnets"]',
            popover: {
              title: 'Create Your First Lead Magnet',
              description: 'Use the 6-step AI wizard to extract your expertise and turn it into a lead magnet. The AI handles content generation, post writing, and email sequences.',
              side: 'right',
              align: 'start',
            },
          },
          {
            element: '[data-tour="knowledge"]',
            popover: {
              title: 'Build Your AI Brain',
              description: 'Connect Grain or Fireflies to auto-import call transcripts. The AI extracts insights, customer questions, and story angles — powering smarter content across the platform.',
              side: 'right',
              align: 'start',
            },
          },
          {
            element: '[data-tour="posts"]',
            popover: {
              title: 'Content Pipeline & Autopilot',
              description: 'Turn ideas into LinkedIn posts with AI assistance. Set up autopilot to automatically generate and schedule posts from your knowledge base — hands-free content creation.',
              side: 'right',
              align: 'start',
            },
          },
          {
            element: '[data-tour="leads"]',
            popover: {
              title: 'Track & Manage Leads',
              description: 'Every opt-in from your funnel pages appears here. View analytics, export leads, and see which lead magnets drive the most conversions from the analytics dashboard.',
              side: 'right',
              align: 'start',
            },
          },
        ],
        onDestroyStarted: () => {
          localStorage.setItem(TOUR_COMPLETED_KEY, 'true');
          driverObj.destroy();
        },
      });

      driverObj.drive();
    }, 1000);

    return () => clearTimeout(timer);
  }, [mounted, isNewUser]);

  return null;
}
