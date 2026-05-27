import express from 'express';
import { Readable } from 'stream';
import { kv } from './storage';
import {
  getTokens, addToken, removeToken, toggleToken, updateToken,
  getEnabledTokenStrings, updateTokenStatus,
} from './token-store';
import { checkTokenValidity } from './key-checker';
import { getAdminHTML } from './admin';
import { FAVICON_BASE64 } from './favicon';

const app = express();
const PORT = parseInt(process.env.PORT || '3000');
const GATEWAY_KEY = process.env.GATEWAY_KEY || '';
const TARGET_BASE_URL = process.env.TARGET_BASE_URL || 'https://api.openai.com';
const MAX_REQUESTS_PER_MINUTE = 60;
const COOLDOWN_MS = 60 * 1000;

// In-memory state
const cooldowns = new Map<string, Map<string, number>>();
const rateLimits = new Map<string, { count: number; resetTime: number }>();
let lastCleanupTime = Date.now();

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, *',
};

function applyCors(res: express.Response) {
  for (const [k, v] of Object.entries(CORS_HEADERS)) res.setHeader(k, v);
}

function runMemoryCleanup() {
  const now = Date.now();
  if (now - lastCleanupTime < 5 * 60 * 1000) return;
  lastCleanupTime = now;
  for (const [g, rd] of rateLimits.entries()) {
    if (now > rd.resetTime) rateLimits.delete(g);
  }
  for (const [g, gc] of cooldowns.entries()) {
    for (const [t, exp] of gc.entries()) { if (now > exp) gc.delete(t); }
    if (gc.size === 0) cooldowns.delete(g);
  }
}

function getAvailableKeys(group: string, all: string[]): string[] {
  const now = Date.now();
  const gc = cooldowns.get(group) || new Map<string, number>();
  return all.filter(k => (gc.get(k) || 0) < now);
}

function getRandomToken(group: string, keys: string[]): string | null {
  const avail = getAvailableKeys(group, keys);
  if (avail.length === 0) return null;
  return avail[Math.floor(Math.random() * avail.length)];
}

function setTokenCooldown(group: string, token: string) {
  if (!cooldowns.has(group)) cooldowns.set(group, new Map());
  cooldowns.get(group)!.set(token, Date.now() + COOLDOWN_MS);
}

function clearGroupCooldowns(group: string) {
  cooldowns.get(group)?.clear();
}

function verifyAdmin(req: express.Request): boolean {
  if (!GATEWAY_KEY) return false;
  const auth = req.headers['authorization'];
  const apiKey = req.headers['x-api-key'] as string | undefined;
  const client = auth ? auth.replace('Bearer ', '').trim() : (apiKey || null);
  const allowed = GATEWAY_KEY.split(',').map(k => k.trim()).filter(Boolean);
  return allowed.includes(client || '');
}

function parseBody(req: express.Request): any {
  const buf = req.body;
  if (!buf || !Buffer.isBuffer(buf) || buf.length === 0) return {};
  try { return JSON.parse(buf.toString()); } catch { return {}; }
}

// Parse all bodies as raw buffer (needed for proxy passthrough)
app.use(express.raw({ type: '*/*', limit: '100mb' }));

// CORS preflight
app.options('*', (_req, res) => { applyCors(res); res.status(204).end(); });

// Apply CORS to every response
app.use((_req, res, next) => { applyCors(res); next(); });

// Favicon
app.get('/favicon.ico', (_req, res) => {
  const buf = Buffer.from(FAVICON_BASE64, 'base64');
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=604800');
  res.send(buf);
});

// Admin UI
app.get(['/', '/admin'], (req, res) => {
  const proto = (req.headers['x-forwarded-proto'] as string) || 'http';
  const host = (req.headers['x-forwarded-host'] as string) || req.headers['host'] || 'localhost';
  const baseUrl = `${proto}://${host}`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(getAdminHTML(baseUrl));
});

// Admin: list / add / delete / update tokens
app.all('/admin/tokens', async (req, res) => {
  if (!verifyAdmin(req)) return void res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'GET') {
    const tokens = await getTokens(kv);
    const kvTokens = await getEnabledTokenStrings(kv);
    const envTokens = (process.env.UPSTREAM_KEYS || '').split(',').map(k => k.trim()).filter(Boolean);
    const available = new Set([...kvTokens, ...envTokens]).size;
    const safe = tokens.map(t => ({
      token: t.token, name: t.name || '', addedAt: t.addedAt, enabled: t.enabled,
      lastChecked: t.lastChecked || null, status: t.status || 'unchecked', disableReason: t.disableReason || '',
    }));
    return void res.json({ tokens: safe, pool_status: { total: tokens.length + envTokens.length, available } });
  }

  if (req.method === 'POST') {
    const body = parseBody(req) as { token: string; name?: string };
    if (!body.token) return void res.status(400).json({ error: 'token is required' });
    try {
      const tokens = await addToken(kv, body.token, body.name);
      return void res.json({ ok: true, count: tokens.length });
    } catch (e) {
      return void res.status(400).json({ error: (e as Error).message });
    }
  }

  if (req.method === 'DELETE') {
    const body = parseBody(req) as { token: string };
    if (!body.token) return void res.status(400).json({ error: 'token is required' });
    const tokens = await removeToken(kv, body.token);
    return void res.json({ ok: true, count: tokens.length });
  }

  if (req.method === 'PATCH') {
    const body = parseBody(req) as { token: string; enabled?: boolean; name?: string };
    if (!body.token) return void res.status(400).json({ error: 'token is required' });
    if (body.enabled !== undefined) {
      const tokens = await toggleToken(kv, body.token, body.enabled);
      return void res.json({ ok: true, count: tokens.length });
    }
    if (body.name !== undefined) {
      try {
        const tokens = await updateToken(kv, body.token, { name: body.name });
        return void res.json({ ok: true, count: tokens.length });
      } catch (e) {
        return void res.status(400).json({ error: (e as Error).message });
      }
    }
    return void res.status(400).json({ error: 'No update fields provided' });
  }

  res.status(405).json({ error: 'Method not allowed' });
});

// Admin: deprecated batch check endpoint
app.post('/admin/check-tokens', (_req, res) => {
  res.status(400).json({ error: 'Deprecated. Use /admin/check-token instead.' });
});

// Admin: check single token
app.post('/admin/check-token', async (req, res) => {
  if (!verifyAdmin(req)) return void res.status(401).json({ error: 'Unauthorized' });
  const body = parseBody(req) as { token: string };
  if (!body.token) return void res.status(400).json({ error: 'token is required' });

  const rawBaseUrl = TARGET_BASE_URL;
  const validity = await checkTokenValidity(body.token, rawBaseUrl);
  if (validity.valid) {
    await updateTokenStatus(kv, body.token, 'valid');
  } else {
    await updateTokenStatus(kv, body.token, 'invalid', `auto-check: HTTP ${validity.httpStatus}`);
  }
  res.json({ ok: true, valid: validity.valid, httpStatus: validity.httpStatus });
});

// Proxy passthrough (catch-all)
app.all('*', async (req, res) => {
  runMemoryCleanup();

  try {
    const targetBaseUrl = TARGET_BASE_URL.endsWith('/') ? TARGET_BASE_URL.slice(0, -1) : TARGET_BASE_URL;

    const allowedGatewayKeys = GATEWAY_KEY.split(',').map(k => k.trim()).filter(Boolean);

    const envUpstreamKeys = (process.env.UPSTREAM_KEYS || '').split(',').map(k => k.trim()).filter(Boolean);
    const kvUpstreamKeys = await getEnabledTokenStrings(kv);
    const allUpstreamKeys = Array.from(new Set([...envUpstreamKeys, ...kvUpstreamKeys]));

    const auth = req.headers['authorization'];
    const apiKey = req.headers['x-api-key'] as string | undefined;
    const clientKey = auth ? auth.replace('Bearer ', '').trim() : (apiKey || null);

    if (allowedGatewayKeys.length > 0 && (!clientKey || !allowedGatewayKeys.includes(clientKey))) {
      return void res.status(401).json({ error: { message: 'Unauthorized: Invalid Gateway Key', type: 'gateway_error' } });
    }

    if (allUpstreamKeys.length === 0) {
      return void res.status(503).json({ error: { message: 'No upstream keys configured', type: 'gateway_error' } });
    }

    const clientGroup = clientKey || 'default';
    const now = Date.now();
    const userRate = rateLimits.get(clientGroup) || { count: 0, resetTime: now + 60000 };
    if (now > userRate.resetTime) { userRate.count = 1; userRate.resetTime = now + 60000; }
    else { userRate.count++; }
    rateLimits.set(clientGroup, userRate);

    if (userRate.count > MAX_REQUESTS_PER_MINUTE) {
      return void res.status(429).json({ error: { message: `Rate limit: ${MAX_REQUESTS_PER_MINUTE} req/min`, type: 'gateway_error' } });
    }

    const bodyBuffer: Buffer | undefined = Buffer.isBuffer(req.body) && req.body.length > 0 ? req.body : undefined;
    const targetUrl = `${targetBaseUrl}${req.path}${req.url.includes('?') ? '?' + req.url.split('?')[1] : ''}`;

    const maxRetries = allUpstreamKeys.length;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      let upstreamKey = getRandomToken(clientGroup, allUpstreamKeys);
      if (!upstreamKey) {
        clearGroupCooldowns(clientGroup);
        upstreamKey = getRandomToken(clientGroup, allUpstreamKeys);
        if (!upstreamKey) {
          return void res.status(503).json({ error: { message: 'All upstream keys exhausted', type: 'gateway_error' } });
        }
      }

      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) {
        if (!v) continue;
        const lower = k.toLowerCase();
        if (lower === 'host' || lower === 'content-length' ||
          lower.startsWith('cf-') || lower.startsWith('x-forwarded-') ||
          lower === 'x-real-ip' || lower === 'true-client-ip') continue;
        headers.set(k, Array.isArray(v) ? v.join(', ') : v);
      }
      headers.set('Authorization', `Bearer ${upstreamKey}`);
      headers.set('x-api-key', upstreamKey);

      const fetchOptions: RequestInit = { method: req.method, headers, redirect: 'manual' };
      if (bodyBuffer) fetchOptions.body = bodyBuffer;

      const upstream = await fetch(targetUrl, fetchOptions);

      if (upstream.status === 401 || upstream.status === 403 || upstream.status === 429 || upstream.status >= 500) {
        if (upstream.status === 401 || upstream.status === 403 || upstream.status === 429) {
          setTokenCooldown(clientGroup, upstreamKey);
          if (kvUpstreamKeys.includes(upstreamKey)) {
            updateTokenStatus(kv, upstreamKey, 'invalid', `auto-disable: HTTP ${upstream.status}`).catch(() => {});
          }
        }
        continue;
      }

      // Forward response headers
      res.status(upstream.status);
      for (const [k, v] of upstream.headers.entries()) {
        const lower = k.toLowerCase();
        if (lower === 'transfer-encoding') continue;
        res.setHeader(k, v);
      }
      applyCors(res);

      if (upstream.body) {
        // @ts-ignore - Node 18+ ReadableStream is compatible
        Readable.fromWeb(upstream.body).pipe(res);
      } else {
        res.end();
      }
      return;
    }

    res.status(503).json({ error: { message: 'All upstream keys exhausted after retries', type: 'gateway_error' } });
  } catch (err: any) {
    res.status(500).json({ error: { message: `Gateway Internal Error: ${err.message}`, type: 'gateway_error' } });
  }
});

app.listen(PORT, () => {
  console.log(`API Gateway running on http://0.0.0.0:${PORT}`);
});
