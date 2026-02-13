import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const initialMarketData = [
    { symbol: "BTC", change: 0, price: 0 },
    { symbol: "ETH", change: 0, price: 0 },
    { symbol: "SOL", change: 0, price: 0 },
    { symbol: "BNB", change: 0, price: 0 },
    { symbol: "XRP", change: 0, price: 0 },
    { symbol: "ADA", change: 0, price: 0 },
    { symbol: "AVAX", change: 0, price: 0 },
    { symbol: "DOGE", change: 0, price: 0 },
    { symbol: "DOT", change: 0, price: 0 },
    { symbol: "MATIC", change: 0, price: 0 },
    { symbol: "LINK", change: 0, price: 0 },
    { symbol: "UNI", change: 0, price: 0 },
    { symbol: "LTC", change: 0, price: 0 },
    { symbol: "BCH", change: 0, price: 0 },
    { symbol: "ETC", change: 0, price: 0 },
    { symbol: "FIL", change: 0, price: 0 },
];

export function MarketSentiment() {
    const [data, setData] = useState(initialMarketData);

    useEffect(() => {
        const fetchAll = async () => {
            const updatedData = await Promise.all(
                initialMarketData.map(async (coin) => {
                    try {
                        const res = await fetch(`/api/market-data?symbol=${coin.symbol}`);
                        if (!res.ok) throw new Error("Failed"); // Force catch
                        const apiData = await res.json();
                        return { ...coin, ...apiData, error: false };
                    } catch (e) {
                        return { ...coin, error: true, price: 0, change: 0 };
                    }
                })
            );
            setData(updatedData);
        };

        fetchAll();
        const interval = setInterval(fetchAll, 15000);
        return () => clearInterval(interval);
    }, []);

    return (
        <Card className="w-full bg-slate-900/50 border-slate-800 backdrop-blur-sm overflow-hidden">
            <CardContent className="p-2">
                <div className="flex items-center gap-3 mb-2 px-1">
                    <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Global Market Intel</span>
                    </div>
                    <div className="h-[1px] flex-1 bg-slate-800" />
                    <Badge variant="outline" className="text-[9px] bg-blue-500/5 border-blue-500/20 text-blue-400 py-0 h-4">Live Feed</Badge>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 xl:grid-cols-16 gap-1.5">
                    {data.map((coin) => (
                        <div
                            key={coin.symbol}
                            className={`p-1.5 rounded border flex flex-col items-center justify-center transition-all hover:scale-105 ${(coin as any).error
                                ? "bg-slate-800/50 border-slate-700/50 opacity-50"
                                : coin.change >= 0 ? "bg-green-500/5 border-green-500/10 hover:bg-green-500/10" : "bg-red-500/5 border-red-500/10 hover:bg-red-500/10"
                                }`}
                        >
                            <div className="flex items-center gap-1 w-full justify-between">
                                <span className="font-bold text-[10px] text-slate-200">{coin.symbol}</span>
                                <span className={`text-[9px] font-bold ${(coin as any).error ? "text-slate-500" : coin.change >= 0 ? "text-green-400" : "text-red-400"
                                    }`}>
                                    {(coin as any).error ? "!!" : `${coin.change > 0 ? "+" : ""}${coin.change}%`}
                                </span>
                            </div>
                            <div className="w-full h-[1px] bg-slate-800/50 my-0.5" />
                            <span className="text-[9px] text-slate-500 font-mono">
                                {(coin as any).error ? "---" : `$${(coin.price ?? 0).toLocaleString(undefined, { minimumFractionDigits: coin.price < 1 ? 4 : 2, maximumFractionDigits: coin.price < 1 ? 4 : 2 })}`}
                            </span>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
