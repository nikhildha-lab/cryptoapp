import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { STRATEGIES, Strategy } from '@/lib/constants';

const USER_STRATEGIES_PATH = path.join(process.cwd(), 'backend/strategies/user_strategies.json');
const ACTIVE_STRATEGIES_PATH = path.join(process.cwd(), 'data/active_strategies.json');

export async function GET() {
    try {
        let userStrategies: Strategy[] = [];
        let activeStrategies: any[] = [];

        // 1. Load User Strategies
        if (fs.existsSync(USER_STRATEGIES_PATH)) {
            try {
                const fileContent = fs.readFileSync(USER_STRATEGIES_PATH, 'utf-8');
                userStrategies = JSON.parse(fileContent);
            } catch (e) {
                console.error("Failed to parse user_strategies.json", e);
            }
        }

        // 2. Load Active Strategies (to get AI Agents)
        if (fs.existsSync(ACTIVE_STRATEGIES_PATH)) {
            try {
                const fileContent = fs.readFileSync(ACTIVE_STRATEGIES_PATH, 'utf-8');
                activeStrategies = JSON.parse(fileContent);
            } catch (e) {
                console.error("Failed to parse active_strategies.json", e);
            }
        }

        const strategyMap = new Map<string, Strategy>();

        // 3. Load static strategies first
        STRATEGIES.forEach(s => strategyMap.set(s.id, s));

        // 4. Merge User Strategies
        userStrategies.forEach(s => strategyMap.set(s.id, s));

        // 5. Merge AI Active Strategies
        activeStrategies.forEach(s => {
            if (s.type === 'AI_AGENT') {
                // Convert active strategy format to Strategy interface if needed
                const aiStrategy: Strategy = {
                    id: s.id,
                    name: s.instanceName || s.strategyId,
                    type: "AI_AGENT",
                    category: "AI",
                    description: "AI Agent powered by Gemini 1.5 Pro. Analyzes market structure, momentum, and order flow.",
                    rating: "A+",
                    logic: {
                        entry: "AI Decision (Buy/Sell)",
                        exit: "AI Decision (Sell/Buy) or Risk Limits",
                        stopLoss: "Dynamic (Technical)",
                        takeProfit: "Dynamic (Technical)"
                    },
                    params: s,
                    optimalConditions: "Complex market conditions requiring semantic analysis",
                    deployment: {
                        recommendedCapital: 2000,
                        leverage: "5x",
                        bestSymbols: [s.symbol]
                    }
                };
                strategyMap.set(s.id, aiStrategy);
            }
        });

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
