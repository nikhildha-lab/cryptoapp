import * as ccxt from 'ccxt';
import { RSI } from 'technicalindicators';

export interface BacktestParams {
    symbol: string;
    timeframe: string;
    period: number;
    overbought: number;
    oversold: number;
    stop_loss: number;
    take_profit: number;
    initial_capital?: number;
}

export interface BacktestResult {
    pnl: number;
    sharpe_ratio: number;
    max_drawdown: number;
    win_rate: number;
    total_trades: number;
    chart_data: { date: string; pnl: number }[];
    final_value: number;
}

export class BacktestEngine {
    private exchange: ccxt.Exchange;

    constructor() {
        // Initialize exchange for public data fetching
        this.exchange = new ccxt.binance({ enableRateLimit: true });
    }

    async run(params: BacktestParams): Promise<BacktestResult> {
        const symbol = params.symbol.replace('/', '') || 'BTCUSDT'; // Ensure proper format for fetchOHLCV if needed, though CCXT handles slashing usually
        const timeframe = params.timeframe || '1h';
        const limit = 500;

        // 1. Fetch Data
        let ohlcv: ccxt.OHLCV[] = [];
        try {
            // Try fetching from Binance first
            ohlcv = await this.exchange.fetchOHLCV(symbol, timeframe, undefined, limit);
        } catch (e) {
            console.warn(`Failed to fetch from Binance: ${e}. Trying Kraken...`);
            try {
                const kraken = new ccxt.kraken();
                ohlcv = await kraken.fetchOHLCV(params.symbol, timeframe, undefined, limit);
            } catch (e2) {
                console.warn(`Failed to fetch from Kraken: ${e2}. Using Mock Data.`);
                return this.runMockBacktest(params);
            }
        }

        if (!ohlcv || ohlcv.length === 0) {
            return this.runMockBacktest(params);
        }

        // Parse OHLCV
        // timestamp, open, high, low, close, volume
        // Filter out any candles with missing data to ensure type safety
        const validOhlcv = ohlcv.filter(c => c[0] !== undefined && c[4] !== undefined);

        const closePrices = validOhlcv.map(c => c[4] as number);
        const timestamps = validOhlcv.map(c => c[0] as number);

        // 2. Calculate Indicators
        const rsiInput = {
            values: closePrices,
            period: params.period
        };
        const rsiValues = RSI.calculate(rsiInput);

        // RSI values start after 'period' candles. Pad the beginning to match index
        const paddedRsi = new Array(params.period).fill(0).concat(rsiValues);

        // 3. Simulate Trades
        let capital = params.initial_capital || 100000;
        let position = 0; // 0 = flat, 1 = long
        let entryPrice = 0;
        let totalTrades = 0;
        let wins = 0;
        let peakCapital = capital;
        let maxDrawdown = 0;

        const chartData = [];

        // Iterate through candles
        // Start loop after enough data for RSI
        for (let i = params.period; i < validOhlcv.length; i++) {
            const currentPrice = closePrices[i];
            const currentRsi = paddedRsi[i];
            const dateStr = new Date(timestamps[i]).toISOString();

            // Logic
            if (position === 0) {
                // Entry Condition: RSI < Oversold
                if (currentRsi < params.oversold) {
                    position = 1;
                    entryPrice = currentPrice;
                }
            } else if (position === 1) {
                // Exit Conditions
                const profitPct = (currentPrice - entryPrice) / entryPrice;

                let exit = false;
                if (currentRsi > params.overbought) exit = true; // Strategy Exit
                if (profitPct >= params.take_profit) exit = true; // TP
                if (profitPct <= -params.stop_loss) exit = true; // SL

                if (exit) {
                    // Execute Sale
                    const pnl = (currentPrice - entryPrice) * (capital / entryPrice); // Assume full capital alloc
                    capital += pnl;
                    position = 0;
                    totalTrades++;
                    if (profitPct > 0) wins++;
                }
            }

            // Tracking metrics
            if (capital > peakCapital) peakCapital = capital;
            const drawdown = (peakCapital - capital) / peakCapital;
            if (drawdown > maxDrawdown) maxDrawdown = drawdown;

            // Add to chart data (every candle for resolution)
            chartData.push({
                date: dateStr.split('T')[0] + ' ' + dateStr.split('T')[1].substring(0, 5),
                pnl: capital - (params.initial_capital || 100000)
            });
        }

        const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
        const totalPnl = capital - (params.initial_capital || 100000);

        return {
            pnl: parseFloat(totalPnl.toFixed(2)),
            sharpe_ratio: 0, // Simplified for now
            max_drawdown: parseFloat((maxDrawdown * 100).toFixed(2)),
            win_rate: parseFloat(winRate.toFixed(1)),
            total_trades: totalTrades,
            final_value: parseFloat(capital.toFixed(2)),
            chart_data: chartData
        };
    }

    private runMockBacktest(params: BacktestParams): BacktestResult {
        throw new Error("Mock backtesting is disabled. Please invoke the Python backend for real backtests.");
    }
}
