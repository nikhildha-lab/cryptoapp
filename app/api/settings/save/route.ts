import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { keys } = body;

        if (!keys || typeof keys !== 'object') {
            return NextResponse.json({ error: "Invalid data format" }, { status: 400 });
        }

        const envFilePath = path.join(process.cwd(), '.env.local');

        // Read existing file if it exists
        let envContent = '';
        if (fs.existsSync(envFilePath)) {
            envContent = fs.readFileSync(envFilePath, 'utf-8');
        }

        // Parse existing env vars to avoid duplicates/overwrite cleanly
        const envVars: Record<string, string> = {};
        envContent.split('\n').forEach(line => {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                const value = match[2].trim();
                if (key && !key.startsWith('#')) {
                    envVars[key] = value;
                }
            }
        });

        // Update with new keys
        Object.entries(keys).forEach(([key, value]) => {
            if (value && typeof value === 'string' && value.trim() !== '') {
                // Determine if we need to quote the value? Usually not strictly necessary for simple keys, 
                // but good for safety if it contains spaces or special chars (though API keys usually don't).
                // For simplicity, we'll write as is unless it has spaces.
                envVars[key] = value as string; // Assert string
            }
        });

        // Reconstruct file content
        // We'll just rewrite the file with the map. Comments are lost in this simple parsing, 
        // but it ensures structure. If preserving comments is critical, we'd need a parser, 
        // but for .env.local usually it's fine.
        // Actually, to be safer and preserve comments/other structure, let's just append or replace lines.

        let newContent = envContent;
        Object.entries(keys).forEach(([key, value]) => {
            const keyRegex = new RegExp(`^${key}=.*`, 'm');
            if (keyRegex.test(newContent)) {
                // Replace existing
                newContent = newContent.replace(keyRegex, `${key}=${value}`);
            } else {
                // Append
                if (!newContent.endsWith('\n') && newContent.length > 0) newContent += '\n';
                newContent += `${key}=${value}\n`;
            }
        });

        fs.writeFileSync(envFilePath, newContent, 'utf-8');

        return NextResponse.json({ success: true, message: "Configuration saved successfully. You may need to restart the server for changes to take full effect in all modules." });
    } catch (error) {
        console.error("Failed to save settings:", error);
        return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
    }
}
