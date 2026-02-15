import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const COMMANDS_FILE = path.join(DATA_DIR, 'commands.json');

export async function POST(request: Request) {
    try {
        // COMMAND PATTERN: Write command to file instead of modifying state directly
        const command = {
            type: 'RESET_ALL',
            timestamp: new Date().toISOString()
        };

        // Read existing commands or start fresh
        let commands = [];
        if (fs.existsSync(COMMANDS_FILE)) {
            try {
                const data = JSON.parse(fs.readFileSync(COMMANDS_FILE, 'utf8'));
                commands = data.commands || [];
            } catch (e) {
                // corrupted file, start fresh
                commands = [];
            }
        }

        commands.push(command);

        fs.writeFileSync(COMMANDS_FILE, JSON.stringify({ commands }, null, 2));

        return NextResponse.json({ success: true, message: 'Global reset command queued successfully' });

    } catch (error) {
        console.error('Error queuing global reset command:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
