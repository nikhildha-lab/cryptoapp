import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
    try {
        const healthPath = path.join(process.cwd(), 'data', 'feed_health.json');

        if (!fs.existsSync(healthPath)) {
            return NextResponse.json({
                success: true,
                error: "Health data not yet generated",
                health: null
            });
        }

        const content = fs.readFileSync(healthPath, 'utf8');
        const data = JSON.parse(content);

        return NextResponse.json({ success: true, ...data });
    } catch (error) {
        console.error("Feed Health API Error:", error);
        return NextResponse.json({ success: false, error: "Failed to load feed health" }, { status: 500 });
    }
}
