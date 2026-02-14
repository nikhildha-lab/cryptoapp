import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);
const CACHE_DIR = path.join(process.cwd(), '.cache');
const CACHE_FILE = path.join(CACHE_DIR, 'backtests.json');

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function getCache() {
    if (!fs.existsSync(CACHE_FILE)) return {};
    try {
        return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    } catch {
        return {};
    }
}

function saveToCache(key: string, data: any) {
    const cache = getCache();
    cache[key] = {
        data,
        timestamp: Date.now()
    };
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Validate required fields
        if (!body.strategy_id || !body.symbol) {
            return NextResponse.json(
                { error: 'Missing strategy_id or symbol' },
                { status: 400 }
            );
        }

        const strategyId = body.strategy_id || body.strategy || 'default';
        const symbol = body.symbol || 'BTC/USDT';
        const timeframe = body.timeframe || '1h';
        const period = body.period || '365';
        const leverage = body.leverage || '1';
        const capital = body.capital || '10000';

        const cacheKey = `${strategyId}-${symbol}-${timeframe}-${period}-${leverage}-${capital}`;
        const cache = getCache();

        if (cache[cacheKey]) {
            console.log(`Returning cached result for ${cacheKey}`);
            return NextResponse.json(cache[cacheKey].data);
        }

        // Call Python backtest runner
        const venvPython = path.join(process.cwd(), '.venv/bin/python3');
        const pythonExe = fs.existsSync(venvPython) ? venvPython : 'python3';
        const pythonScript = path.join(process.cwd(), 'backend/scripts/run_backtest.py');
        const command = `"${pythonExe}" "${pythonScript}" "${strategyId}" "${symbol}" "${timeframe}" "${leverage}" "${period}" "${capital}"`;

        try {
            const { stdout, stderr } = await execAsync(command, {
                timeout: 120000, // Increased timeout for longer periods
                maxBuffer: 1024 * 1024, // 1MB buffer
                env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
            });

            if (stderr && !stderr.includes('FutureWarning') && !stderr.includes('NotOpenSSLWarning')) {
                console.error('Python stderr:', stderr);
            }

            // Extact JSON from stdout (it might contain logs/warnings before the JSON)
            const jsonStart = stdout.indexOf('{');
            const jsonEnd = stdout.lastIndexOf('}');
            if (jsonStart === -1 || jsonEnd === -1) {
                throw new Error('No valid JSON found in Python output');
            }
            const jsonStr = stdout.substring(jsonStart, jsonEnd + 1);
            const result = JSON.parse(jsonStr);

            saveToCache(cacheKey, result);

            return NextResponse.json(result);

        } catch (execError: any) {
            console.error('Python execution error:', execError);
            return NextResponse.json(
                {
                    error: 'Backtest execution failed',
                    details: execError.message,
                    pnl: 0,
                    pnl_perc: 0,
                    win_rate: 0,
                    total_trades: 0,
                    sharpe_ratio: 0,
                    max_drawdown: 0
                },
                { status: 500 }
            );
        }

    } catch (error: any) {
        console.error('Backtest API Error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}

