import { NextResponse } from "next/server";

// Cache for Fear & Greed data (10 minutes TTL)
let cachedData: { data: any; timestamp: number } | null = null;
const CACHE_TTL = 600000; // 10 minutes

export async function GET() {
    const now = Date.now();

    // Check cache
    if (cachedData && (now - cachedData.timestamp) < CACHE_TTL) {
        return NextResponse.json(cachedData.data);
    }

    try {
        const res = await fetch("https://api.alternative.me/fng/");
        if (!res.ok) {
            throw new Error(`External API error: ${res.status}`);
        }

        const json = await res.json();

        // Structure the data clearly
        const indexData = json.data[0]; // Get the latest day
        const result = {
            value: parseInt(indexData.value),
            classification: indexData.value_classification,
            timestamp: parseInt(indexData.timestamp),
            last_update: indexData.time_until_update
        };

        // Update cache
        cachedData = { data: result, timestamp: now };

        return NextResponse.json(result);

    } catch (error) {
        console.error("Failed to fetch Fear & Greed Index:", error);

        return NextResponse.json(
            { error: "Failed to fetch Fear & Greed Index" },
            { status: 500 }
        );
    }
}
