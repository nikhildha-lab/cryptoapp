
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const ACTIVE_STRATEGIES_FILE = path.join(process.cwd(), 'data', 'active_strategies.json');

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { mode } = body; // Optional: stop only 'live' or 'paper'

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

        let updatedStrategies = [];
        if (mode) {
            // Only remove strategies of a specific mode
            updatedStrategies = strategies.filter((s: any) => s.mode !== mode);
        } else {
            // Remove all
            updatedStrategies = [];
        }

        fs.writeFileSync(ACTIVE_STRATEGIES_FILE, JSON.stringify(updatedStrategies, null, 2));

        return NextResponse.json({
            success: true,
            message: mode ? `All ${mode} strategies stopped` : "All strategies stopped",
            count: strategies.length - updatedStrategies.length
        });

    } catch (error: any) {
        console.error("Stop all failed:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
