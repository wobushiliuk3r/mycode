import type { KVStore } from './storage';

const KV_KEY = 'upstream_tokens';

export interface StoredToken {
  token: string;
  name: string; // Used to be label/email/spaceName
  addedAt: number;
  enabled: boolean;
  lastChecked?: number;
  status?: 'valid' | 'invalid' | 'unchecked';
  disableReason?: string;
}

export async function getTokens(kv: KVStore): Promise<StoredToken[]> {
  const raw = await kv.get(KV_KEY);
  // Also try to read from the old key for backwards compatibility if new key is empty
  if (!raw) {
    const oldRaw = await kv.get('zo_tokens');
    if (oldRaw) {
      try {
        const oldTokens = JSON.parse(oldRaw);
        const migratedTokens: StoredToken[] = oldTokens.map((t: any) => ({
          token: t.token,
          name: t.email || t.label || t.spaceName || 'Migrated Token',
          addedAt: t.addedAt || Date.now(),
          enabled: t.enabled !== false,
          lastChecked: t.lastChecked,
          status: t.status || 'unchecked',
          disableReason: t.disableReason
        }));
        await kv.put(KV_KEY, JSON.stringify(migratedTokens));
        return migratedTokens;
      } catch {
        return [];
      }
    }
    return [];
  }

  try {
    const tokens = JSON.parse(raw) as StoredToken[];
    let migrated = false;
    for (const t of tokens) {
      if (t.status === undefined) {
        t.status = 'unchecked';
        migrated = true;
      }
    }
    if (migrated) {
      await kv.put(KV_KEY, JSON.stringify(tokens));
    }
    return tokens;
  } catch {
    return [];
  }
}

export async function addToken(
  kv: KVStore,
  token: string,
  name?: string,
): Promise<StoredToken[]> {
  const tokens = await getTokens(kv);
  const exists = tokens.some((t) => t.token === token);
  if (exists) throw new Error('Token already exists');
  const entry: StoredToken = {
    token,
    name: name || 'Unnamed Token',
    addedAt: Date.now(),
    enabled: true,
    status: 'unchecked'
  };
  tokens.push(entry);
  await kv.put(KV_KEY, JSON.stringify(tokens));
  return tokens;
}

export async function removeToken(kv: KVStore, token: string): Promise<StoredToken[]> {
  let tokens = await getTokens(kv);
  tokens = tokens.filter((t) => t.token !== token);
  await kv.put(KV_KEY, JSON.stringify(tokens));
  return tokens;
}

export async function toggleToken(kv: KVStore, token: string, enabled: boolean): Promise<StoredToken[]> {
  const tokens = await getTokens(kv);
  const t = tokens.find((t) => t.token === token);
  if (t) {
    t.enabled = enabled;
    if (enabled) t.disableReason = undefined;
  }
  await kv.put(KV_KEY, JSON.stringify(tokens));
  return tokens;
}

export async function updateToken(
  kv: KVStore,
  token: string,
  updates: { name?: string },
): Promise<StoredToken[]> {
  const tokens = await getTokens(kv);
  const t = tokens.find((t) => t.token === token);
  if (!t) throw new Error('Token not found');
  if (updates.name !== undefined) t.name = updates.name;
  await kv.put(KV_KEY, JSON.stringify(tokens));
  return tokens;
}

export async function updateTokenStatus(
  kv: KVStore,
  token: string,
  status: 'valid' | 'invalid' | 'unchecked',
  disableReason?: string,
): Promise<StoredToken[]> {
  const tokens = await getTokens(kv);
  const t = tokens.find((t) => t.token === token);
  if (!t) throw new Error('Token not found');
  t.status = status;
  t.lastChecked = Date.now();
  if (status === 'invalid') {
    t.enabled = false;
    t.disableReason = disableReason || 'auto-check: token invalid';
  }
  if (disableReason !== undefined) t.disableReason = disableReason;
  await kv.put(KV_KEY, JSON.stringify(tokens));
  return tokens;
}

export async function autoDisableToken(
  kv: KVStore,
  token: string,
  reason: string,
): Promise<void> {
  const tokens = await getTokens(kv);
  const t = tokens.find((t) => t.token === token);
  if (t && t.enabled) {
    t.enabled = false;
    t.status = 'invalid';
    t.disableReason = reason;
    t.lastChecked = Date.now();
    await kv.put(KV_KEY, JSON.stringify(tokens));
  }
}

export async function getEnabledTokenStrings(kv: KVStore): Promise<string[]> {
  const tokens = await getTokens(kv);
  return tokens.filter((t) => t.enabled).map((t) => t.token);
}
