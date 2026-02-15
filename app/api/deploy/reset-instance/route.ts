import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const COMMANDS_FILE = path.join(DATA_DIR, 'commands.json');

export async function POST(request: Request) {
    try {
        const { instanceId } = await request.json();

        if (!instanceId) {
            return NextResponse.json({ success: false, error: 'Instance ID is required' }, { status: 400 });
        }

        // COMMAND PATTERN: Write command to file instead of modifying state directly
        // because Python engine holds state in memory and overwrites file constantly.
        const command = {
            type: 'RESET_INSTANCE',
            instanceId: instanceId,
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

        return NextResponse.json({ success: true, message: 'Reset command queued successfully' });

    } catch (error) {
        console.error('Error queuing reset command:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
