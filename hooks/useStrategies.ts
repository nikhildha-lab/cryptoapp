
import { useState, useEffect, useCallback } from 'react';
import { Strategy, STRATEGIES as DEFAULT_STRATEGIES } from '@/lib/constants';

export function useStrategies() {
    const [strategies, setStrategies] = useState<Strategy[]>(DEFAULT_STRATEGIES);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchStrategies = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/strategies/list');
            if (!res.ok) throw new Error('Failed to fetch strategies');

            const data = await res.json();

            // If API fails or returns empty, we might want to fallback, 
            // but the API implementation merges defaults so it should be fine.
            if (Array.isArray(data)) {
                setStrategies(data);
            }
        } catch (err: any) {
            console.error(err);
            setError(err.message);
            // Fallback to static constants if API fails
            setStrategies(DEFAULT_STRATEGIES);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStrategies();
    }, [fetchStrategies]);

    return { strategies, loading, error, refresh: fetchStrategies };
}
