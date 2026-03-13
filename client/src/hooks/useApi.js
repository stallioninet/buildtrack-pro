import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api/client';

// Simple in-memory cache with TTL
const cache = new Map();
const DEFAULT_TTL = 30000; // 30 seconds

function getCacheKey(url) {
  return url;
}

export function clearApiCache(urlPattern) {
  if (!urlPattern) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.includes(urlPattern)) {
      cache.delete(key);
    }
  }
}

// Invalidate cache entries matching a pattern (call after mutations)
export function invalidateCache(patterns) {
  const patternList = Array.isArray(patterns) ? patterns : [patterns];
  for (const key of cache.keys()) {
    if (patternList.some(p => key.includes(p))) {
      cache.delete(key);
    }
  }
}

export function useApi(url, options = {}) {
  const { ttl = DEFAULT_TTL, enabled = true, deps = [] } = options;
  const [data, setData] = useState(() => {
    // Return cached data immediately if available (stale-while-revalidate)
    const cached = cache.get(getCacheKey(url));
    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.data;
    }
    return null;
  });
  const [loading, setLoading] = useState(!data);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    if (!url || !enabled) return;

    const cacheKey = getCacheKey(url);
    const cached = cache.get(cacheKey);

    // If we have fresh cached data, use it
    if (cached && Date.now() - cached.timestamp < ttl) {
      if (mountedRef.current) {
        setData(cached.data);
        setLoading(false);
      }
      return cached.data;
    }

    // Show cached data while revalidating (stale-while-revalidate)
    if (cached) {
      setData(cached.data);
    }

    setLoading(true);
    setError(null);

    try {
      const result = await api.get(url);
      cache.set(cacheKey, { data: result, timestamp: Date.now() });
      if (mountedRef.current) {
        setData(result);
        setLoading(false);
      }
      return result;
    } catch (err) {
      if (mountedRef.current) {
        setError(err);
        setLoading(false);
      }
      return null;
    }
  }, [url, enabled, ttl]);

  const refetch = useCallback(() => {
    const cacheKey = getCacheKey(url);
    cache.delete(cacheKey);
    return fetchData();
  }, [url, fetchData]);

  useEffect(() => {
    mountedRef.current = true;
    fetchData();
    return () => { mountedRef.current = false; };
  }, [url, enabled, ...deps]);

  return { data, loading: loading && !data, error, refetch };
}
