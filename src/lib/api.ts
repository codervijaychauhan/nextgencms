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

export function invalidateClientCache(urlPrefix?: string): void {
  if (!urlPrefix) {
    clientCache.clear();
    return;
  }
  for (const key of clientCache.keys()) {
    if (key.startsWith(urlPrefix) || key.includes(urlPrefix)) {
      clientCache.delete(key);
    }
  }
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();

  // If mutation, invalidate matching cache
  if (method !== 'GET') {
    const basePath = endpoint.split('?')[0];
    invalidateClientCache(basePath);
  }

  // Check client memory cache for GET requests (TTL: 30s for master/demographics routes, 10s for other GETs)
  if (method === 'GET' && !options.body) {
    const isMasterRoute = endpoint.includes('/api/states') || 
                          endpoint.includes('/api/districts') || 
                          endpoint.includes('/api/constituencies') || 
                          endpoint.includes('/api/parties') || 
                          endpoint.includes('/api/elections');
    const ttl = isMasterRoute ? 60_000 : 5_000;
    const cached = clientCache.get(endpoint);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data as T;
    }

    // In-flight request deduplication
    if (inFlightRequests.has(endpoint)) {
      return inFlightRequests.get(endpoint) as Promise<T>;
    }
  }

  const execRequest = async (): Promise<T> => {
    const authHeaders = await getAuthHeader();
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
      const isMasterRoute = endpoint.includes('/api/states') || 
                            endpoint.includes('/api/districts') || 
                            endpoint.includes('/api/constituencies') || 
                            endpoint.includes('/api/parties') || 
                            endpoint.includes('/api/elections');
      const ttl = isMasterRoute ? 60_000 : 5_000;
      clientCache.set(endpoint, { data, expiresAt: Date.now() + ttl });
    }

    return data;
  };

  if (method === 'GET' && !options.body) {
    const reqPromise = execRequest().finally(() => {
      inFlightRequests.delete(endpoint);
    });
    inFlightRequests.set(endpoint, reqPromise);
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
