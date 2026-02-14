
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Define paths
const DATA_DIR = path.join(process.cwd(), 'data');
const HEARTBEAT_FILE = path.join(DATA_DIR, 'engine_heartbeat.json');
const STRATEGIES_FILE = path.join(DATA_DIR, 'active_strategies.json'); // Actually user_strategies.json is source, active is runtime
const USER_STRATEGIES_FILE = path.join(process.cwd(), 'backend', 'strategies', 'user_strategies.json');

export async function GET() {
    const health = {
        engine: { status: 'unknown', latency: 0, message: '' },
        data: { status: 'unknown', message: '' },
        strategies: { status: 'unknown', count: 0, message: '' },
        system: { status: 'ok', message: 'System Online' }
    };

    try {
        // 1. Check Engine Heartbeat
        if (fs.existsSync(HEARTBEAT_FILE)) {
            const hb = JSON.parse(fs.readFileSync(HEARTBEAT_FILE, 'utf-8'));
            const lastBeat = new Date(hb.last_beat).getTime();
            const now = Date.now();
            const diff = (now - lastBeat) / 1000;

            if (diff < 30) {
                health.engine = { status: 'online', latency: Math.round(diff * 1000), message: 'Active' };
            } else {
                health.engine = { status: 'offline', latency: Math.round(diff * 1000), message: `Stalled (${Math.round(diff)}s ago)` };
            }
        } else {
            health.engine = { status: 'offline', latency: -1, message: 'No Heartbeat File' };
        }

        // 2. Check Data Purity (API Keys)
        // Note: Next.js server side process.env access
        // We check if keys are set (even if masked)
        const hasCoinApi = !!process.env.COINAPI_KEY || !!process.env.BINANCE_API_KEY;
        const hasAiKey = !!process.env.AI_API_KEY || !!process.env.OPENAI_API_KEY || !!process.env.GEMINI_API_KEY;

        if (hasCoinApi && hasAiKey) {
            health.data = { status: 'secure', message: 'Real Data & AI Keys Present' };
        } else if (hasCoinApi) {
            health.data = { status: 'warning', message: 'Missing AI Key' };
        } else {
            health.data = { status: 'critical', message: 'Missing Market Data Keys' };
        }

        // 3. Check Strategy Integrity
        if (fs.existsSync(USER_STRATEGIES_FILE)) {
            const strategies = JSON.parse(fs.readFileSync(USER_STRATEGIES_FILE, 'utf-8'));
            health.strategies = { status: 'valid', count: strategies.length, message: `${strategies.length} Strategies Loaded` };
        } else {
            health.strategies = { status: 'error', count: 0, message: 'user_strategies.json Missing' };
        }

    } catch (error: any) {
        console.error("Health check failed:", error);
        health.system = { status: 'error', message: 'Internal Check Failed' };
    }

    return NextResponse.json(health);
}
