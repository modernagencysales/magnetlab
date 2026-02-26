import Anthropic from '@anthropic-ai/sdk';

/**
 * Create a Helicone-proxied Anthropic client.
 *
 * When HELICONE_API_KEY is set, all requests are routed through
 * https://anthropic.helicone.ai with per-caller tracking headers.
 * Without the key, the client talks directly to the Anthropic API (dev default).
 */
export function createAnthropicClient(
  caller: string,
  options?: { timeout?: number }
): Anthropic {
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
    };
  }

  return new Anthropic(config);
}
