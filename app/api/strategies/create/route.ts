
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { Strategy } from '@/lib/constants';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini
const apiKey = process.env.GEMINI_API_KEY;

const STRATEGIES_DIR = path.join(process.cwd(), 'backend/strategies');
const USER_STRATEGIES_FILE = path.join(STRATEGIES_DIR, 'user_strategies.json');

export async function POST(request: NextRequest) {
    try {
        if (!apiKey) {
            return NextResponse.json(
                { error: 'Configuration Error: GEMINI_API_KEY is missing.' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { name, description, content } = body;

        if (!name || !content) {
            return NextResponse.json(
                { error: 'Name and content are required' },
                { status: 400 }
            );
        }

        // 1. Initialize AI
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

        // 2. Generate Python Code
        const strategyId = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
        const className = name.replace(/[^a-zA-Z0-9]/g, '') + 'Strategy';

        const systemPrompt = `
        You are an expert Python developer specializing in Backtrader strategies.
        Your task is to convert the user's trading logic (which might be text, Pine Script, or Python snippets) into a complete, valid Backtrader strategy class.
        
        Requirements:
        1. Class Name: ${className}
        2. Inheritance: Inherit from 'BaseStrategy' (assume it's imported from .base).
        3. Indicators: Use standard bt.indicators.
        4. Logic: accurate implementation of the user's logic.
        5. Structure:
           - __init__: Initialize indicators
           - next: logic for buy/sell
        6. OUTPUT: Return ONLY the Python code. No markdown. No comments outside the code.
        7. Do NOT include 'import backtrader as bt' if it's not needed, but usually it is. Actually, assumes 'from .base import BaseStrategy' is available.
        8. Imports:
           from .base import BaseStrategy
           import backtrader as bt
        `;

        const result = await model.generateContent([
            systemPrompt,
            `User Strategy Logic: "${content}"`
        ]);

        const code = result.response.text().replace(/```python/g, '').replace(/```/g, '').trim();

        // 3. Save Python File
        const fileName = `User_${strategyId}.py`;
        const filePath = path.join(STRATEGIES_DIR, fileName);

        // Ensure imports are correct
        const finalCode = code.startsWith('from') || code.startsWith('import') ? code : `from .base import BaseStrategy\nimport backtrader as bt\n\n${code}`;

        fs.writeFileSync(filePath, finalCode);

        // 4. Update Metadata JSON
        let strategies: Strategy[] = [];
        if (fs.existsSync(USER_STRATEGIES_FILE)) {
            strategies = JSON.parse(fs.readFileSync(USER_STRATEGIES_FILE, 'utf-8'));
        }

        // Infer params (simple default for now)
        const params = {
            strategy: "Custom",
            symbol: "BTC/USDT",
            timeframe: "1h"
        };

        // infer logic description from user content or ask AI (skipping for speed)

        const newStrategy: Strategy = {
            id: `user-${strategyId}`,
            name: name,
            category: "Multi-Indicator", // Default
            description: description || "User generated strategy",
            logic: {
                entry: "Custom logic",
                exit: "Custom logic",
                stopLoss: "Dynamic",
                takeProfit: "Dynamic"
            },
            params: params,
            optimalConditions: "Unknown",
            rating: "B", // Default
            deployment: {
                minCapital: 1000,
                recommendedCapital: 5000,
                leverage: "1x",
                bestSymbols: ["BTC/USDT"],
                riskLevel: "Medium",
                notes: "User generated."
            }
        };

        strategies = [newStrategy, ...strategies];
        fs.writeFileSync(USER_STRATEGIES_FILE, JSON.stringify(strategies, null, 2));

        return NextResponse.json({ success: true, strategy: newStrategy });

    } catch (error: any) {
        console.error('Error creating strategy:', error);
        return NextResponse.json(
            { error: 'Internal Server Error', details: error.message },
            { status: 500 }
        );
    }
}
