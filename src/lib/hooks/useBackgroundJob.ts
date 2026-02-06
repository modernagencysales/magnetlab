'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { JobStatus, JobStatusResponse } from '@/lib/types/background-jobs';

interface UseBackgroundJobOptions<TResult> {
  /** Polling interval in ms (default: 2000) */
  pollInterval?: number;
  /** Stop polling after this many ms (default: 300000 = 5 min) */
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
}

export function useBackgroundJob<TResult = unknown>(
  options: UseBackgroundJobOptions<TResult> = {}
): UseBackgroundJobReturn<TResult> {
  const {
    pollInterval = 2000,
    timeout = 300000,
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
      console.error('Poll error:', err);
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
  };
}
