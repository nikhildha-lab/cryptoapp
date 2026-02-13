import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { symbol, timeframe, strategies } = body;

        if (!symbol || !timeframe || !strategies || !Array.isArray(strategies)) {
            return NextResponse.json(
                { error: 'Missing symbol, timeframe or strategies list' },
                { status: 400 }
            );
        }

        const venvPython = path.join(process.cwd(), '.venv/bin/python3');
        const pythonExe = require('fs').existsSync(venvPython) ? venvPython : 'python3';
        const pythonScript = path.join(process.cwd(), 'backend/scripts/run_backtest.py');
        const results = [];

        // Run backtests sequentially to avoid overwhelming the system/API rate limits
        for (const strategyId of strategies) {
            try {
                const command = `"${pythonExe}" "${pythonScript}" "${strategyId}" "${symbol}" "${timeframe}"`;
                const { stdout } = await execAsync(command, { timeout: 30000 });
                const jsonStart = stdout.indexOf('{');
                const jsonEnd = stdout.lastIndexOf('}');
                if (jsonStart === -1 || jsonEnd === -1) {
                    throw new Error('No valid JSON found in output');
                }
                const jsonStr = stdout.substring(jsonStart, jsonEnd + 1);
                const result = JSON.parse(jsonStr);
                results.push({
                    id: strategyId,
                    name: strategyId.replace(/-/g, ' ').split(' ').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
                    ...result
                });
            } catch (error: any) {
                console.error(`Error backtesting strategy ${strategyId}:`, error);
                results.push({
                    id: strategyId,
                    name: strategyId.replace(/-/g, ' ').split(' ').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
                    error: true,
                    pnl: 0,
                    win_rate: 0,
                    total_trades: 0,
                    sharpe_ratio: 0,
                    max_drawdown: 0
                });
            }
        }

        return NextResponse.json({ results });

    } catch (error) {
        console.error('Bulk Backtest API Error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
