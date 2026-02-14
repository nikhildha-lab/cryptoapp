import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { STRATEGIES, Strategy } from '@/lib/constants';

const USER_STRATEGIES_PATH = path.join(process.cwd(), 'backend/strategies/user_strategies.json');

export async function GET() {
    try {
        let userStrategies: Strategy[] = [];

        if (fs.existsSync(USER_STRATEGIES_PATH)) {
            const fileContent = fs.readFileSync(USER_STRATEGIES_PATH, 'utf-8');
            try {
                userStrategies = JSON.parse(fileContent);
            } catch (e) {
                console.error("Failed to parse user_strategies.json", e);
            }
        }

        // Merge system strategies with user strategies, deduplicating by ID
        // Prioritize user strategies (from JSON) over static constants
        const strategyMap = new Map<string, Strategy>();

        // 1. Load static strategies first
        STRATEGIES.forEach(s => strategyMap.set(s.id, s));

        // 2. Overwrite with user strategies (active configuration)
        userStrategies.forEach(s => strategyMap.set(s.id, s));

        const allStrategies = Array.from(strategyMap.values());

        return NextResponse.json(allStrategies);
    } catch (error: any) {
        console.error('Error fetching strategies:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
