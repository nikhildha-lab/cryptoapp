
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const LOGS_FILE = path.join(process.cwd(), 'data', 'audit_logs.json');

export async function POST() {
    try {
        // Simple fetch to CoinDCX public ticker (or Binance if CoinDCX fails/is tricky without keys)
        // CoinDCX public ticker: https://public.coindcx.com/market_data/trade_history?pair=B-BTC_USDT (Example) or just use Binance for reliability in this demo context if user keys aren't set up for server-side ccxt yet.
        // Let's us Binance public API for the "Data Feed" check as verified in execution engine.
        // Or better, use proper ccxt logic if we could, but a simple fetch is faster for a "Test Button".

        let price = "0";
        let source = "Binance (Public)";

        try {
            const res = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT');
            if (res.ok) {
                const data = await res.json();
                price = parseFloat(data.price).toFixed(2);
            } else {
                throw new Error("Binance API unreachable");
            }
        } catch (e) {
            // Fallback or error
            source = "CoinDCX/Binance";
            console.error("Feed test failed", e);
            appendLog("System Test", "Data Feed Connection Failed: " + (e as Error).message, "error");
            return NextResponse.json({ success: false, message: "Connection Failed" });
        }

        const message = `Data Feed Active. BTC/USDT: $${price} via ${source}`;
        appendLog("System Test", message, "success");

        return NextResponse.json({ success: true, message });

    } catch (error) {
        return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
    }
}

function appendLog(source: string, message: string, level: string) {
    try {
        let logs = [];
        if (fs.existsSync(LOGS_FILE)) {
            const content = fs.readFileSync(LOGS_FILE, 'utf-8');
            try { logs = JSON.parse(content); } catch { }
        }

        const newLog = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            level,
            source,
            message
        };

        logs.unshift(newLog); // Add to top
        logs = logs.slice(0, 50); // Keep last 50

        fs.writeFileSync(LOGS_FILE, JSON.stringify(logs, null, 2));
    } catch (e) {
        console.error("Failed to write log", e);
    }
}
