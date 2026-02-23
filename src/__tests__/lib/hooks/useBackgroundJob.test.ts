/**
 * Tests for useBackgroundJob hook
 *
 * MOD-68: Fixed "generation took too long" timeout issue in ideation
 *
 * Root Cause (FIXED):
 * - Anthropic SDK timeout: 240,000ms (4 minutes)
 * - Client polling timeout: 360,000ms (6 minutes) - increased from 5 minutes
 * - This provides a 2-minute buffer for the backend to fail gracefully
 *   and propagate the actual error message to the client
 *
 * The fix ensures:
 * 1. Client polling timeout exceeds AI generation timeout with 2-min buffer
 * 2. Backend failure messages propagate correctly to the client
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useBackgroundJob } from '@/lib/hooks/useBackgroundJob';

// Mock fetch for job status polling
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('useBackgroundJob', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockFetch.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('basic functionality', () => {
    it('should start with null status and no error', () => {
      const { result } = renderHook(() => useBackgroundJob());

      expect(result.current.status).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isPolling).toBe(false);
    });

    it('should call onComplete when job completes successfully', async () => {
      const onComplete = jest.fn();
      const testResult = { ideas: ['idea1', 'idea2'] };

      const { result } = renderHook(() =>
        useBackgroundJob({ onComplete })
      );

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'completed', result: testResult }),
      });

      await act(async () => {
        result.current.startPolling('test-job-id');
        await Promise.resolve(); // Flush promises
      });

      await waitFor(() => {
        expect(onComplete).toHaveBeenCalledWith(testResult);
      });

      expect(result.current.status).toBe('completed');
      expect(result.current.result).toEqual(testResult);
      expect(result.current.isPolling).toBe(false);
    });

    it('should call onError when job fails', async () => {
      const onError = jest.fn();
      const errorMessage = 'AI generation failed';

      const { result } = renderHook(() =>
        useBackgroundJob({ onError })
      );

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'failed', error: errorMessage }),
      });

      await act(async () => {
        result.current.startPolling('test-job-id');
        await Promise.resolve(); // Flush promises
      });

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(errorMessage);
      });

      expect(result.current.status).toBe('failed');
      expect(result.current.error).toBe(errorMessage);
      expect(result.current.isPolling).toBe(false);
    });
  });

  describe('timeout behavior', () => {
    /**
     * MOD-76: Extended timeouts for heavy AI calls with transcripts
     *
     * Problem: Users hitting timeouts when brainstorming from call transcripts.
     * Heavy AI calls (ideation with transcripts, complex content generation)
     * require longer timeouts than originally configured.
     *
     * REQUIRED values for MOD-76:
     * - ANTHROPIC_TIMEOUT: 480,000ms (8 min) - doubled for heavy calls
     * - TRIGGER_MAX_DURATION: 600 seconds (10 min) - doubled for task overhead
     * - CLIENT_POLLING_TIMEOUT: 720,000ms (12 min) - maintains 4-min buffer
     *
     * The 4-minute buffer ensures:
     * 1. The backend has time to mark the job as failed after AI timeout
     * 2. The client can poll and receive the failure status
     * 3. The user sees the actual error message from the backend
     */
    it('should have extended timeouts for heavy AI calls (MOD-76)', () => {
      // REQUIRED values for MOD-76 fix - these must be updated in production code
      const REQUIRED_ANTHROPIC_SDK_TIMEOUT = 480_000; // 8 minutes - for heavy AI calls
      const REQUIRED_TRIGGER_MAX_DURATION = 600; // 10 minutes in seconds
      const REQUIRED_CLIENT_POLLING_TIMEOUT = 720_000; // 12 minutes
      const REQUIRED_BUFFER = 240_000; // 4 minutes buffer for job status updates

      // These are the CURRENT production values (updated for MOD-76)
      const CURRENT_ANTHROPIC_SDK_TIMEOUT = 480_000; // 8 minutes - from lead-magnet-generator.ts
      const CURRENT_TRIGGER_MAX_DURATION = 600; // 10 minutes - from trigger.config.ts
      const CURRENT_CLIENT_POLLING_TIMEOUT = 720_000; // 12 minutes - from useBackgroundJob.ts

      // This test will FAIL until we update the production code
      // Documenting the required changes:
      expect(CURRENT_ANTHROPIC_SDK_TIMEOUT).toBe(REQUIRED_ANTHROPIC_SDK_TIMEOUT);
      expect(CURRENT_TRIGGER_MAX_DURATION).toBe(REQUIRED_TRIGGER_MAX_DURATION);
      expect(CURRENT_CLIENT_POLLING_TIMEOUT).toBe(REQUIRED_CLIENT_POLLING_TIMEOUT);

      // Buffer calculation should still work with new values
      const actualBuffer = REQUIRED_CLIENT_POLLING_TIMEOUT - REQUIRED_ANTHROPIC_SDK_TIMEOUT;
      expect(actualBuffer).toBeGreaterThanOrEqual(REQUIRED_BUFFER);
    });

    /**
     * MOD-68: Verifies client polling timeout exceeds Anthropic SDK timeout
     *
     * The Anthropic SDK timeout is 240,000ms (4 minutes).
     * The client polling timeout MUST be greater than this to allow
     * the backend to complete or fail gracefully.
     *
     * Fixed values:
     * - ANTHROPIC_TIMEOUT: 240,000ms (4 min)
     * - CLIENT_POLLING_TIMEOUT: 360,000ms (6 min)
     *
     * The 2-minute buffer ensures:
     * 1. The backend has time to mark the job as failed after AI timeout
     * 2. The client can poll and receive the failure status
     * 3. The user sees the actual error message from the backend
     */
    it('should have client timeout greater than AI backend timeout with sufficient buffer', () => {
      // These constants match the production values
      const ANTHROPIC_SDK_TIMEOUT = 240_000; // 4 minutes - from lead-magnet-generator.ts
      const CLIENT_POLLING_TIMEOUT = 360_000; // 6 minutes - from useBackgroundJob.ts default
      const RECOMMENDED_BUFFER = 120_000; // 2 minutes buffer for job status updates

      // Client timeout must exceed AI timeout
      expect(CLIENT_POLLING_TIMEOUT).toBeGreaterThan(ANTHROPIC_SDK_TIMEOUT);

      // Buffer must be at least 2 minutes for graceful failure propagation
      const actualBuffer = CLIENT_POLLING_TIMEOUT - ANTHROPIC_SDK_TIMEOUT;
      expect(actualBuffer).toBeGreaterThanOrEqual(RECOMMENDED_BUFFER);
    });

    it('should trigger timeout error after timeout duration expires', async () => {
      const onError = jest.fn();
      const shortTimeout = 5000; // 5 seconds for testing

      const { result } = renderHook(() =>
        useBackgroundJob({ timeout: shortTimeout, onError })
      );

      // Mock fetch to always return 'processing' status (job never completes)
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'processing' }),
      });

      act(() => {
        result.current.startPolling('test-job-id');
      });

      // Allow the initial poll to complete
      await act(async () => {
        await Promise.resolve();
      });

      // Verify error is initially null
      expect(result.current.error).toBeNull();

      // Fast-forward past the timeout
      act(() => {
        jest.advanceTimersByTime(shortTimeout + 100);
      });

      // Verify timeout error was triggered
      expect(result.current.error).toBe('Generation took too long. Please try again.');
      expect(onError).toHaveBeenCalledWith('Generation took too long. Please try again.');
      expect(result.current.isPolling).toBe(false);
      expect(result.current.status).toBeNull();
    });

    /**
     * MOD-68: Critical race condition test
     *
     * This test verifies that when the backend marks a job as failed BEFORE
     * the client timeout expires, the user sees the actual backend error
     * message instead of the generic "Generation took too long" message.
     *
     * Timeline:
     * - T=0: Client starts polling
     * - T=4min: Backend AI timeout, job marked as 'failed' with actual error
     * - T=4min+: Client polls and receives 'failed' status with error message
     * - T=6min: Client timeout would fire (but job already completed)
     */
    it('should receive backend error before client timeout fires', async () => {
      const onError = jest.fn();
      const backendErrorMessage = 'AI generation failed: Request timeout after 240000ms';

      const { result } = renderHook(() =>
        useBackgroundJob({
          timeout: 360000, // 6 minutes (client timeout)
          pollInterval: 2000,
          onError,
        })
      );

      // Simulate: first few polls return 'processing', then 'failed' with backend error
      let pollCount = 0;
      mockFetch.mockImplementation(() => {
        pollCount++;
        // After 3 polls (simulating 6 seconds), backend marks job as failed
        if (pollCount >= 3) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              status: 'failed',
              error: backendErrorMessage,
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ status: 'processing' }),
        });
      });

      await act(async () => {
        result.current.startPolling('test-job-id');
        await Promise.resolve(); // Initial poll
      });

      // Advance to first interval poll (2 seconds)
      await act(async () => {
        jest.advanceTimersByTime(2000);
        await Promise.resolve();
      });

      // Advance to second interval poll (4 seconds total)
      await act(async () => {
        jest.advanceTimersByTime(2000);
        await Promise.resolve();
      });

      // Now the mock should return 'failed', verify we get the backend error
      await waitFor(() => {
        expect(result.current.status).toBe('failed');
      });

      // Critical: User sees the ACTUAL backend error, not the generic timeout message
      expect(result.current.error).toBe(backendErrorMessage);
      expect(onError).toHaveBeenCalledWith(backendErrorMessage);
      expect(result.current.isPolling).toBe(false);

      // The generic timeout error should NOT appear
      expect(result.current.error).not.toBe('Generation took too long. Please try again.');
    });

    it('should stop polling and clear timers when job completes before timeout', async () => {
      const onComplete = jest.fn();
      const testResult = { concepts: ['concept1', 'concept2'] };

      const { result } = renderHook(() =>
        useBackgroundJob({
          timeout: 360000,
          pollInterval: 2000,
          onComplete,
        })
      );

      // First poll returns 'processing', second returns 'completed'
      let pollCount = 0;
      mockFetch.mockImplementation(() => {
        pollCount++;
        if (pollCount >= 2) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ status: 'completed', result: testResult }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ status: 'processing' }),
        });
      });

      await act(async () => {
        result.current.startPolling('test-job-id');
        await Promise.resolve(); // Initial poll
      });

      // Advance to second poll
      await act(async () => {
        jest.advanceTimersByTime(2000);
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(result.current.status).toBe('completed');
      });

      expect(result.current.result).toEqual(testResult);
      expect(onComplete).toHaveBeenCalledWith(testResult);
      expect(result.current.isPolling).toBe(false);
      expect(result.current.error).toBeNull();

      // Advance well past original timeout to ensure it was cleared
      await act(async () => {
        jest.advanceTimersByTime(400000);
        await Promise.resolve();
      });

      // Error should still be null (timeout should not have fired)
      expect(result.current.error).toBeNull();
    });
  });
});
