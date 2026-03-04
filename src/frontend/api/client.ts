/**
 * Shared API client for frontend.
 * Uses credentials (cookies), base path /api, JSON parse, throws ApiError on non-ok.
 */

import { parseApiError, type ApiError } from './errors';

const BASE = '/api';

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: Record<string, unknown> | FormData;
};

async function request<T>(
  path: string,
  method: string,
  options: RequestOptions = {}
): Promise<T> {
  const { body, ...init } = options as RequestOptions & { body?: Record<string, unknown> | FormData };
  const url = path.startsWith('http') ? path : `${BASE}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = new Headers(init.headers);
  if (body !== undefined && !(body instanceof FormData)) {
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
  }
  const response = await fetch(url, {
    ...init,
    method,
    headers,
    credentials: 'include',
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
  });
  if (!response.ok) {
    throw await parseApiError(response);
  }
  const contentType = response.headers.get('Content-Type');
  if (contentType?.includes('application/json')) {
    return response.json() as Promise<T>;
  }
  return undefined as T;
}

export const apiClient = {
  get<T>(path: string, options?: RequestOptions): Promise<T> {
    return request<T>(path, 'GET', options);
  },
  post<T>(path: string, body?: Record<string, unknown> | FormData, options?: RequestOptions): Promise<T> {
    return request<T>(path, 'POST', { ...options, body });
  },
  patch<T>(path: string, body?: Record<string, unknown>, options?: RequestOptions): Promise<T> {
    return request<T>(path, 'PATCH', { ...options, body });
  },
  put<T>(path: string, body?: Record<string, unknown> | FormData, options?: RequestOptions): Promise<T> {
    return request<T>(path, 'PUT', { ...options, body });
  },
  delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return request<T>(path, 'DELETE', options);
  },
};

export type { ApiError };
