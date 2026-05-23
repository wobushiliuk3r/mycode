import { getAdminHTML } from './admin';
import { getTokens, addToken, removeToken, toggleToken, updateToken, getEnabledTokenStrings, updateTokenStatus } from './token-store';
import { checkTokenValidity } from './key-checker';
import { FAVICON_BASE64 } from './favicon';

export interface Env {
  GATEWAY_KEY?: string;
  UPSTREAM_KEYS?: string;
  TARGET_BASE_URL?: string;
  KV: KVNamespace;
}

// 内存级状态管理（单实例生效）

// 1. 冷却池：隔离不同网关用户的上游失败记录
// 结构：Map<网关密码, Map<上游Token, 过期时间>>
const cooldowns = new Map<string, Map<string, number>>();
const COOLDOWN_MS = 60 * 1000; // 失败重试的冷却时间 1 分钟

// 2. 限流器 (Rate Limiter)：统计每个网关密码的请求频率
// 结构：Map<网关密码, { 计数器, 窗口重置时间 }>
const rateLimits = new Map<string, { count: number, resetTime: number }>();
// 限流配置：每个独立的网关密码，每分钟最多允许请求多少次
const MAX_REQUESTS_PER_MINUTE = 60;

// 3. 内存清理时间戳
let lastCleanupTime = Date.now();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, *',
};

function errorResponse(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: { message, type: 'gateway_error' } }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

function verifyAdmin(request: Request, env: Env): boolean {
  if (!env.GATEWAY_KEY) return false;
  const authHeader = request.headers.get('Authorization');
  const apiKeyHeader = request.headers.get('x-api-key');
  const clientKey = authHeader ? authHeader.replace('Bearer ', '').trim() : (apiKeyHeader || null);

  const allowedKeys = env.GATEWAY_KEY.split(',').map(k => k.trim()).filter(Boolean);
  return allowedKeys.includes(clientKey || '');
}

// --- 内存清理机制 (Garbage Collection) ---
function runMemoryCleanup() {
  const now = Date.now();
  // 每 5 分钟执行一次清理，防止高并发下频繁扫 Map 消耗 CPU
  if (now - lastCleanupTime < 5 * 60 * 1000) return;

  lastCleanupTime = now;

  // 清理限流器中过期的记录
  for (const [clientGroup, rateData] of rateLimits.entries()) {
    if (now > rateData.resetTime) {
      rateLimits.delete(clientGroup);
    }
  }

  // 清理冷却池中过期的 Token，如果某个组空了，把组也删掉
  for (const [clientGroup, groupCooldowns] of cooldowns.entries()) {
    for (const [token, expireTime] of groupCooldowns.entries()) {
      if (now > expireTime) {
        groupCooldowns.delete(token);
      }
    }
    if (groupCooldowns.size === 0) {
      cooldowns.delete(clientGroup);
    }
  }
}

// --- 冷却池相关函数 ---
function getAvailableKeys(clientGroup: string, allKeys: string[]): string[] {
  const now = Date.now();
  const groupCooldowns = cooldowns.get(clientGroup) || new Map<string, number>();
  return allKeys.filter(key => (groupCooldowns.get(key) || 0) < now);
}

function getRandomToken(clientGroup: string, keys: string[]): string | null {
  const available = getAvailableKeys(clientGroup, keys);
  if (available.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * available.length);
  return available[randomIndex];
}

function setTokenCooldown(clientGroup: string, token: string) {
  if (!cooldowns.has(clientGroup)) {
    cooldowns.set(clientGroup, new Map<string, number>());
  }
  const groupCooldowns = cooldowns.get(clientGroup)!;
  groupCooldowns.set(token, Date.now() + COOLDOWN_MS);
}

function clearGroupCooldowns(clientGroup: string) {
  if (cooldowns.has(clientGroup)) {
    cooldowns.get(clientGroup)!.clear();
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // 触发内存清理
    runMemoryCleanup();

    const url = new URL(request.url);

    // 1. CORS 预检
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // ----------------------------------------------------------------
    // 管理后台 UI & API 路由拦截
    // ----------------------------------------------------------------

    // Favicon
    if (url.pathname === '/favicon.ico' && request.method === 'GET') {
      const buf = Uint8Array.from(atob(FAVICON_BASE64), (c) => c.charCodeAt(0));
      return new Response(buf, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=604800', ...corsHeaders() } });
    }

    // Admin UI
    if ((url.pathname === '/' || url.pathname === '/admin') && request.method === 'GET') {
      const baseUrl = `${url.protocol}//${url.host}`;
      return new Response(getAdminHTML(baseUrl), {
        headers: { 'Content-Type': 'text/html; charset=utf-8', ...corsHeaders },
      });
    }

    // Admin API - tokens
    if (url.pathname === '/admin/tokens') {
      if (!verifyAdmin(request, env)) {
        return jsonResponse({ error: 'Unauthorized' }, 401);
      }

      if (!env.KV) {
        return jsonResponse({ error: 'KV Namespace is not configured' }, 500);
      }

      if (request.method === 'GET') {
        const tokens = await getTokens(env.KV);
        const kvTokens = await getEnabledTokenStrings(env.KV);

        // 动态合并环境变量配置的 Key
        const rawUpstreamKeys = env.UPSTREAM_KEYS || '';
        const envTokens = rawUpstreamKeys.split(',').map(k => k.trim()).filter(Boolean);

        const allAvailableCount = new Set([...kvTokens, ...envTokens]).size;

        const safeTokens = tokens.map((t) => ({
          token: t.token,
          name: t.name || '',
          addedAt: t.addedAt,
          enabled: t.enabled,
          lastChecked: t.lastChecked || null,
          status: t.status || 'unchecked',
          disableReason: t.disableReason || '',
        }));

        return jsonResponse({
          tokens: safeTokens,
          pool_status: { total: tokens.length + envTokens.length, available: allAvailableCount }
        });
      }

      if (request.method === 'POST') {
        const body = (await request.json()) as { token: string; name?: string };
        if (!body.token) return jsonResponse({ error: 'token is required' }, 400);
        try {
          const tokens = await addToken(env.KV, body.token, body.name);
          return jsonResponse({ ok: true, count: tokens.length });
        } catch (e) {
          return jsonResponse({ error: (e as Error).message }, 400);
        }
      }

      if (request.method === 'DELETE') {
        const body = (await request.json()) as { token: string };
        if (!body.token) return jsonResponse({ error: 'token is required' }, 400);
        const tokens = await removeToken(env.KV, body.token);
        return jsonResponse({ ok: true, count: tokens.length });
      }

      if (request.method === 'PATCH') {
        const body = (await request.json()) as { token: string; enabled?: boolean; name?: string };
        if (!body.token) return jsonResponse({ error: 'token is required' }, 400);
        if (body.enabled !== undefined) {
          const tokens = await toggleToken(env.KV, body.token, body.enabled);
          return jsonResponse({ ok: true, count: tokens.length });
        }
        if (body.name !== undefined) {
          try {
            const tokens = await updateToken(env.KV, body.token, { name: body.name });
            return jsonResponse({ ok: true, count: tokens.length });
          } catch (e) {
            return jsonResponse({ error: (e as Error).message }, 400);
          }
        }
        return jsonResponse({ error: 'No update fields provided' }, 400);
      }

      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    // Admin API - check tokens
    if (url.pathname === '/admin/check-tokens' && request.method === 'POST') {
      return jsonResponse({ error: 'Endpoint deprecated in favor of sequential checking to avoid upstream rate limits.' }, 400);
    }

    // Admin API - check single token
    if (url.pathname === '/admin/check-token' && request.method === 'POST') {
      if (!verifyAdmin(request, env)) return jsonResponse({ error: 'Unauthorized' }, 401);
      if (!env.KV) return jsonResponse({ error: 'KV Namespace not configured' }, 500);

      const body = (await request.json()) as { token: string };
      if (!body.token) return jsonResponse({ error: 'token is required' }, 400);

      const rawBaseUrl = env.TARGET_BASE_URL || 'https://api.openai.com';
      const validity = await checkTokenValidity(body.token, rawBaseUrl);
      if (validity.valid) {
        await updateTokenStatus(env.KV, body.token, 'valid');
      } else {
        await updateTokenStatus(env.KV, body.token, 'invalid', `auto-check: HTTP ${validity.httpStatus}`);
      }
      return jsonResponse({ ok: true, valid: validity.valid, httpStatus: validity.httpStatus });
    }

    // ----------------------------------------------------------------
    // 穿透代理核心逻辑 (Passthrough Proxy)
    // ----------------------------------------------------------------

    try {
      const rawBaseUrl = env.TARGET_BASE_URL || 'https://api.openai.com';
      const targetBaseUrl = rawBaseUrl.endsWith('/') ? rawBaseUrl.slice(0, -1) : rawBaseUrl;

      const rawGatewayKeys = env.GATEWAY_KEY || '';
      const allowedGatewayKeys = rawGatewayKeys.split(',').map(k => k.trim()).filter(Boolean);

      // 动态合并 KV 中的 Token 和 环境变量中的 Token
      const rawUpstreamKeys = env.UPSTREAM_KEYS || '';
      const envUpstreamKeys = rawUpstreamKeys.split(',').map(k => k.trim()).filter(Boolean);

      let kvUpstreamKeys: string[] = [];
      if (env.KV) {
        kvUpstreamKeys = await getEnabledTokenStrings(env.KV);
      }

      // 去重合并所有的可用 Key
      const allUpstreamKeys = Array.from(new Set([...envUpstreamKeys, ...kvUpstreamKeys]));

      // 2. 验证客户端密码
      const authHeader = request.headers.get('Authorization');
      const apiKeyHeader = request.headers.get('x-api-key');
      const clientKey = authHeader ? authHeader.replace('Bearer ', '').trim() : (apiKeyHeader || null);

      if (allowedGatewayKeys.length > 0 && (!clientKey || !allowedGatewayKeys.includes(clientKey))) {
        return errorResponse(401, 'Unauthorized: Invalid Gateway Key');
      }

      if (allUpstreamKeys.length === 0) {
        return errorResponse(503, 'Service Unavailable: No upstream keys configured in KV or Environment');
      }

      const clientGroup = clientKey || 'default';
      const now = Date.now();

      const userRate = rateLimits.get(clientGroup) || { count: 0, resetTime: now + 60000 };

      if (now > userRate.resetTime) {
        userRate.count = 1;
        userRate.resetTime = now + 60000;
      } else {
        userRate.count++;
      }
      rateLimits.set(clientGroup, userRate);

      if (userRate.count > MAX_REQUESTS_PER_MINUTE) {
        console.warn(`Rate limit triggered for user: ${clientGroup.substring(0, 15)}...`);
        return errorResponse(429, `Gateway Rate Limit Exceeded: You are allowed ${MAX_REQUESTS_PER_MINUTE} requests per minute.`);
      }

      // 3. 读取 Body 缓存
      let bodyBuffer: ArrayBuffer | undefined = undefined;
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        bodyBuffer = await request.arrayBuffer();
      }

      const targetUrlString = `${targetBaseUrl}${url.pathname}${url.search}`;
      const targetUrl = new URL(targetUrlString);

      // 4. 开始重试轮询
      const maxRetries = allUpstreamKeys.length;
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        let upstreamKey = getRandomToken(clientGroup, allUpstreamKeys);

        if (!upstreamKey) {
          clearGroupCooldowns(clientGroup);
          upstreamKey = getRandomToken(clientGroup, allUpstreamKeys);
          if (!upstreamKey) {
             return errorResponse(503, 'All upstream keys are rate limited or failed.');
          }
        }

        // 5. 构造高匿代理 Headers
        const newHeaders = new Headers(request.headers);
        newHeaders.delete('Content-Length');
        newHeaders.delete('Host');
        newHeaders.set('Host', targetUrl.host);

        const keysToDelete = [];
        for (const [key] of newHeaders.entries()) {
          const lowerKey = key.toLowerCase();
          if (lowerKey.startsWith('cf-') || lowerKey.startsWith('x-forwarded-') || lowerKey === 'x-real-ip' || lowerKey === 'true-client-ip') {
            keysToDelete.push(key);
          }
        }
        keysToDelete.forEach(k => newHeaders.delete(k));

        newHeaders.set('Authorization', `Bearer ${upstreamKey}`);
        newHeaders.set('x-api-key', upstreamKey);

        // 6. 发起真实请求
        const fetchOptions: RequestInit = {
          method: request.method,
          headers: newHeaders,
          redirect: 'manual',
        };
        if (bodyBuffer !== undefined) {
          fetchOptions.body = bodyBuffer;
        }

        const proxyRequest = new Request(targetUrl.toString(), fetchOptions);
        const response = await fetch(proxyRequest);

        // 7. 处理故障转移
        if (response.status === 401 || response.status === 403 || response.status === 429 || response.status >= 500) {
          console.warn(`[User: ${clientGroup.substring(0, 8)}] Token failed with status ${response.status}, retrying...`);

          if (response.status === 401 || response.status === 403 || response.status === 429) {
             setTokenCooldown(clientGroup, upstreamKey);

             // 如果配置了 KV 且这个 Token 在 KV 里，我们在 KV 里自动禁用它，防止下次重启 Worker 还用
             if (env.KV && kvUpstreamKeys.includes(upstreamKey)) {
               // 异步在后台禁用，不阻塞当前请求的重试
               const reason = `auto-disable during proxy: HTTP ${response.status}`;
               updateTokenStatus(env.KV, upstreamKey, 'invalid', reason).catch(() => {});
             }
          }
          continue;
        }

        // 8. 成功返回
        const responseHeaders = new Headers(response.headers);
        responseHeaders.set('Access-Control-Allow-Origin', '*');

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
        });
      }

      return errorResponse(503, 'All upstream keys exhausted after retries or upstream server is down.');

    } catch (err: any) {
      return errorResponse(500, `Gateway Internal Error: ${err.message}`);
    }
  },
};