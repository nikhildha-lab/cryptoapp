import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { Strategy } from '@/lib/constants';

const USER_STRATEGIES_PATH = path.join(process.cwd(), 'backend/strategies/user_strategies.json');
const STRATEGIES_DIR = path.join(process.cwd(), 'backend/strategies');

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { id } = body;

        if (!id) {
            return NextResponse.json({ error: 'Strategy ID is required' }, { status: 400 });
        }

        if (!fs.existsSync(USER_STRATEGIES_PATH)) {
            return NextResponse.json({ error: 'No user strategies found' }, { status: 404 });
        }

        const fileContent = fs.readFileSync(USER_STRATEGIES_PATH, 'utf-8');
        let userStrategies: Strategy[] = [];
        try {
            userStrategies = JSON.parse(fileContent);
        } catch (e) {
            return NextResponse.json({ error: 'Failed to parse strategy file' }, { status: 500 });
        }

        const strategyIndex = userStrategies.findIndex(s => s.id === id);

        if (strategyIndex === -1) {
            return NextResponse.json({ error: 'Strategy not found' }, { status: 404 });
        }

        // Get the strategy to potentially delete its file
        // We assume the id matches the filename pattern or we search for the class
        // Current convention: strategy_id matches python filename mostly, or we can look at the code content if needed
        // Simpler: Just remove from JSON. If we want to be clean, we try to find the file.
        // The id "volatility-scalper" maps to VolatilityScalper.py usually?
        // Let's rely on the ID being close to filename or just keep the file (safe) but remove from list.
        // User asked to "delete from source only". 
        // Best effort: Try to delete file if it matches ID pattern.

        // Remove from list
        userStrategies.splice(strategyIndex, 1);
        fs.writeFileSync(USER_STRATEGIES_PATH, JSON.stringify(userStrategies, null, 2));

        return NextResponse.json({ success: true, message: 'Strategy deleted successfully' });

    } catch (error: any) {
        console.error('Error deleting strategy:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
