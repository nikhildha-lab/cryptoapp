
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
    try {
        const statusPath = path.join(process.cwd(), 'backend', 'data', 'optimization_status.json');

        if (fs.existsSync(statusPath)) {
            const content = fs.readFileSync(statusPath, 'utf-8');
            const data = JSON.parse(content);
            return NextResponse.json(data);
        } else {
            return NextResponse.json({ status: "idle" });
        }
    } catch (error) {
        return NextResponse.json({ status: "idle", error: "Failed to read status" });
    }
}
