
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

const FAVORITES_FILE = path.join(process.cwd(), 'data', 'ai_picks.json');
const ACTIVE_STRATEGIES_FILE = path.join(process.cwd(), 'data', 'active_strategies.json');

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));
        const selectedIds = body.ids || [];

        if (!fs.existsSync(FAVORITES_FILE)) {
            return NextResponse.json({ success: false, error: "No favorites found to deploy" }, { status: 404 });
        }

        const favoritesData = JSON.parse(fs.readFileSync(FAVORITES_FILE, 'utf-8'));
        let favorites = favoritesData.items || [];

        if (selectedIds.length > 0) {
            favorites = favorites.filter((f: any) => selectedIds.includes(f.id));
        }

        if (favorites.length === 0) {
            return NextResponse.json({ success: false, error: "No matching favorites found to deploy" }, { status: 400 });
        }

        // Read existing active strategies
        let activeStrategies = [];
        if (fs.existsSync(ACTIVE_STRATEGIES_FILE)) {
            const raw = fs.readFileSync(ACTIVE_STRATEGIES_FILE, 'utf-8');
            try {
                activeStrategies = JSON.parse(raw);
                if (!Array.isArray(activeStrategies)) activeStrategies = [];
            } catch (e) {
                activeStrategies = [];
            }
        }

        const newlyDeployedIds = [];

        for (const fav of favorites) {
            // Check if already deployed (to avoid duplicates by same strat|symbol|tf)
            // Note: We might allow duplicates if user wants, but typically they want unique configs.
            // For now, let's just append as new instances.

            const instanceId = randomUUID();
            const shortId = instanceId.substring(0, 4).toUpperCase();
            const instanceName = `FAV-${fav.strategyId.split('-').map((s: string) => s[0]).join('').toUpperCase()}-${shortId}`;

            const newStrategy = {
                id: instanceId,
                instanceName: instanceName,
                strategyId: fav.strategyId,
                symbol: fav.symbol,
                timeframe: fav.timeframe,
                exchange: 'binance',
                mode: 'paper',
                capital: 1000,
                leverage: 5,
                status: 'active',
                deployedAt: new Date().toISOString(),
                pnl: 0,
                trades: 0,
                position: null,
                unrealizedPnL: 0,
                unrealizedPnLPerc: 0,
                alphaSourceScore: fav.alpha_score
            };

            activeStrategies.push(newStrategy);
            newlyDeployedIds.push(instanceId);
        }

        // Save updated active strategies
        fs.writeFileSync(ACTIVE_STRATEGIES_FILE, JSON.stringify(activeStrategies, null, 2));

        return NextResponse.json({
            success: true,
            message: `Successfully deployed ${newlyDeployedIds.length} high-performing strategies`,
            deployedCount: newlyDeployedIds.length
        });

    } catch (error: any) {
        console.error("Failed to deploy favorites:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
