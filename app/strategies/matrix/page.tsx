"use client";

import { useState, useRef } from "react";
import { STRATEGIES } from "@/lib/constants";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Download, ArrowUpDown, Rocket, Square } from "lucide-react";

interface StrategyResult {
    id: string;
    name: string;
    rating?: string;
    category: string;
    pnl: number;
    pnl_perc: number;
    leverage: number;
    winRate: number;
    totalTrades: number;
    sharpeRatio: number;
    maxDrawdown: number;
}

const PERIOD_OPTIONS = [
    { label: "7 Days", value: "7" },
    { label: "30 Days", value: "30" },
    { label: "90 Days", value: "90" },
    { label: "180 Days", value: "180" },
    { label: "365 Days", value: "365" },
    { label: "2 Years", value: "730" },
    { label: "3 Years", value: "1095" },
    { label: "5 Years", value: "1825" },
];

const LEVERAGE_OPTIONS = [
    { label: "1x (Spot)", value: "1" },
    { label: "2x", value: "2" },
    { label: "3x", value: "3" },
    { label: "5x", value: "5" },
    { label: "10x", value: "10" },
];

export default function PerformanceMatrixPage() {
    const [selectedCoin, setSelectedCoin] = useState("BTC/USDT");
    const [selectedTimeframe, setSelectedTimeframe] = useState("1h");
    const [selectedPeriod, setSelectedPeriod] = useState("365");
    const [selectedLeverage, setSelectedLeverage] = useState("1");
    const [results, setResults] = useState<StrategyResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [sortBy, setSortBy] = useState<keyof StrategyResult>("pnl");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

    const stopRequested = useRef(false);

    const handleSort = (column: keyof StrategyResult) => {
        if (sortBy === column) {
            setSortOrder(sortOrder === "asc" ? "desc" : "asc");
        } else {
            setSortBy(column);
            setSortOrder("desc");
        }
    };

    const sortedResults = [...results].sort((a, b) => {
        const aVal = a[sortBy];
        const bVal = b[sortBy];
        const multiplier = sortOrder === "asc" ? 1 : -1;

        if (typeof aVal === "number" && typeof bVal === "number") {
            return (aVal - bVal) * multiplier;
        }
        if (typeof aVal === "string" && typeof bVal === "string") {
            return (aVal || "").localeCompare(bVal || "") * multiplier;
        }
        return 0;
    });

    const stopTests = () => {
        stopRequested.current = true;
    };

    const runBulkTests = async () => {
        setLoading(true);
        stopRequested.current = false;
        setResults([]);
        const strategyIds = STRATEGIES.map(s => s.id);
        setProgress({ current: 0, total: strategyIds.length });

        const batchResults: StrategyResult[] = [];

        for (let i = 0; i < strategyIds.length; i++) {
            if (stopRequested.current) break;

            const strategyId = strategyIds[i];
            setProgress({ current: i + 1, total: strategyIds.length });

            try {
                const response = await fetch('/api/backtest', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        strategy_id: strategyId,
                        symbol: selectedCoin,
                        timeframe: selectedTimeframe,
                        period: selectedPeriod,
                        leverage: selectedLeverage
                    })
                });

                if (response.ok) {
                    const r = await response.json();
                    const formatted: StrategyResult = {
                        id: strategyId,
                        name: STRATEGIES.find(s => s.id === strategyId)?.name || strategyId,
                        rating: r.rating || STRATEGIES.find(s => s.id === strategyId)?.rating,
                        category: STRATEGIES.find(s => s.id === strategyId)?.category || 'Other',
                        pnl: r.pnl || 0,
                        pnl_perc: r.pnl_perc || 0,
                        leverage: r.leverage || parseInt(selectedLeverage),
                        winRate: r.win_rate || 0,
                        totalTrades: r.total_trades || 0,
                        sharpeRatio: r.sharpe_ratio || 0,
                        maxDrawdown: r.max_drawdown || 0,
                    };
                    batchResults.push(formatted);
                    setResults([...batchResults]);
                }
            } catch (error) {
                console.error(`Error testing ${strategyId}:`, error);
            }
        }

        setLoading(false);
    };

    const exportToCSV = () => {
        const headers = ["Strategy", "Category", "PnL", "Win Rate", "Trades", "Sharpe", "Max DD", "Rating"];
        const rows = sortedResults.map(r => [
            r.name,
            r.category,
            r.pnl,
            r.winRate,
            r.totalTrades,
            r.sharpeRatio,
            r.maxDrawdown,
            r.rating || "N/A"
        ]);

        const csv = [headers, ...rows].map(row => row.join(",")).join("\\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `strategy-performance-${selectedCoin.replace("/", "-")}-${selectedTimeframe}.csv`;
        a.click();
    };

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold mb-2">Performance Matrix</h1>
                    <p className="text-muted-foreground">
                        Compare all strategies side-by-side with historical period filters
                    </p>
                </div>
                {loading && (
                    <div className="bg-primary/10 px-4 py-2 rounded-full border border-primary/20 animate-pulse">
                        <span className="text-sm font-semibold text-primary">
                            Testing: {progress.current} / {progress.total}
                        </span>
                    </div>
                )}
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                                <label className="text-sm font-medium">Coin:</label>
                                <select
                                    value={selectedCoin}
                                    onChange={(e) => setSelectedCoin(e.target.value)}
                                    className="px-3 py-1.5 text-sm border rounded-md bg-background"
                                >
                                    <option value="BTC/USDT">BTC/USDT</option>
                                    <option value="ETH/USDT">ETH/USDT</option>
                                    <option value="BNB/USDT">BNB/USDT</option>
                                    <option value="SOL/USDT">SOL/USDT</option>
                                    <option value="XRP/USDT">XRP/USDT</option>
                                    <option value="ADA/USDT">ADA/USDT</option>
                                    <option value="AVAX/USDT">AVAX/USDT</option>
                                    <option value="DOT/USDT">DOT/USDT</option>
                                    <option value="MATIC/USDT">MATIC/USDT</option>
                                    <option value="LINK/USDT">LINK/USDT</option>
                                </select>
                            </div>

                            <div className="flex items-center gap-2">
                                <label className="text-sm font-medium">Timeframe:</label>
                                <select
                                    value={selectedTimeframe}
                                    onChange={(e) => setSelectedTimeframe(e.target.value)}
                                    className="px-3 py-1.5 text-sm border rounded-md bg-background"
                                >
                                    <option value="5m">5m</option>
                                    <option value="15m">15m</option>
                                    <option value="1h">1h</option>
                                    <option value="4h">4h</option>
                                    <option value="1d">1d</option>
                                </select>
                            </div>

                            <div className="flex items-center gap-2">
                                <label className="text-sm font-medium">Period:</label>
                                <select
                                    value={selectedPeriod}
                                    onChange={(e) => setSelectedPeriod(e.target.value)}
                                    className="px-3 py-1.5 text-sm border rounded-md bg-background"
                                >
                                    {PERIOD_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex items-center gap-2">
                                <label className="text-sm font-medium">Leverage:</label>
                                <select
                                    value={selectedLeverage}
                                    onChange={(e) => setSelectedLeverage(e.target.value)}
                                    className="px-3 py-1.5 text-sm border rounded-md bg-background"
                                >
                                    {LEVERAGE_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {!loading ? (
                                <Button onClick={runBulkTests}>
                                    <Play className="h-4 w-4 mr-2" />
                                    Run Tests
                                </Button>
                            ) : (
                                <Button onClick={stopTests} variant="destructive">
                                    <Square className="h-4 w-4 mr-2" />
                                    Stop
                                </Button>
                            )}
                            <Button onClick={exportToCSV} variant="outline" disabled={results.length === 0 || loading}>
                                <Download className="h-4 w-4 mr-2" />
                                Export CSV
                            </Button>
                        </div>
                    </div>
                </CardHeader>

                <CardContent>
                    {results.length === 0 && !loading ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <p className="mb-2">No results yet</p>
                            <p className="text-sm">Select parameters and click "Run Tests" to start benchmarking</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b text-xs uppercase tracking-wider text-muted-foreground">
                                        <th className="text-left p-2 font-semibold">
                                            <button onClick={() => handleSort("name")} className="flex items-center gap-1 hover:text-primary">
                                                Strategy <ArrowUpDown className="h-3 w-3" />
                                            </button>
                                        </th>
                                        <th className="text-center p-2 font-semibold">Rating</th>
                                        <th className="text-left p-2 font-semibold">
                                            <button onClick={() => handleSort("category")} className="flex items-center gap-1 hover:text-primary">
                                                Category <ArrowUpDown className="h-3 w-3" />
                                            </button>
                                        </th>
                                        <th className="text-center p-2 font-semibold">
                                            <button onClick={() => handleSort("leverage")} className="flex items-center gap-1 hover:text-primary mx-auto">
                                                Lev <ArrowUpDown className="h-3 w-3" />
                                            </button>
                                        </th>
                                        <th className="text-right p-2 font-semibold">
                                            <button onClick={() => handleSort("pnl")} className="flex items-center gap-1 hover:text-primary ml-auto">
                                                PnL <ArrowUpDown className="h-3 w-3" />
                                            </button>
                                        </th>
                                        <th className="text-right p-2 font-semibold">
                                            <button onClick={() => handleSort("pnl_perc")} className="flex items-center gap-1 hover:text-primary ml-auto">
                                                PnL % <ArrowUpDown className="h-3 w-3" />
                                            </button>
                                        </th>
                                        <th className="text-right p-2 font-semibold">
                                            <button onClick={() => handleSort("winRate")} className="flex items-center gap-1 hover:text-primary ml-auto">
                                                Win % <ArrowUpDown className="h-3 w-3" />
                                            </button>
                                        </th>
                                        <th className="text-right p-2 font-semibold">
                                            <button onClick={() => handleSort("totalTrades")} className="flex items-center gap-1 hover:text-primary ml-auto">
                                                Trades <ArrowUpDown className="h-3 w-3" />
                                            </button>
                                        </th>
                                        <th className="text-right p-2 font-semibold">
                                            <button onClick={() => handleSort("sharpeRatio")} className="flex items-center gap-1 hover:text-primary ml-auto">
                                                Sharpe <ArrowUpDown className="h-3 w-3" />
                                            </button>
                                        </th>
                                        <th className="text-right p-2 font-semibold">
                                            <button onClick={() => handleSort("maxDrawdown")} className="flex items-center gap-1 hover:text-primary ml-auto">
                                                Max DD <ArrowUpDown className="h-3 w-3" />
                                            </button>
                                        </th>
                                        <th className="text-center p-2 font-semibold">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedResults.map((result, index) => (
                                        <tr key={result.id} className={`border-b hover:bg-muted/50 ${index < 3 ? 'bg-green-500/5' : ''} text-xs`}>
                                            <td className="p-2 font-medium">{result.name}</td>
                                            <td className="p-2 text-center">
                                                {result.rating && (
                                                    <Badge variant="outline" className={`text-xs px-1.5 py-0.5 font-bold ${result.rating === 'A+' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                                                            result.rating === 'A' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                                                                result.rating === 'B' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                                                                    'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                                                        }`}>
                                                        {result.rating}
                                                    </Badge>
                                                )}
                                            </td>
                                            <td className="p-2">
                                                <Badge variant="outline" className="text-xs px-1.5 py-0.5 opacity-70">
                                                    {result.category}
                                                </Badge>
                                            </td>
                                            <td className="p-2 text-center font-mono opacity-80">{result.leverage}x</td>
                                            <td className={`p-2 text-right font-mono font-medium ${result.pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                ${result.pnl >= 0 ? '+' : ''}{result.pnl.toLocaleString()}
                                            </td>
                                            <td className={`p-2 text-right font-mono font-medium ${result.pnl_perc >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                {result.pnl_perc >= 0 ? '+' : ''}{result.pnl_perc}%
                                            </td>
                                            <td className="p-2 text-right font-mono">{result.winRate}%</td>
                                            <td className="p-2 text-right font-mono">{result.totalTrades}</td>
                                            <td className="p-2 text-right font-mono">{result.sharpeRatio.toFixed(2)}</td>
                                            <td className="p-2 text-right font-mono text-red-500">{result.maxDrawdown}%</td>
                                            <td className="p-2 text-center">
                                                <Button size="sm" variant="outline" className="h-7 text-xs px-2">
                                                    <Rocket className="h-3.5 w-3.5 mr-1" />
                                                    Deploy
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {results.length > 0 && (
                        <div className="mt-6 p-4 bg-muted/30 rounded-lg">
                            <h3 className="font-semibold mb-2">Summary</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                    <p className="text-muted-foreground">Total Strategies</p>
                                    <p className="text-xl font-bold">{results.length}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Profitable</p>
                                    <p className="text-xl font-bold text-green-500">
                                        {results.filter(r => r.pnl > 0).length}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Avg Win Rate</p>
                                    <p className="text-xl font-bold">
                                        {(results.reduce((sum, r) => sum + r.winRate, 0) / results.length).toFixed(1)}%
                                    </p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Total PnL</p>
                                    <p className={`text-xl font-bold ${results.reduce((sum, r) => sum + r.pnl, 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                        ${results.reduce((sum, r) => sum + r.pnl, 0).toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div >
    );
}
