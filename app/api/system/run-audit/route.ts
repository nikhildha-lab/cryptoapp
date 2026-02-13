
import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';

export async function POST() {
    const scriptPath = path.join(process.cwd(), 'backend', 'scripts', 'audit_system.py');

    return new Promise<NextResponse>((resolve) => {
        exec(`python3 "${scriptPath}"`, (error, stdout, stderr) => {
            if (error) {
                console.error("Audit script error:", error);
                resolve(NextResponse.json({
                    success: false,
                    output: stdout + "\n" + stderr,
                    message: "Audit Failed"
                }));
                return;
            }

            resolve(NextResponse.json({
                success: true,
                output: stdout,
                message: "Audit Passed"
            }));
        });
    });
}
