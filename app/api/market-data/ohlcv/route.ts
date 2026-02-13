import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get("symbol") || "BTC";
    const timeframe = searchParams.get("timeframe") || "1h";
    const limit = parseInt(searchParams.get("limit") || "100");

    try {
        const ccxt = await import('ccxt');
        const exchange = new ccxt.binance({ enableRateLimit: true });

        const pair = symbol.includes('/') ? symbol : `${symbol}/USDT`;

        // fetchOHLCV returns [timestamp, open, high, low, close, volume]
        const ohlcv = await exchange.fetchOHLCV(pair, timeframe, undefined, limit);

        if (!ohlcv || !Array.isArray(ohlcv)) {
            return NextResponse.json({ success: false, error: "No market data found" }, { status: 404 });
        }

        // Format for Lightweight Charts: { time: number (seconds), open, high, low, close }
        const formattedData = ohlcv.map((candle: any[]) => ({
            time: Math.floor(candle[0] / 1000), // convert ms to seconds
            open: candle[1],
            high: candle[2],
            low: candle[3],
            close: candle[4],
            volume: candle[5]
        }));

        return NextResponse.json({
            success: true,
            symbol: pair,
            timeframe,
            data: formattedData
        });

    } catch (error: any) {
        console.error(`Failed to fetch OHLCV for ${symbol}:`, error);
        return NextResponse.json({
            success: false,
            error: error.message || "Failed to fetch candlestick data"
        }, { status: 500 });
    }
}
