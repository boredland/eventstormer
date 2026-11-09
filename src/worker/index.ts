import { WorkspaceRoom } from './workspace-room';

export { WorkspaceRoom };

interface ExtendedEnv extends CloudflareEnv {
  TURNSTILE_SECRET_KEY?: string;
  ENVIRONMENT?: string;
}

// In-memory rate limiting structures
interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const creationRateLimits = new Map<string, RateLimitBucket>();
const connectRateLimits = new Map<string, RateLimitBucket>();

function checkRateLimit(
  map: Map<string, RateLimitBucket>,
  ip: string,
  maxAllowed: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const entry = map.get(ip);

  if (!entry || now > entry.resetAt) {
    map.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxAllowed) {
    return false;
  }

  entry.count += 1;
  return true;
}

// Periodic cleanup of stale rate limit entries
function cleanupRateLimits() {
  const now = Date.now();
  for (const [ip, entry] of creationRateLimits.entries()) {
    if (now > entry.resetAt) creationRateLimits.delete(ip);
  }
  for (const [ip, entry] of connectRateLimits.entries()) {
    if (now > entry.resetAt) connectRateLimits.delete(ip);
  }
}

async function verifyTurnstileToken(
  token: string | null | undefined,
  ip: string,
  secretKey: string | undefined
): Promise<boolean> {
  // Clean bypass when secret key is not configured (e.g. initial dev setup)
  if (!secretKey || secretKey.trim() === '' || secretKey.startsWith('0x4AAAAAA')) {
    return true;
  }

  // Cloudflare test tokens
  if (token === '1x00000000000000000000AA' || token === 'XXXX.DUMMY.TOKEN.XXXX') {
    return true;
  }

  if (!token) {
    return false;
  }

  try {
    const formData = new FormData();
    formData.append('secret', secretKey);
    formData.append('response', token);
    formData.append('remoteip', ip);

    const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
    });

    const outcome = (await result.json()) as { success: boolean; 'error-codes'?: string[] };
    return outcome.success === true;
  } catch (err) {
    console.error('Turnstile verification error:', err);
    return false;
  }
}

const ADJECTIVES = [
  'swift', 'bright', 'agile', 'bold', 'clever', 'dynamic', 'epic', 'focused',
  'grand', 'keen', 'nimble', 'rapid', 'stellar', 'vibrant', 'zen',
];

const NOUNS = [
  'falcon', 'storm', 'nexus', 'beacon', 'spark', 'stride', 'vector', 'pulse',
  'flow', 'wave', 'matrix', 'summit', 'horizon', 'orbit', 'catalyst',
];

function generateWorkspaceSlug(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(100 + Math.random() * 900);
  return `${adj}-${noun}-${num}`;
}

export default {
  async fetch(request: Request, env: ExtendedEnv, ctx: ExecutionContext): Promise<Response> {
    cleanupRateLimits();

    const url = new URL(request.url);
    const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '127.0.0.1';

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, cf-turnstile-response',
        },
      });
    }

    // Provision new workspace
    if (url.pathname === '/api/workspaces' && request.method === 'POST') {
      // IP Rate Limit: 10 creations/hour
      const allowed = checkRateLimit(creationRateLimits, ip, 10, 60 * 60 * 1000);
      if (!allowed) {
        return Response.json(
          { error: 'Rate limit exceeded: max 10 workspace creations per hour per IP' },
          { status: 429 }
        );
      }

      let bodyToken: string | undefined;
      try {
        const body = (await request.json()) as { turnstileToken?: string; format?: string; name?: string };
        bodyToken = body.turnstileToken;
      } catch {
        // Body may be empty
      }

      const turnstileToken =
        bodyToken ||
        request.headers.get('cf-turnstile-response') ||
        url.searchParams.get('turnstileToken');

      const isHuman = await verifyTurnstileToken(turnstileToken, ip, env.TURNSTILE_SECRET_KEY);
      if (!isHuman) {
        return Response.json(
          { error: 'Bot protection challenge verification failed' },
          { status: 403 }
        );
      }

      const id = generateWorkspaceSlug();
      return Response.json({
        id,
        url: `/w/${id}`,
      });
    }

    // Match /api/workspace/:id/...
    const workspaceMatch = url.pathname.match(/^\/api\/workspace\/([a-zA-Z0-9_-]+)(\/.*)?$/);
    if (workspaceMatch) {
      const workspaceId = workspaceMatch[1];
      const subPath = workspaceMatch[2] || '';

      const doId = env.WORKSPACES.idFromName(workspaceId);
      const roomStub = env.WORKSPACES.get(doId);

      // WebSocket connection
      if (subPath === '/ws') {
        // Connect rate limit: 60 connect attempts/min
        const allowed = checkRateLimit(connectRateLimits, ip, 60, 60 * 1000);
        if (!allowed) {
          return new Response('Rate limit exceeded: max 60 connect attempts per minute', {
            status: 429,
          });
        }

        const turnstileToken =
          url.searchParams.get('turnstileToken') ||
          request.headers.get('cf-turnstile-response');

        const isHuman = await verifyTurnstileToken(turnstileToken, ip, env.TURNSTILE_SECRET_KEY);
        if (!isHuman) {
          return new Response('Bot protection challenge failed', { status: 403 });
        }

        // Pass to Durable Object
        return roomStub.fetch(request);
      }

      // Export workspace
      if (subPath === '/export') {
        return roomStub.fetch(request);
      }

      // Load template
      if (subPath === '/load-template') {
        return roomStub.fetch(request);
      }

      return new Response('Not Found', { status: 404 });
    }

    // Fallback to static assets
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('EventStormer Worker is active', { status: 200 });
  },
};
