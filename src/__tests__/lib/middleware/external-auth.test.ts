/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { authenticateExternal } from '@/lib/middleware/external-auth'

// Mock service-auth so we can control HMAC verification behavior
jest.mock('@/lib/auth/service-auth', () => ({
  verifyServiceSignature: jest.fn().mockReturnValue(true),
  isTimestampValid: jest.fn().mockReturnValue(true),
}))

const ORIGINAL_ENV = process.env

describe('authenticateExternal — Bearer token fallback', () => {
  beforeEach(() => {
    process.env = {
      ...ORIGINAL_ENV,
      EXTERNAL_API_KEY: 'test-external-api-key-abc123',
      GTM_SERVICE_SECRET: 'test-service-secret',
    }
    jest.clearAllMocks()
  })

  afterEach(() => {
    process.env = ORIGINAL_ENV
  })

  describe('Bearer token fallback (HMAC headers missing)', () => {
    it('succeeds with valid Bearer token + x-gtm-user-id', async () => {
      const request = new NextRequest('http://localhost:3000/api/external/lead-magnets', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-external-api-key-abc123',
          'x-gtm-user-id': 'user-123',
        },
        body: JSON.stringify({ test: true }),
      })

      const result = await authenticateExternal(request)

      // Should return an auth context, not a NextResponse
      expect(result).not.toBeInstanceOf(NextResponse)
      expect(result).toEqual({
        userId: 'user-123',
        serviceId: 'bearer-token',
      })
    })

    it('rejects with invalid Bearer token', async () => {
      const request = new NextRequest('http://localhost:3000/api/external/lead-magnets', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer wrong-token',
          'x-gtm-user-id': 'user-123',
        },
        body: JSON.stringify({ test: true }),
      })

      const result = await authenticateExternal(request)

      expect(result).toBeInstanceOf(NextResponse)
      const response = result as NextResponse
      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.error).toBe('Missing required headers')
    })

    it('rejects with valid Bearer token but no x-gtm-user-id', async () => {
      const request = new NextRequest('http://localhost:3000/api/external/lead-magnets', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-external-api-key-abc123',
        },
        body: JSON.stringify({ test: true }),
      })

      const result = await authenticateExternal(request)

      expect(result).toBeInstanceOf(NextResponse)
      const response = result as NextResponse
      expect(response.status).toBe(401)
    })

    it('rejects when EXTERNAL_API_KEY env var is not set', async () => {
      delete process.env.EXTERNAL_API_KEY

      const request = new NextRequest('http://localhost:3000/api/external/lead-magnets', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-external-api-key-abc123',
          'x-gtm-user-id': 'user-123',
        },
        body: JSON.stringify({ test: true }),
      })

      const result = await authenticateExternal(request)

      expect(result).toBeInstanceOf(NextResponse)
      const response = result as NextResponse
      expect(response.status).toBe(401)
    })

    it('rejects with empty Bearer token', async () => {
      const request = new NextRequest('http://localhost:3000/api/external/lead-magnets', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer ',
          'x-gtm-user-id': 'user-123',
        },
        body: JSON.stringify({ test: true }),
      })

      const result = await authenticateExternal(request)

      expect(result).toBeInstanceOf(NextResponse)
      const response = result as NextResponse
      expect(response.status).toBe(401)
    })

    it('rejects with non-Bearer auth scheme', async () => {
      const request = new NextRequest('http://localhost:3000/api/external/lead-magnets', {
        method: 'POST',
        headers: {
          'authorization': 'Basic abc123',
          'x-gtm-user-id': 'user-123',
        },
        body: JSON.stringify({ test: true }),
      })

      const result = await authenticateExternal(request)

      expect(result).toBeInstanceOf(NextResponse)
      const response = result as NextResponse
      expect(response.status).toBe(401)
    })
  })

  describe('HMAC auth (original flow)', () => {
    it('succeeds with valid HMAC headers', async () => {
      const timestamp = Math.floor(Date.now() / 1000).toString()

      const request = new NextRequest('http://localhost:3000/api/external/lead-magnets', {
        method: 'POST',
        headers: {
          'x-gtm-signature': 'valid-sig',
          'x-gtm-timestamp': timestamp,
          'x-gtm-user-id': 'user-456',
          'x-gtm-service-id': 'gtm-system',
        },
        body: JSON.stringify({ test: true }),
      })

      const result = await authenticateExternal(request)

      expect(result).not.toBeInstanceOf(NextResponse)
      expect(result).toEqual({
        userId: 'user-456',
        serviceId: 'gtm-system',
      })
    })

    it('rejects with expired timestamp', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { isTimestampValid } = require('@/lib/auth/service-auth')
      ;(isTimestampValid as jest.Mock).mockReturnValueOnce(false)

      const request = new NextRequest('http://localhost:3000/api/external/lead-magnets', {
        method: 'POST',
        headers: {
          'x-gtm-signature': 'valid-sig',
          'x-gtm-timestamp': '1000000',
          'x-gtm-user-id': 'user-456',
          'x-gtm-service-id': 'gtm-system',
        },
        body: JSON.stringify({ test: true }),
      })

      const result = await authenticateExternal(request)

      expect(result).toBeInstanceOf(NextResponse)
      const response = result as NextResponse
      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.error).toBe('Request timestamp expired')
    })

    it('rejects with invalid signature', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { verifyServiceSignature } = require('@/lib/auth/service-auth')
      ;(verifyServiceSignature as jest.Mock).mockReturnValueOnce(false)

      const timestamp = Math.floor(Date.now() / 1000).toString()

      const request = new NextRequest('http://localhost:3000/api/external/lead-magnets', {
        method: 'POST',
        headers: {
          'x-gtm-signature': 'bad-sig',
          'x-gtm-timestamp': timestamp,
          'x-gtm-user-id': 'user-456',
          'x-gtm-service-id': 'gtm-system',
        },
        body: JSON.stringify({ test: true }),
      })

      const result = await authenticateExternal(request)

      expect(result).toBeInstanceOf(NextResponse)
      const response = result as NextResponse
      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.error).toBe('Invalid signature')
    })
  })

  describe('HMAC takes priority over Bearer', () => {
    it('uses HMAC when all HMAC headers are present (even if Bearer is also present)', async () => {
      const timestamp = Math.floor(Date.now() / 1000).toString()

      const request = new NextRequest('http://localhost:3000/api/external/lead-magnets', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-external-api-key-abc123',
          'x-gtm-signature': 'valid-sig',
          'x-gtm-timestamp': timestamp,
          'x-gtm-user-id': 'user-789',
          'x-gtm-service-id': 'gtm-system',
        },
        body: JSON.stringify({ test: true }),
      })

      const result = await authenticateExternal(request)

      expect(result).not.toBeInstanceOf(NextResponse)
      // Should use HMAC serviceId, not 'bearer-token'
      expect(result).toEqual({
        userId: 'user-789',
        serviceId: 'gtm-system',
      })
    })
  })

  describe('no auth at all', () => {
    it('rejects with no headers at all', async () => {
      const request = new NextRequest('http://localhost:3000/api/external/lead-magnets', {
        method: 'POST',
        body: JSON.stringify({ test: true }),
      })

      const result = await authenticateExternal(request)

      expect(result).toBeInstanceOf(NextResponse)
      const response = result as NextResponse
      expect(response.status).toBe(401)
    })
  })
})
