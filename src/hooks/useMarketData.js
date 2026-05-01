import { useState, useEffect, useCallback } from 'react';
import { newsData as staticNews } from '../data/newsData';
import { stockPredictions as staticPredictions } from '../data/stockPredictions';

const CACHE_KEY = 'market_intel_cache';
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

function getCachedData() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    const parsed = JSON.parse(cached);
    if (Date.now() - parsed.cachedAt > CACHE_TTL) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function setCachedData(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      ...data,
      cachedAt: Date.now()
    }));
  } catch {
    // localStorage full or unavailable
  }
}

export function useMarketData() {
  const [news, setNews] = useState(staticNews);
  const [predictions, setPredictions] = useState(staticPredictions);
  const [sentiment, setSentiment] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [dataSource, setDataSource] = useState('static'); // 'static' | 'cached' | 'live'
  const [apiErrors, setApiErrors] = useState([]);

  const fetchData = useCallback(async (forceRefresh = false) => {
    // Check cache first (unless forcing refresh)
    if (!forceRefresh) {
      const cached = getCachedData();
      if (cached && cached.news?.length > 0) {
        setNews(cached.news);
        if (cached.predictions?.length > 0) setPredictions(cached.predictions);
        if (cached.sentiment) setSentiment(cached.sentiment);
        setLastUpdated(cached.timestamp);
        setDataSource('cached');
        setApiErrors(cached.errors || []);
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/news');
      if (!res.ok) throw new Error(`API returned ${res.status}`);

      const data = await res.json();

      if (data.success && data.news?.length > 0) {
        setNews(data.news);
        setDataSource('live');
        setLastUpdated(data.timestamp);
        setApiErrors(data.errors || []);

        if (data.predictions?.length > 0) {
          setPredictions(data.predictions);
        }
        if (data.sentiment) {
          setSentiment(data.sentiment);
        }

        // Cache the response
        setCachedData(data);
      } else {
        // API returned but no data — keep static fallback
        setError(data.error || 'No data returned');
        setDataSource('static');
      }
    } catch (e) {
      console.warn('[MarketIntel] API fetch failed, using static data:', e.message);
      setError(e.message);
      setDataSource('static');
      // Static data is already set as default
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 6 hours
  useEffect(() => {
    const interval = setInterval(() => fetchData(true), CACHE_TTL);
    return () => clearInterval(interval);
  }, [fetchData]);

  return {
    news,
    predictions,
    sentiment,
    loading,
    error,
    lastUpdated,
    dataSource,
    apiErrors,
    refresh: () => fetchData(true)
  };
}
