
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const BALANCE_FILE = path.join(DATA_DIR, 'balance.json');

export async function GET() {
    try {
        if (fs.existsSync(BALANCE_FILE)) {
            const data = fs.readFileSync(BALANCE_FILE, 'utf-8');
            const balance = JSON.parse(data);
            return NextResponse.json({ success: true, balance });
        } else {
            return NextResponse.json({ error: "Balance data unavailable" }, { status: 404 });
        }
    } catch (error: any) {
        return NextResponse.json({ success: false, error: "Failed to fetch balance" }, { status: 500 });
    }
}
