'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageSquarePlus, Bug, Lightbulb, MessageCircle, X, Check, Loader2 } from 'lucide-react';
import type { FeedbackType, BugSeverity, FeedbackPayload, FeedbackResponse } from './types';

interface FeedbackWidgetProps {
  userEmail: string | null;
  userId: string | null;
}

const APP_NAME = 'MagnetLab';
const APP_VERSION = '1.0.0';

const TYPE_OPTIONS: { value: FeedbackType; label: string; icon: typeof Bug }[] = [
  { value: 'bug', label: 'Bug', icon: Bug },
  { value: 'feature', label: 'Feature', icon: Lightbulb },
  { value: 'feedback', label: 'Feedback', icon: MessageCircle },
];

const SEVERITY_OPTIONS: { value: BugSeverity; label: string }[] = [
  { value: 'critical', label: "I can't use the app" },
  { value: 'high', label: "It's really annoying" },
  { value: 'medium', label: "It's a minor issue" },
  { value: 'low', label: 'Just a suggestion' },
];

function getBrowserInfo(): string {
  if (typeof navigator === 'undefined') return 'Unknown';
  const ua = navigator.userAgent;
  if (ua.includes('Firefox/')) return `Firefox ${ua.split('Firefox/')[1]?.split(' ')[0]}`;
  if (ua.includes('Edg/')) return `Edge ${ua.split('Edg/')[1]?.split(' ')[0]}`;
  if (ua.includes('Chrome/')) return `Chrome ${ua.split('Chrome/')[1]?.split(' ')[0]}`;
  if (ua.includes('Safari/') && !ua.includes('Chrome')) return `Safari ${ua.split('Version/')[1]?.split(' ')[0] ?? ''}`;
  return ua.slice(0, 50);
}

function getOSInfo(): string {
  if (typeof navigator === 'undefined') return 'Unknown';
  const ua = navigator.userAgent;
  if (ua.includes('Mac OS X')) return `macOS ${ua.match(/Mac OS X ([0-9_]+)/)?.[1]?.replace(/_/g, '.') ?? ''}`;
  if (ua.includes('Windows NT')) return `Windows ${ua.match(/Windows NT ([0-9.]+)/)?.[1] ?? ''}`;
  if (ua.includes('Linux')) return 'Linux';
  if (ua.includes('Android')) return `Android ${ua.match(/Android ([0-9.]+)/)?.[1] ?? ''}`;
  if (ua.includes('iPhone') || ua.includes('iPad')) return `iOS ${ua.match(/OS ([0-9_]+)/)?.[1]?.replace(/_/g, '.') ?? ''}`;
  return 'Unknown';
}

function getScreenResolution(): string {
  if (typeof window === 'undefined') return 'Unknown';
  return `${window.screen.width}x${window.screen.height}`;
}

export function FeedbackWidget({ userEmail, userId }: FeedbackWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>('bug');
  const [severity, setSeverity] = useState<BugSeverity>('medium');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const resetForm = useCallback(() => {
    setType('bug');
    setSeverity('medium');
    setTitle('');
    setDescription('');
    setStatus('idle');
    setErrorMessage('');
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    resetForm();
  }, [resetForm]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, close]);

  // Focus title input when panel opens
  useEffect(() => {
    if (isOpen && status === 'idle') {
      requestAnimationFrame(() => titleInputRef.current?.focus());
    }
  }, [isOpen, status]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        close();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen, close]);

  // Auto-close after success
  useEffect(() => {
    if (status !== 'success') return;
    const timer = setTimeout(close, 2000);
    return () => clearTimeout(timer);
  }, [status, close]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    setStatus('submitting');
    setErrorMessage('');

    const payload: FeedbackPayload = {
      type,
      severity: type === 'bug' ? severity : undefined,
      title: title.trim(),
      description: description.trim(),
      metadata: {
        url: typeof window !== 'undefined' ? window.location.href : '',
        userEmail,
        userId,
        browser: getBrowserInfo(),
        os: getOSInfo(),
        screenResolution: getScreenResolution(),
        appName: APP_NAME,
        appVersion: APP_VERSION,
        timestamp: new Date().toISOString(),
      },
    };

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setStatus('error');
        setErrorMessage(data?.error ?? 'Something went wrong. Please try again.');
        return;
      }

      const data: FeedbackResponse = await res.json();

      if (data.success) {
        setStatus('success');
      } else {
        setStatus('error');
        setErrorMessage(data.error ?? 'Something went wrong. Please try again.');
      }
    } catch {
      setStatus('error');
      setErrorMessage('Failed to send feedback. Please try again.');
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        ref={buttonRef}
        onClick={() => {
          if (isOpen) {
            close();
          } else {
            setIsOpen(true);
          }
        }}
        className="fixed bottom-6 right-6 z-[9999] flex h-12 w-12 items-center justify-center rounded-full bg-violet-600 text-white shadow-lg transition-all hover:bg-violet-500 hover:shadow-xl active:scale-95"
        aria-label="Send feedback"
      >
        {isOpen ? <X className="h-5 w-5" /> : <MessageSquarePlus className="h-5 w-5" />}
      </button>

      {/* Panel */}
      {isOpen && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Send feedback"
          className="fixed bottom-20 right-6 z-[9999] w-[380px] max-w-[calc(100vw-3rem)] animate-in slide-in-from-bottom-2 fade-in duration-200 rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl"
        >
          {/* Success state */}
          {status === 'success' ? (
            <div className="flex flex-col items-center justify-center gap-3 p-10">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/20">
                <Check className="h-6 w-6 text-green-400" />
              </div>
              <p className="text-sm font-medium text-zinc-200">Feedback sent!</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-zinc-100">Send Feedback</h3>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close feedback"
                  className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Type toggle */}
              <div className="flex gap-1 rounded-lg bg-zinc-800 p-1">
                {TYPE_OPTIONS.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setType(value)}
                    aria-pressed={type === value}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                      type === value
                        ? 'bg-violet-600 text-white shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </div>

              {/* Severity (bugs only) */}
              {type === 'bug' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-zinc-400">
                    How much does this block you?
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {SEVERITY_OPTIONS.map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setSeverity(value)}
                        aria-pressed={severity === value}
                        className={`rounded-md px-2.5 py-1.5 text-xs transition-all ${
                          severity === value
                            ? 'bg-violet-600/20 text-violet-300 ring-1 ring-violet-500/50'
                            : 'bg-zinc-800 text-zinc-400 hover:text-zinc-300'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Title */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="feedback-title" className="text-xs font-medium text-zinc-400">
                  Title
                </label>
                <input
                  ref={titleInputRef}
                  id="feedback-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value.slice(0, 120))}
                  placeholder={
                    type === 'bug'
                      ? 'What went wrong?'
                      : type === 'feature'
                        ? "What's missing?"
                        : 'What do you think?'
                  }
                  required
                  maxLength={120}
                  className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition-colors focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50"
                />
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="feedback-description" className="text-xs font-medium text-zinc-400">
                  Description
                </label>
                <textarea
                  id="feedback-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, 2000))}
                  placeholder="Tell us more..."
                  required
                  maxLength={2000}
                  rows={4}
                  className="resize-none rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition-colors focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50"
                />
                <span className="text-right text-[10px] text-zinc-500">
                  {description.length}/2000
                </span>
              </div>

              {/* Error */}
              {status === 'error' && (
                <p className="rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-400">
                  {errorMessage}
                </p>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={status === 'submitting' || !title.trim() || !description.trim()}
                className="flex items-center justify-center gap-2 rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {status === 'submitting' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send Feedback'
                )}
              </button>
            </form>
          )}
        </div>
      )}
    </>
  );
}
