'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { JobStatus, JobStatusResponse } from '@/lib/types/background-jobs';
import { logError } from '@/lib/utils/logger';

interface UseBackgroundJobOptions<TResult> {
  /** Polling interval in ms (default: 2000) */
  pollInterval?: number;
  /** Stop polling after this many ms (default: 360000 = 6 min) */
  timeout?: number;
  /** Callback when job completes successfully */
  onComplete?: (result: TResult) => void;
  /** Callback when job fails */
  onError?: (error: string) => void;
}

interface UseBackgroundJobReturn<TResult> {
  status: JobStatus | null;
  result: TResult | null;
  error: string | null;
  isLoading: boolean;
  isPolling: boolean;
  startPolling: (jobId: string) => void;
  stopPolling: () => void;
  /** One-shot check: fetch job status once, fire callbacks if done, return true if still running */
  checkJob: (jobId: string) => Promise<boolean>;
}

export function useBackgroundJob<TResult = unknown>(
  options: UseBackgroundJobOptions<TResult> = {}
): UseBackgroundJobReturn<TResult> {
  const {
    pollInterval = 2000,
    // 12 minutes - provides 4-minute buffer after Anthropic SDK 8-minute timeout (MOD-76)
    timeout = 720000,
    onComplete,
    onError,
  } = options;

  const [status, setStatus] = useState<JobStatus | null>(null);
  const [result, setResult] = useState<TResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);

  // Keep callbacks fresh
  useEffect(() => {
    onCompleteRef.current = onComplete;
    onErrorRef.current = onError;
  }, [onComplete, onError]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsPolling(false);
  }, []);

  const pollStatus = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/jobs/${id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch job status');
      }

      const data: JobStatusResponse<TResult> = await response.json();
      setStatus(data.status);

      if (data.status === 'completed' && data.result) {
        setResult(data.result);
        stopPolling();
        onCompleteRef.current?.(data.result);
      } else if (data.status === 'failed') {
        setError(data.error || 'Job failed');
        stopPolling();
        onErrorRef.current?.(data.error || 'Job failed');
      }
    } catch (err) {
      logError('hooks/useBackgroundJob', err, { action: 'poll' });
      // Don't stop polling on network errors, just log
    }
  }, [stopPolling]);

  const startPolling = useCallback((id: string) => {
    // Reset state
    setStatus('pending');
    setResult(null);
    setError(null);
    setIsPolling(true);

    // Clear any existing intervals
    stopPolling();

    // Start polling
    intervalRef.current = setInterval(() => {
      pollStatus(id);
    }, pollInterval);

    // Set timeout
    timeoutRef.current = setTimeout(() => {
      stopPolling();
      setStatus(null);
      setError('Generation took too long. Please try again.');
      onErrorRef.current?.('Generation took too long. Please try again.');
    }, timeout);

    // Initial poll
    pollStatus(id);
  }, [pollInterval, timeout, pollStatus, stopPolling]);

  // One-shot check: returns true if job is still running (caller should start polling)
  const checkJob = useCallback(async (jobId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/jobs/${jobId}`);
      if (!response.ok) return false;

      const data: JobStatusResponse<TResult> = await response.json();
      setStatus(data.status);

      if (data.status === 'completed' && data.result) {
        setResult(data.result);
        onCompleteRef.current?.(data.result);
        return false;
      } else if (data.status === 'failed') {
        setError(data.error || 'Job failed');
        onErrorRef.current?.(data.error || 'Job failed');
        return false;
      }
      // Still pending/processing
      return true;
    } catch {
      return false;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  return {
    status,
    result,
    error,
    isLoading: status === 'pending' || status === 'processing',
    isPolling,
    startPolling,
    stopPolling,
    checkJob,
  };
}
