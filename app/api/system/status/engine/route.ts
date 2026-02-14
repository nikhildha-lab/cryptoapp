
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

const HEARTBEAT_FILE = path.join(process.cwd(), 'data', 'engine_heartbeat.json');

export async function GET() {
    try {
        if (!fs.existsSync(HEARTBEAT_FILE)) {
            return NextResponse.json({ online: false, lastBeat: null });
        }

        const content = fs.readFileSync(HEARTBEAT_FILE, 'utf-8');
        const data = JSON.parse(content);
        const lastBeat = new Date(data.last_beat);
        const now = new Date();

        // Caclulate difference in seconds
        const diffSeconds = (now.getTime() - lastBeat.getTime()) / 1000;

        // Consider online if heartbeat within last 30 seconds
        const isOnline = diffSeconds < 30;

        return NextResponse.json({
            online: isOnline,
            lastBeat: data.last_beat,
            secondsAgo: Math.floor(diffSeconds)
        });

    } catch (error: any) {
        return NextResponse.json({ online: false, error: "Failed to check status" });
    }
}

export async function POST() {
    try {
        // Command to start the engine in background
        // Using nohup to keep it running after the request finishes
        // We assume .venv and backend structure exists as per project
        const rootDir = process.cwd();
        const command = `nohup ./.venv/bin/python3 backend/execution_engine.py > backend/execution.log 2>&1 &`;

        exec(command, { cwd: rootDir }, (error, stdout, stderr) => {
            if (error) {
                console.error(`exec error: ${error}`);
                return;
            }
            console.log(`Engine started: ${stdout}`);
        });

        return NextResponse.json({ success: true, message: "Engine start command issued" });
    } catch (error: any) {
        console.error("Failed to start engine:", error);
        return NextResponse.json({ success: false, error: "Failed to start engine" }, { status: 500 });
    }
}
