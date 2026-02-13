import { memoryCache } from "./cache";

const CACHE_TTL_SECONDS = 60; // 1 minute cache for prices

export interface Ticker {
    asset_id_base: string;
    asset_id_quote: string;
    rate: number;
}

export const coinApi = {
    getTicker: async (base: string, quote: string): Promise<Ticker | null> => {
        const cacheKey = `ticker:${base}:${quote}`;
        const cached = memoryCache.get<Ticker>(cacheKey);

        if (cached) {
            console.log(`Cache hit for ${cacheKey}`);
            return cached;
        }

        if (!process.env.COINAPI_KEY) {
            throw new Error(`COINAPI_KEY missing. Cannot fetch data for ${base}.`);
        }

        try {
            const response = await fetch(
                `https://rest.coinapi.io/v1/exchangerate/${base}/${quote}`,
                {
                    headers: {
                        "X-CoinAPI-Key": process.env.COINAPI_KEY,
                    },
                }
            );

            if (!response.ok) {
                throw new Error(`CoinAPI error: ${response.statusText}`);
            }

            const data = await response.json();
            memoryCache.set(cacheKey, data, CACHE_TTL_SECONDS);
            return data;
        } catch (error) {
            console.error("Failed to fetch ticker:", error);
            return null;
        }
    },

    getHistoricalData: async (base: string, quote: string, period: string = "1DAY", limit: number = 30) => {
        // Mock data for now as historical data endpoints are strict on free tier
        if (!process.env.COINAPI_KEY) {
            throw new Error("COINAPI_KEY missing. Cannot fetch historical data.");
        }
        // Implementation for real historical data would go here
        return [];
    }
};
