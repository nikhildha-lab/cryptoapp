
import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const LOGS_FILE = path.join(process.cwd(), 'data', 'audit_logs.json');

function appendLog(message: string, level: "info" | "warning" | "error" | "success" = "info") {
    if (!message || message.trim() === '') return;

    try {
        // Ensure data directory exists
        const dataDir = path.dirname(LOGS_FILE);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        let logs = [];
        if (fs.existsSync(LOGS_FILE)) {
            const content = fs.readFileSync(LOGS_FILE, 'utf-8');
            try {
                logs = JSON.parse(content);
                if (!Array.isArray(logs)) logs = [];
            } catch {
                logs = [];
            }
        }

        const lines = message.split('\n').filter(line => line.trim() !== '');

        lines.forEach(line => {
            const newLog = {
                id: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
                level,
                source: "Optimizer",
                message: line.trim()
            };
            logs.unshift(newLog);
        });

        // Keep a healthy but not massive history
        logs = logs.slice(0, 200);
        fs.writeFileSync(LOGS_FILE, JSON.stringify(logs, null, 2));
    } catch (e) {
        console.error("Failed to write log", e);
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));
        const mode = body.mode || 'all';

        const scriptPath = path.join(process.cwd(), 'backend', 'scripts', 'genetic_optimizer.py');
        const pythonPath = path.join(process.cwd(), '.venv', 'bin', 'python3');
        const resultsPath = path.join(process.cwd(), 'backend', 'data', 'shortlisted_strategies.json');

        console.log(`[Optimizer] Starting optimization in mode: ${mode}`);
        console.log(`[Optimizer] Using script: ${scriptPath}`);
        console.log(`[Optimizer] Using python: ${pythonPath}`);

        // Clean up old list before populating new one
        if (fs.existsSync(resultsPath)) {
            fs.writeFileSync(resultsPath, JSON.stringify([], null, 2), 'utf-8');
        }

        appendLog(`Deep Optimization Engine Triggered (Mode: ${mode})`, "info");

        const gens = body.generations || 2;
        const pop = body.populationSize || 4;
        const lev = body.leverage || 5;
        const symbols = body.symbols && Array.isArray(body.symbols) ? body.symbols.join(',') : null;
        const tfs = body.timeframes && Array.isArray(body.timeframes) ? body.timeframes.join(',') : null;

        // Use -u for unbuffered output so we get logs in real-time
        // Inject PYTHONPATH so the script can import backend modules correctly
        const args = [
            '-u', scriptPath, 'deep',
            '--mode', mode,
            '--gens', gens.toString(),
            '--pop', pop.toString(),
            '--lev', lev.toString()
        ];

        if (symbols) args.push('--symbols', symbols);
        if (tfs) args.push('--tfs', tfs);
        if (body.retrySkipped) args.push('--retry-skipped');

        const child = spawn(pythonPath, args, {
            env: {
                ...process.env,
                PYTHONUNBUFFERED: '1',
                PYTHONPATH: process.cwd()
            }
        });

        child.stdout.on('data', (data) => {
            appendLog(data.toString(), "info");
        });

        child.stderr.on('data', (data) => {
            appendLog(data.toString(), "warning");
        });

        child.on('error', (err) => {
            console.error("Spawn error:", err);
            appendLog(`Engine process error: ${err.message}`, "error");
        });

        child.on('close', (code) => {
            appendLog(`Optimization Engine process closed with code ${code}`, code === 0 ? "success" : "error");
        });

        return NextResponse.json({ success: true, message: "Optimization task spawned" });

    } catch (error: any) {
        console.error("Optimization trigger failed:", error);
        appendLog("Failed to trigger optimization engine", "error");
        return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
    }
}

export async function DELETE() {
    try {
        const STATUS_FILE = path.join(process.cwd(), 'backend', 'data', 'optimization_status.json');

        if (fs.existsSync(STATUS_FILE)) {
            const status = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf-8'));
            if (status.status === 'running' && status.pid) {
                try {
                    process.kill(status.pid, 'SIGTERM'); // Try graceful first
                    appendLog(`Stopped Optimization Engine (PID: ${status.pid})`, "warning");

                    // Allow time for cleanup or force kill if needed
                    setTimeout(() => {
                        try {
                            process.kill(status.pid, 'SIGKILL');
                        } catch (e) { /* Process likely already dead */ }
                    }, 2000);

                } catch (e) {
                    console.error("Failed to kill process", e);
                    appendLog(`Failed to kill process ${status.pid}: ${e}`, "error");
                }
            }

            // Force update status
            fs.writeFileSync(STATUS_FILE, JSON.stringify({
                status: "stopped",
                lastRun: new Date().toISOString()
            }, null, 2));

            return NextResponse.json({ success: true, message: "Optimization stopped" });
        }

        return NextResponse.json({ success: false, message: "No running process found" });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
