
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
    try {
        const resultsPath = path.join(process.cwd(), 'backend', 'data', 'shortlisted_strategies.json');

        if (!fs.existsSync(resultsPath)) {
            return NextResponse.json({ success: true, results: [] });
        }

        const content = fs.readFileSync(resultsPath, 'utf8');
        const results = JSON.parse(content);

        return NextResponse.json({ success: true, results });
    } catch (error) {
        return NextResponse.json({ success: false, error: "Failed to load results" }, { status: 500 });
    }
}
