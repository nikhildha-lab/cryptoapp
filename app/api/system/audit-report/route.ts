
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Determine path to the artifact based on environment/knowledge
// Since artifacts are in a specific user dir, we might need to find it or use a copy.
// For now, let's assume we copy it to data/ or read from the known path if possible.
// Limitation: The Next.js app running in sandbox might not have access to the absolute path of the artifact 
// if it's strictly outside the project root in production, but here in dev we can try.
// BETTER APPROACH: Read from the local project if I copy it there, or just hardcore the path from metadata for now.

const AUDIT_PLAN_PATH = '/Users/nikhildhawan/.gemini/antigravity/brain/6aa1070c-2004-4f1e-81f7-59d8d40e05c4/comprehensive_audit_plan.md';

export async function GET() {
    try {
        if (fs.existsSync(AUDIT_PLAN_PATH)) {
            const content = fs.readFileSync(AUDIT_PLAN_PATH, 'utf-8');
            return NextResponse.json({ content });
        } else {
            return NextResponse.json({ content: "# Audit Plan Not Found\n\nThe file could not be located." });
        }
    } catch (error) {
        console.error("Failed to read audit plan", error);
        return NextResponse.json({ content: "Error reading audit plan." });
    }
}
