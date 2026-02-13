
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
    try {
        const reportPath = path.join(process.cwd(), 'data', 'model_efficiency_report.json');

        if (!fs.existsSync(reportPath)) {
            return NextResponse.json({
                success: true,
                error: "Report not yet generated",
                report: null
            });
        }

        const content = fs.readFileSync(reportPath, 'utf8');
        const report = JSON.parse(content);

        return NextResponse.json({ success: true, report });
    } catch (error) {
        console.error("Efficiency API Error:", error);
        return NextResponse.json({ success: false, error: "Failed to load efficiency report" }, { status: 500 });
    }
}
