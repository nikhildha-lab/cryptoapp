import { NextRequest, NextResponse } from "next/server";

// Cache for price data (1 minute TTL)
const priceCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 60000; // 1 minute



export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get("symbol") || "BTC";

    const cacheKey = symbol;
    const now = Date.now();

    // Check cache
    const cached = priceCache.get(cacheKey);
    if (cached && (now - cached.timestamp) < CACHE_TTL) {
        return NextResponse.json(cached.data);
    }

    try {
        // Dynamic import of CCXT for Next.js compatibility
        const ccxt = await import('ccxt');

        // Initialize Binance exchange
        const exchange = new ccxt.binance({ enableRateLimit: true });

        // Fetch ticker data for the symbol
        const pair = `${symbol}/USDT`;
        const ticker = await exchange.fetchTicker(pair);

        // Calculate 24h change percentage
        const price = ticker.last || 0;
        const change = ticker.percentage || 0;

        const data = {
            price: parseFloat(price.toFixed(2)),
            change: parseFloat(change.toFixed(2))
        };

        // Update cache
        priceCache.set(cacheKey, { data, timestamp: now });

        return NextResponse.json(data);

    } catch (error: any) {
        console.error(`Failed to fetch data for ${symbol}:`, error);

        return NextResponse.json({ error: "Market data unavailable" }, { status: 500 });
    }
}
