export interface Strategy {
    id: string;
    name: string;
    type?: string;
    category: "Trend" | "Mean Reversion" | "Breakout" | "Volatility" | "Multi-Indicator" | "Scalping" | "AI";
    description: string;
    rating?: "A+" | "A" | "B" | "C" | "D" | "F";
    logic: {
        entry: string;
        exit: string;
        stopLoss: string;
        takeProfit: string;
    };
    params: Record<string, any>;
    optimalConditions: string;
    deployment?: {
        recommendedCapital?: number;
        leverage?: string;
        minCapital?: number;
        riskLevel?: string;
        bestSymbols?: string[];
        notes?: string;
    };
    code?: string;
}

export const EXCHANGES = [
    {
        id: 'binance',
        name: 'Binance',
        icon: 'https://cryptologos.cc/logos/binance-coin-bnb-logo.png',
        color: '#F3BA2F',
        active: true
    },
    {
        id: 'bybit',
        name: 'Bybit',
        icon: 'https://cryptologos.cc/logos/bybit-logo.png',
        color: '#000000',
        active: true
    },
    {
        id: 'okx',
        name: 'OKX',
        icon: 'https://cryptologos.cc/logos/okx-logo.png',
        color: '#FFFFFF',
        active: true
    },
    {
        id: 'coindcx',
        name: 'CoinDCX',
        icon: 'https://coindcx.com/assets/favicon.png',
        color: '#265CF2',
        active: true
    },
    {
        id: 'delta',
        name: 'Delta Exchange',
        icon: 'https://delta.exchange/favicon.ico',
        color: '#E91E63',
        active: true
    }
];

export const TIMEFRAMES = [
    { label: '1m', value: '1m' },
    { label: '5m', value: '5m' },
    { label: '15m', value: '15m' },
    { label: '30m', value: '30m' },
    { label: '1h', value: '1h' },
    { label: '4h', value: '4h' },
    { label: '1d', value: '1d' },
];

export const STRATEGIES: Strategy[] = [
    {
        id: "ndrt-strategy",
        name: "NDRT Trend Strategy",
        category: "Trend",
        description: "Fractal-based breakout with SAR & Trailing Stop. Optimized for 4h timeframes.",
        rating: "A+",
        logic: {
            entry: "High >= Top Buffer",
            exit: "Low <= Bottom Buffer (SAR) OR Trailing SL",
            stopLoss: "0.25% - 2% Trailing",
            takeProfit: "Dynamic (SAR)"
        },
        params: { symbol: "BTC/USDT", timeframe: "4h" },
        optimalConditions: "Strong trending markets with clear fractals",
        deployment: { recommendedCapital: 2500, leverage: "5-10x" }
    },
    {
        id: "triple-confirmation",
        name: "Triple Confirmation",
        category: "Multi-Indicator",
        description: "High-probability strategy combining RSI, MACD, and Volume confirmation.",
        rating: "A",
        logic: {
            entry: "RSI Oversold + MACD Bullish + Volume Spike",
            exit: "RSI Overbought OR MACD Bearish",
            stopLoss: "2%",
            takeProfit: "5%"
        },
        params: { symbol: "BTC/USDT", timeframe: "1h" },
        optimalConditions: "Clean trending markets with volume",
        deployment: { recommendedCapital: 1000, leverage: "3-5x" }
    },
    {
        id: "volatility-scalper",
        name: "Volatility Scalper",
        category: "Volatility",
        description: "Scalps coins when their volatility is significantly higher than BTC.",
        rating: "A",
        logic: {
            entry: "EMA Cross + Relative Volatility > 1.5x BTC",
            exit: "EMA Crossunder OR Stop Loss",
            stopLoss: "0.5%",
            takeProfit: "1.5%"
        },
        params: { symbol: "ETH/USDT", timeframe: "15m" },
        optimalConditions: "High relative volatility (Altseason)",
        deployment: { recommendedCapital: 1000, leverage: "5-10x" }
    },
    {
        id: "trend-momentum",
        name: "Trend Momentum",
        category: "Trend",
        description: "Trend-following with momentum confirmation (EMA + Stoch + ADX).",
        rating: "B",
        logic: {
            entry: "Price > EMA + Stoch Oversold Cross + ADX > 25",
            exit: "Price < EMA OR Stoch Overbought",
            stopLoss: "2.5%",
            takeProfit: "6%"
        },
        params: { symbol: "SOL/USDT", timeframe: "1h" },
        optimalConditions: "Strong trending markets",
        deployment: { recommendedCapital: 1500, leverage: "3-5x" }
    },
    {
        id: "mean-reversion-pro",
        name: "Mean Reversion Pro",
        category: "Mean Reversion",
        description: "Advanced mean reversion with triple oscillator confirmation.",
        rating: "B",
        logic: {
            entry: "RSI < 30 + Price at Lower BB + Williams %R < -80",
            exit: "RSI > 70 OR Price at Upper BB",
            stopLoss: "2%",
            takeProfit: "5%"
        },
        params: { symbol: "BTC/USDT", timeframe: "1h" },
        optimalConditions: "Ranging markets with high oscillator sensitivity",
        deployment: { recommendedCapital: 2000, leverage: "1-3x" }
    },
    {
        id: "ai-agent-pro",
        name: "AI Agent (Gemini 1.5 Pro)",
        category: "AI",
        description: "Autonomous reasoning engine powered by Google's Gemini 1.5 Pro. Analyzes market structure, momentum, and order flow in real-time.",
        rating: "A+",
        logic: {
            entry: "AI Confirmation (Trend + Momentum + Volume)",
            exit: "AI Reversal Signal OR Risk Limits",
            stopLoss: "Dynamic (AI Determined)",
            takeProfit: "Dynamic (AI Determined)"
        },
        params: { symbol: "BTC/USDT", timeframe: "1h" },
        optimalConditions: "Complex market conditions requiring semantic analysis",
        deployment: { recommendedCapital: 1000, leverage: "5x", bestSymbols: ["BTC/USDT", "ETH/USDT", "SOL/USDT"] }
    }
];
