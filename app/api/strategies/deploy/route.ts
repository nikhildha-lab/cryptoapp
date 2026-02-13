
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

const ACTIVE_STRATEGIES_FILE = path.join(process.cwd(), 'data', 'active_strategies.json');

export async function POST(req: Request) {
    try {
        const body = await req.json();

        // SUPPORT BATCH DEPLOYMENT
        const itemsToDeploy = Array.isArray(body) ? body : [body];

        if (itemsToDeploy.length === 0) {
            return NextResponse.json({ success: false, error: "Empty deployment" }, { status: 400 });
        }

        // 2. Read Existing Strategies (Atomic-ish Read)
        let strategies = [];
        if (fs.existsSync(ACTIVE_STRATEGIES_FILE)) {
            const raw = fs.readFileSync(ACTIVE_STRATEGIES_FILE, 'utf-8');
            try {
                strategies = JSON.parse(raw);
                if (!Array.isArray(strategies)) strategies = [];
            } catch (e) {
                strategies = [];
            }
        }

        const newIds = [];

        for (const item of itemsToDeploy) {
            const { strategyId, symbol, timeframe, leverage, params, mode } = item;

            // 1. Validate Input
            if (!strategyId || !symbol) {
                continue; // Skip invalid, don't fail batch
            }

            // 3. Generate Unique Instance Name
            const shortId = randomUUID().substring(0, 4).toUpperCase();
            const instanceName = `${strategyId.split('-').map((s: string) => s[0]).join('').toUpperCase()}-${shortId}`;

            // 4. Create New Strategy Entry
            const newStrategy = {
                ...params,
                id: randomUUID(),
                instanceName: instanceName,
                strategyId: strategyId,
                symbol: symbol,
                timeframe: timeframe || '1h',
                exchange: 'binance',
                mode: mode || 'paper',
                capital: 1000,
                leverage: leverage || 1,
                status: 'active',
                deployedAt: new Date().toISOString(),
                pnl: 0,
                trades: 0,
                position: null,
                unrealizedPnL: 0,
                unrealizedPnLPerc: 0
            };

            strategies.push(newStrategy);
            newIds.push(newStrategy.id);
        }

        // 4. Atomic Write
        fs.writeFileSync(ACTIVE_STRATEGIES_FILE, JSON.stringify(strategies, null, 2));

        return NextResponse.json({
            success: true,
            message: `Successfully deployed ${newIds.length} strategies`,
            ids: newIds
        });

    } catch (error) {
        console.error("Deploy Error:", error);
        return NextResponse.json({ success: false, error: "Failed to deploy strategy" }, { status: 500 });
    }
}
