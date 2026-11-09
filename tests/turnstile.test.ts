import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { verifyTurnstileToken } from '../src/worker/turnstile';

describe('Turnstile Bot Protection Gate', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('bypasses verification when TURNSTILE_SECRET_KEY is undefined or empty (development)', async () => {
    expect(await verifyTurnstileToken(undefined, '127.0.0.1', undefined)).toBe(true);
    expect(await verifyTurnstileToken('any-token', '127.0.0.1', '')).toBe(true);
    expect(await verifyTurnstileToken(null, '127.0.0.1', '   ')).toBe(true);
  });

  it('rejects missing or empty token when secret key is configured (403 condition)', async () => {
    const configuredSecret = '0x4AAAAAAACk...real-secret';
    expect(await verifyTurnstileToken(undefined, '1.2.3.4', configuredSecret)).toBe(false);
    expect(await verifyTurnstileToken(null, '1.2.3.4', configuredSecret)).toBe(false);
    expect(await verifyTurnstileToken('', '1.2.3.4', configuredSecret)).toBe(false);
  });

  it('does NOT blindly accept dummy tokens when secret key is configured', async () => {
    const configuredSecret = '0x4AAAAAAACk...real-secret';
    // Mock Cloudflare siteverify endpoint rejecting the dummy token
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ success: false, 'error-codes': ['invalid-input-response'] }),
    } as Response);

    const result = await verifyTurnstileToken('XXXX.DUMMY.TOKEN.XXXX', '1.2.3.4', configuredSecret);
    expect(result).toBe(false);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('accepts valid tokens when siteverify succeeds', async () => {
    const configuredSecret = '0x4AAAAAAACk...real-secret';
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ success: true }),
    } as Response);

    const result = await verifyTurnstileToken('valid-cf-token', '1.2.3.4', configuredSecret);
    expect(result).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('returns false safely if siteverify fetch throws network error', async () => {
    const configuredSecret = '0x4AAAAAAACk...real-secret';
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Cloudflare network timeout'));

    const result = await verifyTurnstileToken('any-token', '1.2.3.4', configuredSecret);
    expect(result).toBe(false);
  });
});
