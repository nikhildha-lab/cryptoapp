import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const ACTIVE_STRATEGIES_FILE = path.join(process.cwd(), 'data', 'active_strategies.json');

// Ensure data directory exists
if (!fs.existsSync(path.join(process.cwd(), 'data'))) {
    fs.mkdirSync(path.join(process.cwd(), 'data'));
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { strategyId, exchange, mode, capital, leverage, symbolOverride, timeframeOverride } = body;

        if (!strategyId || !exchange || !mode || !capital) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Check if exchange keys exist (double enforcement)
        const envKey = mode === 'live' ?
            (exchange === 'binance' ? 'BINANCE_API_KEY' :
                exchange === 'coindcx' ? 'COINDCX_API_KEY' : 'KRAKEN_API_KEY')
            : null;

        if (mode === 'live' && envKey && !process.env[envKey]) {
            return NextResponse.json({ error: `Missing API Key for ${exchange} in environment variables` }, { status: 403 });
        }

        // Read existing strategies
        let strategies = [];
        if (fs.existsSync(ACTIVE_STRATEGIES_FILE)) {
            const fileContent = fs.readFileSync(ACTIVE_STRATEGIES_FILE, 'utf-8');
            try {
                strategies = JSON.parse(fileContent);
            } catch (e) {
                console.error("Failed to parse active strategies", e);
            }
        }

        const newStrategy = {
            id: crypto.randomUUID(),
            strategyId,
            symbol: symbolOverride,
            timeframe: timeframeOverride,
            exchange,
            mode,
            capital,
            leverage,
            status: "active",
            deployedAt: new Date().toISOString(),
            pnl: 0, // Initial PnL
            trades: 0
        };

        strategies.push(newStrategy);
        fs.writeFileSync(ACTIVE_STRATEGIES_FILE, JSON.stringify(strategies, null, 2));

        return NextResponse.json({ success: true, strategy: newStrategy });

    } catch (error: any) {
        console.error("Deployment failed:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
