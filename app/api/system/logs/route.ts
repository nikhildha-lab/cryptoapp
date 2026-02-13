
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const LOGS_FILE = path.join(process.cwd(), 'data', 'audit_logs.json');

export async function GET() {
    try {
        if (!fs.existsSync(LOGS_FILE)) {
            return NextResponse.json({ logs: [] });
        }
        const fileContent = fs.readFileSync(LOGS_FILE, 'utf-8');
        const logs = JSON.parse(fileContent);
        return NextResponse.json({ logs });
    } catch (error) {
        console.error("Failed to read logs", error);
        return NextResponse.json({ logs: [] });
    }
}

export async function DELETE() {
    try {
        if (fs.existsSync(LOGS_FILE)) {
            const currentLogs = fs.readFileSync(LOGS_FILE, 'utf-8');
            const archivePath = path.join(process.cwd(), 'data', 'archive_logs.json');

            // Append to archive (or create)
            // We'll read archive, parse, append, write back to keep valid JSON
            let archiveData = [];
            if (fs.existsSync(archivePath)) {
                try {
                    archiveData = JSON.parse(fs.readFileSync(archivePath, 'utf-8'));
                } catch (e) {
                    console.error("Failed to parse archive, starting fresh", e);
                }
            }

            let newLogs = [];
            try {
                newLogs = JSON.parse(currentLogs);
            } catch (e) {
                console.error("Failed to parse current logs", e);
            }

            if (Array.isArray(newLogs) && newLogs.length > 0) {
                archiveData = [...archiveData, ...newLogs];
                fs.writeFileSync(archivePath, JSON.stringify(archiveData, null, 2));
            }

            // Clear current logs
            fs.writeFileSync(LOGS_FILE, '[]');
        }

        return NextResponse.json({ success: true, message: "Logs archived and view reset" });
    } catch (error) {
        console.error("Failed to archive logs", error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
