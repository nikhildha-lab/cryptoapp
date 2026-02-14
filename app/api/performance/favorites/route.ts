import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const FAVORITES_FILE = path.join(process.cwd(), "data", "favorites.json");

function ensureDirectoryExistence(filePath: string) {
    const dirname = path.dirname(filePath);
    if (fs.existsSync(dirname)) return true;
    fs.mkdirSync(dirname, { recursive: true });
}

export async function GET() {
    try {
        if (!fs.existsSync(FAVORITES_FILE)) {
            return NextResponse.json({ success: true, favorites: [] });
        }
        const data = fs.readFileSync(FAVORITES_FILE, "utf-8");
        return NextResponse.json({ success: true, favorites: JSON.parse(data) });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: "Failed to load favorites" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const item = await req.json();
        // item expected: { strategyId, symbol, timeframe, leverage, params }

        let favorites = [];
        if (fs.existsSync(FAVORITES_FILE)) {
            favorites = JSON.parse(fs.readFileSync(FAVORITES_FILE, "utf-8"));
        } else {
            ensureDirectoryExistence(FAVORITES_FILE);
        }

        // Check if already exists (using symbol-timeframe-strategyId as unique key)
        const key = `${item.symbol}-${item.timeframe}-${item.strategyId}`.toUpperCase();
        const index = favorites.findIndex((f: any) =>
            `${f.symbol}-${f.timeframe}-${f.strategyId}`.toUpperCase() === key
        );

        if (index > -1) {
            // Remove if exists (Toggle behavior)
            favorites.splice(index, 1);
            fs.writeFileSync(FAVORITES_FILE, JSON.stringify(favorites, null, 2));
            return NextResponse.json({ success: true, message: "Removed from favorites", action: "removed" });
        } else {
            // Add if doesn't exist
            favorites.push(item);
            fs.writeFileSync(FAVORITES_FILE, JSON.stringify(favorites, null, 2));
            return NextResponse.json({ success: true, message: "Added to favorites", action: "added" });
        }

    } catch (error: any) {
        return NextResponse.json({ success: false, error: "Failed to update favorites" }, { status: 500 });
    }
}
