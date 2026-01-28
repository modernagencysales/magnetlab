import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';
import crypto from 'crypto';

// Add globals for Node.js test environment
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// crypto.subtle needs special handling in Node.js
if (!global.crypto) {
  global.crypto = crypto.webcrypto;
}

// Polyfill AbortSignal.timeout for Node.js versions that don't have it
if (!AbortSignal.timeout) {
  AbortSignal.timeout = (ms) => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), ms);
    return controller.signal;
  };
}

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(),
  }),
  usePathname: () => '',
}));

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

// Mock fetch globally
global.fetch = jest.fn();

// Mock trigger.dev SDK to avoid ESM import issues
jest.mock('@trigger.dev/sdk', () => ({
  tasks: {
    trigger: jest.fn().mockResolvedValue({ id: 'mock-run-id' }),
    batchTrigger: jest.fn().mockResolvedValue([]),
  },
  configure: jest.fn(),
  task: jest.fn((config) => config),
}));

// Mock the email sequence trigger service
jest.mock('@/lib/services/email-sequence-trigger', () => ({
  triggerWelcomeSequence: jest.fn().mockResolvedValue(undefined),
  triggerEmailSequenceIfActive: jest.fn().mockResolvedValue(undefined),
}));

// Reset mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});
