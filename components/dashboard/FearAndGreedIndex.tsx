"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Gauge } from "lucide-react";

interface FearAndGreedData {
    value: number;
    classification: string;
    timestamp: number;
    error?: string;
}

export function FearAndGreedIndex({ compact = false }: { compact?: boolean }) {
    const [data, setData] = useState<FearAndGreedData | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch("/api/fear-and-greed");
                if (!res.ok) throw new Error("Network Error");
                const json = await res.json();
                setData(json);
                setError(false);
            } catch (error) {
                console.error("Failed to fetch Fear & Greed Index:", error);
                setError(true);
            }
        };

        fetchData();
        // Poll every 5 minutes
        const interval = setInterval(fetchData, 300000);
        return () => clearInterval(interval);
    }, []);

    const value = data?.value || 50;
    const classification = data?.classification || "Neutral";

    // Determine color based on value
    const getColor = (val: number) => {
        if (error) return "text-gray-500";
        if (val <= 25) return "text-red-500"; // Extreme Fear
        if (val <= 45) return "text-orange-500"; // Fear
        if (val <= 55) return "text-yellow-500"; // Neutral
        if (val <= 75) return "text-lime-500"; // Greed
        return "text-green-500"; // Extreme Greed
    };

    const colorClass = getColor(value);

    if (compact) {
        return (
            <div className="flex items-center gap-3 bg-white dark:bg-black/20 px-4 py-2 rounded-lg border border-white dark:border-white/10 shadow-sm">
                <div className="flex flex-col items-end">
                    <span className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Market Mood</span>
                    <span className={`text-sm font-bold ${colorClass}`}>{classification}</span>
                </div>
                <div className={`flex items-center justify-center h-10 w-10 rounded-full border-4 ${colorClass.replace("text-", "border-")} bg-white dark:bg-black`}>
                    <span className={`text-xs font-bold ${colorClass}`}>{value}</span>
                </div>
            </div>
        );
    }

    return (
        <Card className="h-full flex flex-col justify-between">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Gauge className="h-4 w-4" />
                    Fear & Greed Index
                </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center flex-1 pb-6">
                <div className="relative w-32 h-16 overflow-hidden">
                    {/* Gauge Background */}
                    <div className="absolute top-0 left-0 w-full h-full bg-muted rounded-t-full border-t-8 border-l-8 border-r-8 border-muted/20 box-border"></div>

                    {/* Gauge Fill (rough approximation with rotation) */}
                    <div
                        className={`absolute top-0 left-0 w-full h-full rounded-t-full border-t-8 border-l-8 border-r-8 transition-all duration-1000 ease-out origin-bottom ${colorClass.replace("text-", "border-")}`}
                        style={{ transform: `rotate(${(value / 100) * 180 - 180}deg)` }}
                    ></div>
                </div>

                <div className="text-center mt-[-10px] z-10">
                    <span className={`text-4xl font-bold ${colorClass}`}>
                        {error ? "--" : value}
                    </span>
                </div>

                <div className="text-sm font-medium mt-2 text-muted-foreground">
                    {error ? "OFFLINE" : classification}
                </div>
            </CardContent>
        </Card>
    );
}
