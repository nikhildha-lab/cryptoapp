
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const TRADES_FILE = path.join(DATA_DIR, 'trade_history.json');
const ACTIVE_FILE = path.join(DATA_DIR, 'active_strategies.json');
const TRAINING_POOL_FILE = path.join(DATA_DIR, 'training_pool.json');

export async function POST() {
    try {
        if (!fs.existsSync(TRADES_FILE)) {
            return NextResponse.json({ success: true, message: "No history to clear" });
        }

        // 1. Get Active Instance IDs
        let activeIds = new Set<string>();
        if (fs.existsSync(ACTIVE_FILE)) {
            const activeData = JSON.parse(fs.readFileSync(ACTIVE_FILE, 'utf-8'));
            activeData.forEach((s: any) => {
                activeIds.add(s.id);
                if (s.instanceName) activeIds.add(s.instanceName);
                if (s.strategyId) activeIds.add(s.strategyId);
            });
        }

        // 2. Load Trade History
        const trades = JSON.parse(fs.readFileSync(TRADES_FILE, 'utf-8'));

        const activeHistory: any[] = [];
        const stoppedHistory: any[] = [];

        trades.forEach((trade: any) => {
            const id = trade.instanceId || trade.strategyId;
            if (activeIds.has(id)) {
                activeHistory.push(trade);
            } else {
                stoppedHistory.push(trade);
            }
        });

        // 3. Push Stopped to Training Pool
        if (stoppedHistory.length > 0) {
            let trainingPool: any[] = [];
            if (fs.existsSync(TRAINING_POOL_FILE)) {
                try {
                    trainingPool = JSON.parse(fs.readFileSync(TRAINING_POOL_FILE, 'utf-8'));
                } catch (e) {
                    trainingPool = [];
                }
            }

            // Append with metadata
            const batch = {
                pushedAt: new Date().toISOString(),
                trades: stoppedHistory
            };

            trainingPool.push(batch);
            fs.writeFileSync(TRAINING_POOL_FILE, JSON.stringify(trainingPool, null, 2));
        }

        // 4. Update Trade History (Keep only active)
        fs.writeFileSync(TRADES_FILE, JSON.stringify(activeHistory, null, 2));

        return NextResponse.json({
            success: true,
            message: `Cleared and pushed ${stoppedHistory.length} trades to training pool.`,
            clearedCount: stoppedHistory.length,
            retainedCount: activeHistory.length
        });

    } catch (error: any) {
        console.error("Clear and Push failed:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
