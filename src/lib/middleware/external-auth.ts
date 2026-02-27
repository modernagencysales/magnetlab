import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { verifyServiceSignature, isTimestampValid } from '@/lib/auth/service-auth'

export interface ExternalAuthContext {
  userId: string
  serviceId: string
}

/**
 * Authenticate a request using Bearer token (EXTERNAL_API_KEY).
 * Uses timing-safe comparison to prevent timing attacks.
 * Returns true if the token is valid, false otherwise.
 */
function authenticateBearer(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false
  }

  const token = authHeader.slice(7)
  if (!token) {
    return false
  }

  const expectedKey = process.env.EXTERNAL_API_KEY
  if (!expectedKey) {
    return false
  }

  const tokenBuf = Buffer.from(token)
  const expectedBuf = Buffer.from(expectedKey)
  if (tokenBuf.length !== expectedBuf.length) {
    return false
  }

  return timingSafeEqual(tokenBuf, expectedBuf)
}

export async function authenticateExternal(
  request: NextRequest
): Promise<ExternalAuthContext | NextResponse> {
  const signature = request.headers.get('x-gtm-signature')
  const timestamp = request.headers.get('x-gtm-timestamp')
  const userId = request.headers.get('x-gtm-user-id')
  const serviceId = request.headers.get('x-gtm-service-id')

  if (!signature || !timestamp || !userId || !serviceId) {
    // HMAC headers missing — try Bearer token fallback
    // Requires valid Bearer token AND x-gtm-user-id header
    if (authenticateBearer(request) && userId) {
      return { userId, serviceId: 'bearer-token' }
    }

    return NextResponse.json(
      { error: 'Missing required headers' },
      { status: 401 }
    )
  }

  if (!isTimestampValid(timestamp)) {
    return NextResponse.json(
      { error: 'Request timestamp expired' },
      { status: 401 }
    )
  }

  // Extract method and path for signature verification
  const method = request.method
  const url = new URL(request.url)
  // Get the path after /api/external (e.g., /lead-magnets/123)
  const fullPath = url.pathname
  const externalPrefix = '/api/external'
  const path = fullPath.startsWith(externalPrefix)
    ? fullPath.slice(externalPrefix.length)
    : fullPath

  const body = await request.text()

  if (!verifyServiceSignature(method, path, body, timestamp, signature)) {
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 401 }
    )
  }

  return { userId, serviceId }
}

export function withExternalAuth(
  handler: (request: NextRequest, context: ExternalAuthContext, body: unknown) => Promise<NextResponse>
) {
  return async (request: NextRequest) => {
    const clonedRequest = request.clone()
    const authResult = await authenticateExternal(request)

    if (authResult instanceof NextResponse) {
      return authResult
    }

    const body = await clonedRequest.json().catch(() => ({}))
    return handler(request, authResult, body)
  }
}
