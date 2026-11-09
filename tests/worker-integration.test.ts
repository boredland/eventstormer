import { describe, it, expect, vi, afterEach } from 'vitest';
vi.mock('cloudflare:workers', () => ({
  DurableObject: class {},
}));
import worker from '../src/worker/index';

describe('Worker HTTP & Bot Protection Gate Smoke Test', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('dev-bypass: permits workspace creation when TURNSTILE_SECRET_KEY is empty/undefined', async () => {
    const mockEnv = {
      TURNSTILE_SECRET_KEY: undefined,
      TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
      WORKSPACES: {
        idFromName: vi.fn().mockReturnValue('mock-id'),
        get: vi.fn().mockReturnValue({
          fetch: vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'ok' }))),
        }),
      },
    };

    const req = new Request('http://localhost/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const res = await worker.fetch(req, mockEnv as any, {} as any);
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.id).toBeDefined();
    expect(data.url).toMatch(/^\/w\//);
  });

  it('configured-secret 403: rejects workspace creation without valid token when TURNSTILE_SECRET_KEY is set', async () => {
    const mockEnv = {
      TURNSTILE_SECRET_KEY: '0x4AAAAAAACk_configured_secret_key',
      TURNSTILE_SITE_KEY: '0x4AAAAAAACk_configured_site_key',
      WORKSPACES: {
        idFromName: vi.fn(),
        get: vi.fn(),
      },
    };

    // 1. Missing token
    const req1 = new Request('http://localhost/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res1 = await worker.fetch(req1, mockEnv as any, {} as any);
    expect(res1.status).toBe(403);
    const body1 = await res1.json() as any;
    expect(body1.error).toContain('Bot protection challenge verification failed');

    // 2. Invalid/rejected token
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ success: false, 'error-codes': ['invalid-input-response'] }),
    } as Response);

    const req2 = new Request('http://localhost/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ turnstileToken: 'bogus-token' }),
    });
    const res2 = await worker.fetch(req2, mockEnv as any, {} as any);
    expect(res2.status).toBe(403);
  });

  it('configured-secret: accepts workspace creation when siteverify confirms token', async () => {
    const mockEnv = {
      TURNSTILE_SECRET_KEY: '0x4AAAAAAACk_configured_secret_key',
      TURNSTILE_SITE_KEY: '0x4AAAAAAACk_configured_site_key',
      WORKSPACES: {
        idFromName: vi.fn().mockReturnValue('mock-id'),
        get: vi.fn().mockReturnValue({
          fetch: vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'ok' }))),
        }),
      },
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ success: true }),
    } as Response);

    const req = new Request('http://localhost/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ turnstileToken: 'verified-human-token' }),
    });
    const res = await worker.fetch(req, mockEnv as any, {} as any);
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.id).toBeDefined();
  });
});
