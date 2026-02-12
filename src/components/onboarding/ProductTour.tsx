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
              title: 'Welcome Home',
              description: 'Your dashboard gives you an overview of activity, quick actions, and a getting started checklist.',
              side: 'right',
              align: 'start',
            },
          },
          {
            element: '[data-tour="magnets"]',
            popover: {
              title: 'Lead Magnets',
              description: 'Create and manage your AI-powered lead magnets here. Each one includes a funnel page, posts, and analytics.',
              side: 'right',
              align: 'start',
            },
          },
          {
            element: '[data-tour="pages"]',
            popover: {
              title: 'Pages',
              description: 'View all your funnel and opt-in pages in one place. See which ones are live and how many leads they\'ve captured.',
              side: 'right',
              align: 'start',
            },
          },
          {
            element: '[data-tour="knowledge"]',
            popover: {
              title: 'Knowledge',
              description: 'Import call transcripts and build your AI Brain. The AI extracts insights, questions, and stories from your conversations.',
              side: 'right',
              align: 'start',
            },
          },
          {
            element: '[data-tour="posts"]',
            popover: {
              title: 'Posts',
              description: 'Manage your content pipeline — from ideas to drafts to published posts. Set up autopilot to generate posts automatically.',
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
