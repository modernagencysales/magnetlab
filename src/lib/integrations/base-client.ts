// Base HTTP client for all integrations
import { logError } from '@/lib/utils/logger';

export interface ApiClientConfig {
  baseUrl: string;
  apiKey?: string;
  headers?: Record<string, string>;
}

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  status: number;
}

export class BaseApiClient {
  protected baseUrl: string;
  protected apiKey?: string;
  protected headers: Record<string, string>;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.headers = {
      'Content-Type': 'application/json',
      ...config.headers,
    };
  }

  protected async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown,
    customHeaders?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${path}`;

    try {
      const response = await fetch(url, {
        method,
        headers: {
          ...this.headers,
          ...customHeaders,
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      const status = response.status;

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage: string;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorJson.error || errorText;
        } catch {
          errorMessage = errorText || `HTTP ${status}`;
        }
        logError('integrations/api', new Error(errorMessage), { method, url, status });
        return { data: null, error: `HTTP ${status}: ${errorMessage}`, status };
      }

      // Handle empty responses
      const text = await response.text();
      if (!text) {
        return { data: null, error: null, status };
      }

      const data = JSON.parse(text) as T;
      return { data, error: null, status };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { data: null, error: message, status: 0 };
    }
  }

  protected get<T>(path: string, headers?: Record<string, string>) {
    return this.request<T>('GET', path, undefined, headers);
  }

  protected post<T>(path: string, body?: unknown, headers?: Record<string, string>) {
    return this.request<T>('POST', path, body, headers);
  }

  protected async postMultipart<T>(path: string, formData: FormData): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${path}`;

    try {
      // Don't set Content-Type header - fetch will set it with boundary for multipart
      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(this.headers)) {
        if (key.toLowerCase() !== 'content-type') {
          headers[key] = value;
        }
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      });

      const status = response.status;

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage: string;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorJson.error || errorText;
        } catch {
          errorMessage = errorText || `HTTP ${status}`;
        }
        logError('integrations/api', new Error(errorMessage), { method: 'POST (multipart)', url, status });
        return { data: null, error: `HTTP ${status}: ${errorMessage}`, status };
      }

      const text = await response.text();
      if (!text) {
        return { data: null, error: null, status };
      }

      const data = JSON.parse(text) as T;
      return { data, error: null, status };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { data: null, error: message, status: 0 };
    }
  }

  protected put<T>(path: string, body?: unknown, headers?: Record<string, string>) {
    return this.request<T>('PUT', path, body, headers);
  }

  protected async putMultipart<T>(path: string, formData: FormData): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${path}`;

    try {
      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(this.headers)) {
        if (key.toLowerCase() !== 'content-type') {
          headers[key] = value;
        }
      }

      const response = await fetch(url, {
        method: 'PUT',
        headers,
        body: formData,
      });

      const status = response.status;

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage: string;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorJson.error || errorText;
        } catch {
          errorMessage = errorText || `HTTP ${status}`;
        }
        logError('integrations/api', new Error(errorMessage), { method: 'PUT (multipart)', url, status });
        return { data: null, error: `HTTP ${status}: ${errorMessage}`, status };
      }

      const text = await response.text();
      if (!text) {
        return { data: null, error: null, status };
      }

      const data = JSON.parse(text) as T;
      return { data, error: null, status };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { data: null, error: message, status: 0 };
    }
  }

  protected patch<T>(path: string, body?: unknown, headers?: Record<string, string>) {
    return this.request<T>('PATCH', path, body, headers);
  }

  protected delete<T>(path: string, headers?: Record<string, string>) {
    return this.request<T>('DELETE', path, undefined, headers);
  }
}
