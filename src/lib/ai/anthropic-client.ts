import Anthropic from '@anthropic-ai/sdk';

/**
 * Create a Helicone-proxied Anthropic client.
 *
 * When HELICONE_API_KEY is set, all requests are routed through
 * https://anthropic.helicone.ai with per-caller tracking headers.
 * Without the key, the client talks directly to the Anthropic API (dev default).
 */
interface AnthropicClientOptions {
  timeout?: number;
  userId?: string;
  sessionId?: string;
  mode?: string;
}

export function createAnthropicClient(caller: string, options?: AnthropicClientOptions): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');

  const heliconeKey = process.env.HELICONE_API_KEY;
  const config: ConstructorParameters<typeof Anthropic>[0] = {
    apiKey,
    timeout: options?.timeout,
  };

  if (heliconeKey) {
    config.baseURL = 'https://anthropic.helicone.ai';
    config.defaultHeaders = {
      'Helicone-Auth': `Bearer ${heliconeKey}`,
      'Helicone-Property-Source': 'magnetlab',
      'Helicone-Property-Caller': caller,
      ...(options?.userId && { 'Helicone-User-Id': options.userId }),
      ...(options?.sessionId && { 'Helicone-Session-Id': options.sessionId }),
      ...(options?.mode && { 'Helicone-Property-Mode': options.mode }),
    };
  }

  return new Anthropic(config);
}
