
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini
// Note: This requires GEMINI_API_KEY or AI_API_KEY in .env
const apiKey = process.env.GEMINI_API_KEY || process.env.AI_API_KEY;

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const prompt = body.prompt;

        if (!prompt) {
            return NextResponse.json(
                { error: 'Missing prompt' },
                { status: 400 }
            );
        }

        if (!apiKey) {
            return NextResponse.json(
                { error: 'Configuration Error: GEMINI_API_KEY is missing. Please configure it in Settings or .env.local.' },
                { status: 401 }
            );
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

        const systemPrompt = `
    You are a Quantitative Strategy Consultant for a crypto trading platform.
    Your goal is to translate natural language trading strategies into strict JSON parameters for our backtesting engine.
    
    The JSON output must strictly adhere to this schema:
    {
        "reasoning": "Brief explanation of how you interpreted the user's request.",
        "params": {
            "symbol": "string (e.g. BTC/USDT)",
            "strategy": "string (currently only 'RSI' is supported)",
            "period": "integer (default 14)",
            "overbought": "integer (default 70)",
            "oversold": "integer (default 30)",
            "stop_loss": "float (e.g. 0.02 for 2%)",
            "take_profit": "float (e.g. 0.05 for 5%)",
            "timeframe": "string (e.g. 1h, 4h, 1d)"
        }
    }
    
    If the user's request is vague, use your knowledge of standard trading practices to fill in reasonable defaults (e.g. standard RSI settings).
    If the user requests a strategy other than RSI, explain in the "reasoning" that only RSI is currently supported but you've configured a standard RSI strategy as a placeholder.
    RETURN ONLY JSON. NO MARKDOWN.
    `;

        const result = await model.generateContent([
            systemPrompt,
            `User Request: "${prompt}"`
        ]);

        const responseText = result.response.text();

        // Clean up response if it contains markdown code blocks
        const cleanedText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

        const parsed = JSON.parse(cleanedText);

        return NextResponse.json(parsed);

    } catch (error: any) {
        console.error('Agent API Error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error', details: error.message },
            { status: 500 }
        );
    }
}
