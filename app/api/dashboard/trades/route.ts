
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const TRADES_FILE = path.join(DATA_DIR, 'trade_history.json');

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const strategyId = searchParams.get('strategyId');

        if (!fs.existsSync(TRADES_FILE)) {
            return NextResponse.json({ success: true, trades: [] });
        }

        const data = fs.readFileSync(TRADES_FILE, 'utf-8');
        let trades = JSON.parse(data);

        if (strategyId) {
            trades = trades.filter((t: any) => t.strategyId === strategyId);
        }

        return NextResponse.json({ success: true, trades });
    } catch (error) {
        return NextResponse.json({ success: false, error: "Failed to fetch trades" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        if (fs.existsSync(TRADES_FILE)) {
            fs.writeFileSync(TRADES_FILE, JSON.stringify([]), 'utf-8');
        }
        return NextResponse.json({ success: true, message: "Logs reset successfully" });
    } catch (error) {
        return NextResponse.json({ success: false, error: "Failed to reset trades" }, { status: 500 });
    }
}
