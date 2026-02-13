import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { Strategy } from '@/lib/constants';

// Map strategy IDs to their source files (for system strategies)
const STRATEGY_FILE_MAP: Record<string, string> = {
    // Optimization combos
    'triple-confirmation-optimized': 'combo_strategies.py',
    'trend-momentum-optimized': 'combo_strategies.py',
    'volatility-breakout-optimized': 'combo_strategies.py',
    'mean-reversion-pro-optimized': 'combo_strategies.py',
    'momentum-surge-optimized': 'combo_strategies.py',
    'smart-scalper-optimized': 'combo_strategies.py',
    'trend-rider-optimized': 'combo_strategies.py',
    'reversal-hunter-optimized': 'combo_strategies.py',

    // Single indicator strategies
    'rsi-mean-reversion': 'rsi.py',
    'macd-trend-following': 'basic_strategies.py',
    'bollinger-breakout': 'basic_strategies.py',

    // Legacy mapping (if needed)
};

const USER_STRATEGIES_PATH = path.join(process.cwd(), 'backend/strategies/user_strategies.json');

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const strategyId = searchParams.get('id');

        if (!strategyId) {
            return NextResponse.json({ error: 'Missing strategy id' }, { status: 400 });
        }

        // 1. Check User Strategies (JSON)
        if (fs.existsSync(USER_STRATEGIES_PATH)) {
            try {
                const fileContent = fs.readFileSync(USER_STRATEGIES_PATH, 'utf-8');
                const userStrategies: Strategy[] = JSON.parse(fileContent);
                const strategy = userStrategies.find(s => s.id === strategyId);

                if (strategy && strategy.code) {
                    return NextResponse.json({
                        id: strategyId,
                        source: 'user_defined',
                        code: strategy.code
                    });
                }
            } catch (e) {
                console.error("Error reading user strategies:", e);
            }
        }

        // 2. Check System Strategy Map OR Direct File Match
        let fileName = STRATEGY_FILE_MAP[strategyId];

        // If not mapped, try searching for ID.py or PascalCase ID
        if (!fileName) {
            // Try kebab-case to PascalCase (e.g. ndrt-strategy -> NDRTStrategy.py)
            // or just strategyId.py
            const potentialFiles = [
                `${strategyId}.py`,
                `${strategyId.replace(/-/g, '_')}.py`,
                // Simple PascalCase conversion attempt: ndrt-strategy -> NdrtStrategy.py (might not be perfect)
            ];

            for (const f of potentialFiles) {
                if (fs.existsSync(path.join(process.cwd(), 'backend/strategies', f))) {
                    fileName = f;
                    break;
                }
            }
        }

        // Default fallback if absolutely nothing found (return default system strategy code?)
        // Better to return 404 than wrong code.
        if (!fileName) {
            // As a last resort, check for default mapping
            fileName = STRATEGY_FILE_MAP['default'];
        }

        if (fileName) {
            const filePath = path.join(process.cwd(), 'backend/strategies', fileName);
            if (fs.existsSync(filePath)) {
                const fileContent = fs.readFileSync(filePath, 'utf-8');
                return NextResponse.json({
                    id: strategyId,
                    file: fileName,
                    code: fileContent
                });
            }
        }

        return NextResponse.json({ error: 'Strategy source code not found' }, { status: 404 });

    } catch (error) {
        console.error('Error fetching strategy code:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
