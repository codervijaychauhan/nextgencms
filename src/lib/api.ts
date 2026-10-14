import { auth } from './firebase';

async function getAuthHeader(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (user) {
    try {
      const token = await user.getIdToken();
      return { Authorization: `Bearer ${token}` };
    } catch (error) {
      console.error('Failed to get Firebase auth token:', error);
    }
  }

  const localToken = typeof window !== 'undefined' ? localStorage.getItem('nextgen_local_token') : null;
  if (localToken) {
    return { Authorization: `Bearer ${localToken}` };
  }

  return {};
}

interface CacheItem<T> {
  data: T;
  expiresAt: number;
}

const clientCache = new Map<string, CacheItem<any>>();
const inFlightRequests = new Map<string, Promise<any>>();

const MASTER_ROUTES = [
  '/api/states',
  '/api/districts',
  '/api/constituencies',
  '/api/mandals',
  '/api/panchayats',
  '/api/wards',
  '/api/booths',
  '/api/parties',
  '/api/elections'
];

function isMasterRoute(endpoint: string): boolean {
  const clean = endpoint.split('?')[0];
  return MASTER_ROUTES.some(r => clean.startsWith(r));
}

function getSessionCached<T>(key: string): T | null {
  if (typeof window === 'undefined' || !window.sessionStorage) return null;
  try {
    const raw = sessionStorage.getItem(`ng_cache_${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() > parsed.expiresAt) {
      sessionStorage.removeItem(`ng_cache_${key}`);
      return null;
    }
    return parsed.data as T;
  } catch {
    return null;
  }
}

function setSessionCached<T>(key: string, data: T, ttlMs: number): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    sessionStorage.setItem(`ng_cache_${key}`, JSON.stringify({
      data,
      expiresAt: Date.now() + ttlMs
    }));
  } catch {
    // SessionStorage full or unavailable, ignore
  }
}

function clearSessionCachePrefix(prefix: string): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && (k.startsWith(`ng_cache_${prefix}`) || k.includes(prefix))) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach(k => sessionStorage.removeItem(k));
  } catch {}
}

export function invalidateClientCache(urlPrefix?: string): void {
  if (!urlPrefix) {
    clientCache.clear();
    inFlightRequests.clear();
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const keysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith('ng_cache_')) keysToRemove.push(k);
      }
      keysToRemove.forEach(k => sessionStorage.removeItem(k));
    }
    return;
  }
  
  const cleanPrefix = urlPrefix.split('?')[0];
  const segments = cleanPrefix.split('/').filter(Boolean);
  const rootResource = segments.length >= 2 ? `/${segments[0]}/${segments[1]}` : cleanPrefix;

  for (const key of clientCache.keys()) {
    const cleanKey = key.split('?')[0];
    if (
      cleanKey.startsWith(cleanPrefix) ||
      cleanPrefix.startsWith(cleanKey) ||
      cleanKey.startsWith(rootResource) ||
      rootResource.startsWith(cleanKey) ||
      (rootResource.includes('voter') && key.includes('voter'))
    ) {
      clientCache.delete(key);
      inFlightRequests.delete(key);
    }
  }

  clearSessionCachePrefix(rootResource);
  if (rootResource.includes('voter')) {
    clearSessionCachePrefix('/api/voters');
    clearSessionCachePrefix('/api/voter-sentiments');
  }
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();

  // If mutation, invalidate matching cache immediately
  if (method !== 'GET') {
    const basePath = endpoint.split('?')[0];
    invalidateClientCache(basePath);
  }

  const authHeaders = await getAuthHeader();
  const authKey = authHeaders.Authorization ? authHeaders.Authorization.slice(-20) : 'guest';
  const cacheKey = `${endpoint}#${authKey}`;

  // Check client caches for GET requests
  if (method === 'GET' && !options.body) {
    // 1. In-memory client cache
    const cached = clientCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data as T;
    }

    // 2. SessionStorage cache for master routes and voters
    if (isMasterRoute(endpoint) || endpoint.includes('/api/voters') || endpoint.includes('/api/voter-sentiments')) {
      const sessionKey = `${endpoint}#${authKey}`;
      const sessionData = getSessionCached<T>(sessionKey);
      if (sessionData) {
        clientCache.set(cacheKey, { data: sessionData, expiresAt: Date.now() + 300_000 });
        return sessionData;
      }
    }

    // 3. In-flight request deduplication
    if (inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey) as Promise<T>;
    }
  }

  const execRequest = async (): Promise<T> => {
    const headers = {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...(options.headers || {})
    };

    const response = await fetch(endpoint, {
      ...options,
      headers
    });

    if (!response.ok) {
      const errorBody: any = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(errorBody?.error || `HTTP error ${response.status}`);
    }

    const data = (await response.json()) as T;

    if (method === 'GET') {
      let ttl = 30_000; // default 30s
      const sessionKey = `${endpoint}#${authKey}`;
      if (isMasterRoute(endpoint)) {
        ttl = 600_000; // 10 mins for demographics/parties/elections
        setSessionCached(sessionKey, data, ttl);
      } else if (endpoint.includes('/api/voters')) {
        ttl = 180_000; // 3 mins for voter list queries
        setSessionCached(sessionKey, data, ttl);
      } else if (endpoint.includes('/api/voter-sentiments') || endpoint.includes('/api/users')) {
        ttl = 180_000; // 3 mins
        setSessionCached(sessionKey, data, ttl);
      }
      clientCache.set(cacheKey, { data, expiresAt: Date.now() + ttl });
    }

    return data;
  };

  if (method === 'GET' && !options.body) {
    const reqPromise = execRequest().finally(() => {
      inFlightRequests.delete(cacheKey);
    });
    inFlightRequests.set(cacheKey, reqPromise);
    return reqPromise;
  }

  return execRequest();
}

export const apiFetch = apiRequest;

export const api = {
  get: <T = any>(url: string) => apiRequest<T>(url, { method: 'GET' }),
  post: <T = any>(url: string, body?: any) => apiRequest<T>(url, { method: 'POST', body: JSON.stringify(body) }),
  put: <T = any>(url: string, body?: any) => apiRequest<T>(url, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T = any>(url: string) => apiRequest<T>(url, { method: 'DELETE' }),
  invalidateCache: invalidateClientCache
};
