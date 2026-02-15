
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);
const FAVORITES_FILE = path.join(process.cwd(), 'data', 'ai_picks.json');
const SCRIPT_PATH = path.join(process.cwd(), 'backend', 'scripts', 'identify_favorites.py');

export async function GET() {
    try {
        if (!fs.existsSync(FAVORITES_FILE)) {
            return NextResponse.json({ items: [] });
        }
        const data = fs.readFileSync(FAVORITES_FILE, 'utf-8');
        return NextResponse.json(JSON.parse(data));
    } catch (error) {
        console.error("Failed to read favorites:", error);
        return NextResponse.json({ success: false, error: "Failed to read favorites" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const threshold = body.threshold || 7.0;

        // Run the python script to refresh favorites
        const { stdout, stderr } = await execPromise(`python3 "${SCRIPT_PATH}" ${threshold}`);

        if (stderr && !stdout) {
            throw new Error(stderr);
        }

        if (fs.existsSync(FAVORITES_FILE)) {
            const data = fs.readFileSync(FAVORITES_FILE, 'utf-8');
            return NextResponse.json({
                success: true,
                message: "Favorites refreshed successfully",
                data: JSON.parse(data)
            });
        }

        return NextResponse.json({ success: false, error: "Favorites file not generated" }, { status: 500 });

    } catch (error: any) {
        console.error("Failed to refresh favorites:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
