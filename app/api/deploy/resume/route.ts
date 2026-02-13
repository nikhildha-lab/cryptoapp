
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
            return NextResponse.json({ success: false, message: "No active strategies found" }, { status: 404 });
        }

        const fileContent = fs.readFileSync(ACTIVE_STRATEGIES_FILE, 'utf-8');
        let strategies = JSON.parse(fileContent);

        const index = strategies.findIndex((s: any) => s.id === strategyId);
        if (index === -1) {
            return NextResponse.json({ success: false, message: "Strategy not found" }, { status: 404 });
        }

        // Set status back to active
        strategies[index].status = 'active';

        fs.writeFileSync(ACTIVE_STRATEGIES_FILE, JSON.stringify(strategies, null, 2));

        return NextResponse.json({ success: true, message: "Strategy resumed" });

    } catch (error: any) {
        console.error("Resume strategy failed:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
