
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const ACTIVE_STRATEGIES_FILE = path.join(process.cwd(), 'data', 'active_strategies.json');

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { strategyId } = body;

        if (!strategyId) {
            return NextResponse.json({ error: "Missing strategyId" }, { status: 400 });
        }

        if (!fs.existsSync(ACTIVE_STRATEGIES_FILE)) {
            return NextResponse.json({ success: true, message: "No active strategies found" });
        }

        const fileContent = fs.readFileSync(ACTIVE_STRATEGIES_FILE, 'utf-8');
        let strategies = [];
        try {
            strategies = JSON.parse(fileContent);
        } catch (e) {
            return NextResponse.json({ error: "Failed to parse strategies file" }, { status: 500 });
        }

        const initialLength = strategies.length;
        // Filter out the strategy to be stopped
        const updatedStrategies = strategies.filter((s: any) => s.id !== strategyId);

        if (strategies.length === updatedStrategies.length) {
            return NextResponse.json({ success: false, message: "Strategy not found" }, { status: 404 });
        }

        fs.writeFileSync(ACTIVE_STRATEGIES_FILE, JSON.stringify(updatedStrategies, null, 2));

        return NextResponse.json({ success: true, message: "Strategy stopped and removed" });

    } catch (error: any) {
        console.error("Stop strategy failed:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
