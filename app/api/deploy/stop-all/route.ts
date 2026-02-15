
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const ACTIVE_STRATEGIES_FILE = path.join(process.cwd(), 'data', 'active_strategies.json');

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { mode } = body; // Optional: stop only 'live' or 'paper'

        // COMMAND PATTERN: Write command to file instead of modifying state directly
        const command = {
            type: 'STOP_ALL',
            mode: mode || null, // Optional: stop only 'live' or 'paper'
            timestamp: new Date().toISOString()
        };

        const COMMANDS_FILE = path.join(process.cwd(), 'data', 'commands.json');

        // Read existing commands or start fresh
        let commands = [];
        if (fs.existsSync(COMMANDS_FILE)) {
            try {
                const data = JSON.parse(fs.readFileSync(COMMANDS_FILE, 'utf8'));
                commands = data.commands || [];
            } catch (e) {
                commands = [];
            }
        }

        commands.push(command);
        fs.writeFileSync(COMMANDS_FILE, JSON.stringify({ commands }, null, 2));

        return NextResponse.json({
            success: true,
            message: "Stop All command queued successfully"
        });

    } catch (error: any) {
        console.error("Stop all failed:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
