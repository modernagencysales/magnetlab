'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Magnet, Mic, X } from 'lucide-react';

const DISMISS_KEY = 'magnetlab_welcome_dismissed';

interface WelcomeModalProps {
  isNewUser: boolean;
}

export function WelcomeModal({ isNewUser }: WelcomeModalProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isNewUser) return;
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (!dismissed) {
      setShow(true);
    }
  }, [isNewUser]);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, 'true');
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Welcome to MagnetLab">
      <div className="relative mx-4 w-full max-w-lg rounded-2xl border bg-card p-8 shadow-2xl">
        {/* Close button */}
        <button
          onClick={dismiss}
          className="absolute right-4 top-4 rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
            <Magnet className="h-8 w-8 text-primary-foreground" />
          </div>
          <h2 className="text-2xl font-bold">Welcome to MagnetLab</h2>
          <p className="mt-2 text-muted-foreground">
            Turn your expertise into LinkedIn content that attracts clients
          </p>
        </div>

        {/* Two paths */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <Link
            href="/create"
            onClick={dismiss}
            className="group rounded-xl border p-5 transition-all hover:border-primary hover:shadow-lg"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Magnet className="h-5 w-5 text-primary" />
            </div>
            <h3 className="mb-1 font-semibold group-hover:text-primary">
              Create a Lead Magnet
            </h3>
            <p className="text-sm text-muted-foreground">
              Extract your unique expertise into a high-converting lead magnet
            </p>
          </Link>

          <Link
            href="/knowledge"
            onClick={dismiss}
            className="group rounded-xl border p-5 transition-all hover:border-primary hover:shadow-lg"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Mic className="h-5 w-5 text-primary" />
            </div>
            <h3 className="mb-1 font-semibold group-hover:text-primary">
              Import Call Transcripts
            </h3>
            <p className="text-sm text-muted-foreground">
              Let AI extract content ideas from your sales and coaching calls
            </p>
          </Link>
        </div>

        {/* Skip link */}
        <div className="text-center">
          <button
            onClick={dismiss}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
