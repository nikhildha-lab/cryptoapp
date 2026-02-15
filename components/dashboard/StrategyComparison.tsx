"use client";

import { useState, useRef, Fragment } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Play, ChevronDown, ChevronUp, Square, Rocket, Trash2, CheckSquare, XCircle } from "lucide-react";
import { toast } from "sonner";

import { STRATEGIES as STATIC_STRATEGIES, Strategy } from "@/lib/constants";
import { useStrategies } from "@/hooks/useStrategies";
import { ExchangeSelector } from "@/components/dashboard/ExchangeSelector";

interface BacktestResult {
    pnl: number;
    pnl_perc: number;
    sharpe_ratio: number;
    max_drawdown: number;
    win_rate: number;
    total_trades: number;
    final_value: number;
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
    { label: "1x", value: "1" },
    { label: "2x", value: "2" },
    { label: "3x", value: "3" },
    { label: "5x", value: "5" },
    { label: "10x", value: "10" },
];

const categoryColors = {
    "Trend": "bg-blue-500/10 text-blue-500 border-blue-500/20",
    "Mean Reversion": "bg-purple-500/10 text-purple-500 border-purple-500/20",
    "Breakout": "bg-orange-500/10 text-orange-500 border-orange-500/20",
    "Volatility": "bg-red-500/10 text-red-500 border-red-500/20",
    "Multi-Indicator": "bg-green-500/10 text-green-500 border-green-500/20",
    "Scalping": "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    "AI": "bg-purple-500/10 text-purple-500 border-purple-500/20"
};

export function StrategyComparison() {
    const { strategies, loading: strategiesLoading } = useStrategies();
    const router = useRouter();
    const [results, setResults] = useState<Record<string, BacktestResult | null>>({});
    const [loading, setLoading] = useState<Record<string, boolean>>({});
    const [expandedStrategy, setExpandedStrategy] = useState<string | null>(null);
    const [shortlisted, setShortlisted] = useState<Set<string>>(new Set());
    const [deployed, setDeployed] = useState<Set<string>>(new Set());

    // Bulk testing filters
    const [selectedCoin, setSelectedCoin] = useState("BTC/USDT");
    const [selectedTimeframe, setSelectedTimeframe] = useState("1h");
    const [selectedPeriod, setSelectedPeriod] = useState("365");
    const [selectedLeverage, setSelectedLeverage] = useState("1");
    const [selectedCapital, setSelectedCapital] = useState("10000"); // Default $10k
    const [selectedExchange, setSelectedExchange] = useState("binance");
    const [bulkTestProgress, setBulkTestProgress] = useState({ current: 0, total: 0, running: false });

    const stopRequested = useRef(false);

    const ratingColors = {
        'A+': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
        'A': 'bg-green-500/10 text-green-500 border-green-500/20',
        'B': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
        'C': 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
        'D': 'bg-orange-500/10 text-orange-500 border-orange-500/20',
        'F': 'bg-red-500/10 text-red-500 border-red-500/20',
    };

    const toggleShortlist = (strategyId: string) => {
        setShortlisted(prev => {
            const newSet = new Set(prev);
            if (newSet.has(strategyId)) {
                newSet.delete(strategyId);
            } else {
                newSet.add(strategyId);
            }
            return newSet;
        });
    };

    const toggleDeploy = (strategyId: string) => {
        setDeployed(prev => {
            const newSet = new Set(prev);
            if (newSet.has(strategyId)) {
                newSet.delete(strategyId);
            } else {
                newSet.add(strategyId);
            }
            return newSet;
        });
    };

    const runBacktest = async (strategy: Strategy, overrideParams?: any) => {
        setLoading(prev => ({ ...prev, [strategy.id]: true }));

        try {
            const response = await fetch("/api/backtest", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    strategy_id: strategy.id,
                    symbol: overrideParams?.symbol || strategy.params.symbol,
                    timeframe: overrideParams?.timeframe || strategy.params.timeframe,
                    period: selectedPeriod,
                    leverage: selectedLeverage,
                    capital: selectedCapital
                })
            });

            const result = await response.json();
            setResults(prev => ({ ...prev, [strategy.id]: result }));
        } catch (error) {
            console.error(`Failed to backtest ${strategy.name}:`, error);
            toast.error(`Backtest failed for ${strategy.name}`, {
                description: "Check console for details or try again later."
            });
        } finally {
            setLoading(prev => ({ ...prev, [strategy.id]: false }));
        }
    };

    const stopTests = () => {
        stopRequested.current = true;
    };

    const runAllBacktests = async () => {
        stopRequested.current = false;
        setBulkTestProgress({ current: 0, total: strategies.length, running: true });

        for (let i = 0; i < strategies.length; i++) {
            if (stopRequested.current) break;

            const strategy = strategies[i];
            setBulkTestProgress({ current: i + 1, total: strategies.length, running: true });

            await runBacktest(strategy, {
                symbol: selectedCoin,
                timeframe: selectedTimeframe
            });
        }

        setBulkTestProgress(prev => ({ ...prev, running: false }));
    };

    const [deleting, setDeleting] = useState<string | null>(null);

    const isSystemStrategy = (id: string) => {
        return STATIC_STRATEGIES.some(s => s.id === id);
    };

    const handleDelete = async (strategyId: string) => {
        if (!confirm("Are you sure you want to delete this strategy? This action cannot be undone.")) {
            return;
        }

        setDeleting(strategyId);
        try {
            const response = await fetch("/api/strategies/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: strategyId })
            });

            const data = await response.json();

            if (response.ok) {
                toast.success("Strategy deleted successfully");
                // Refresh strategies
                window.location.reload(); // Simple reload to refresh list, or we could use a refetch from hook if exposed
            } else {
                toast.error(data.error || "Failed to delete strategy");
            }
        } catch (error) {
            console.error("Delete error:", error);
            toast.error("An error occurred while deleting");
        } finally {
            setDeleting(null);
        }
    };

    return (
        <Card className="col-span-4">
            <CardHeader>
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <CardTitle>Performance Matrix</CardTitle>
                        <CardDescription>
                            Compare, backtest, and deploy from 32 proven strategies.
                        </CardDescription>
                    </div>
                </div>

                {/* Filters and Bulk Actions */}
                <div className="flex items-center gap-3 flex-wrap border-t pt-4">
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
                            <option value="3m">3m</option>
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

                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium">Capital ($):</label>
                        <input
                            type="number"
                            value={selectedCapital}
                            onChange={(e) => setSelectedCapital(e.target.value)}
                            className="px-3 py-1.5 text-sm border rounded-md bg-background w-24"
                        />
                    </div>

                    <div className="flex items-center gap-2 border-l pl-3 ml-1">
                        <label className="text-sm font-medium">Exchange:</label>
                        <ExchangeSelector
                            value={selectedExchange}
                            onValueChange={setSelectedExchange}
                            className="w-[140px] h-9"
                        />
                    </div>

                    <div className="flex items-center gap-2 border-l pl-3 ml-2">
                        <Button
                            onClick={() => {
                                setShortlisted(new Set());
                                setResults({});
                                setLoading({});
                            }}
                            variant="ghost"
                            size="sm"
                            disabled={shortlisted.size === 0 && Object.keys(results).length === 0}
                            className="h-8 text-[10px] px-2 text-muted-foreground hover:text-red-500 disabled:opacity-50"
                            title="Reset All Data"
                        >
                            <XCircle className="h-3 w-3 mr-1" />
                            Reset
                        </Button>
                    </div>

                    {!bulkTestProgress.running ? (
                        <Button
                            onClick={runAllBacktests}
                            variant="default"
                            size="sm"
                            className="ml-auto"
                        >
                            <Play className="h-4 w-4 mr-2" />
                            Run
                        </Button>
                    ) : (
                        <Button
                            onClick={stopTests}
                            variant="destructive"
                            size="sm"
                            className="ml-auto"
                        >
                            <Square className="h-4 w-4 mr-2" />
                            Stop
                        </Button>
                    )}

                    <Button
                        variant="outline"
                        size="sm"
                        disabled={bulkTestProgress.running}
                        onClick={() => {
                            const allIds = strategies.map(s => s.id).join(",");
                            router.push(`/deploy?shortlist=${allIds}&coin=${selectedCoin}&timeframe=${selectedTimeframe}&leverage=${selectedLeverage}&exchange=${selectedExchange}`);
                        }}
                        className="border-cyan-500/50 text-cyan-500 hover:bg-cyan-500/10"
                    >
                        <Rocket className="h-4 w-4 mr-2" />
                        Deploy All
                    </Button>

                    {shortlisted.size > 0 && (
                        <Button
                            onClick={() => {
                                const ids = Array.from(shortlisted).join(",");
                                router.push(`/deploy?shortlist=${ids}&coin=${selectedCoin}&timeframe=${selectedTimeframe}&leverage=${selectedLeverage}&exchange=${selectedExchange}`);
                            }}
                            className="bg-cyan-600 hover:bg-cyan-700 text-white"
                            size="sm"
                        >
                            <Rocket className="h-4 w-4 mr-2" />
                            Deploy {shortlisted.size} Selected
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50">
                                <TableHead className="w-[40px] px-2">
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4 rounded border-gray-300"
                                        checked={shortlisted.size === strategies.length}
                                        onChange={() => {
                                            if (shortlisted.size === strategies.length) {
                                                setShortlisted(new Set());
                                            } else {
                                                setShortlisted(new Set(strategies.map(s => s.id)));
                                            }
                                        }}
                                    />
                                </TableHead>
                                <TableHead className="w-[30px]"></TableHead>
                                <TableHead className="font-medium">Strategy</TableHead>
                                {/* Removed redundant Timeframe column */}
                                <TableHead>Category</TableHead>
                                <TableHead>Rating</TableHead>
                                <TableHead className="text-right">Win Rate</TableHead>
                                <TableHead className="text-right">Trades</TableHead>
                                <TableHead className="text-right">Sharpe</TableHead>
                                <TableHead className="text-right">Drawdown</TableHead>
                                <TableHead className="text-right">PnL</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {strategies.map((strategy) => {
                                const result = results[strategy.id];
                                const isLoading = loading[strategy.id];
                                const isExpanded = expandedStrategy === strategy.id;
                                const isSystem = isSystemStrategy(strategy.id);

                                return (
                                    <Fragment key={strategy.id}>
                                        <TableRow key={strategy.id} className={`group ${shortlisted.has(strategy.id) ? "bg-cyan-500/5 hover:bg-cyan-500/10" : ""}`}>
                                            <TableCell className="px-2">
                                                <input
                                                    type="checkbox"
                                                    className="h-4 w-4 rounded border-gray-300"
                                                    checked={shortlisted.has(strategy.id)}
                                                    onChange={() => toggleShortlist(strategy.id)}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6"
                                                    onClick={() => setExpandedStrategy(isExpanded ? null : strategy.id)}
                                                >
                                                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                </Button>
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                <div className="flex items-center gap-2">
                                                    {strategy.name}
                                                    {strategy.type === 'AI_AGENT' && (
                                                        <Badge variant="default" className="text-[10px] px-1 py-0 h-4 bg-purple-600 hover:bg-purple-700">AI AGENT</Badge>
                                                    )}
                                                    {shortlisted.has(strategy.id) && (
                                                        <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">Shortlisted</Badge>
                                                    )}
                                                    {deployed.has(strategy.id) && (
                                                        <Badge variant="default" className="text-[10px] px-1 py-0 h-4 bg-cyan-600">Deployed</Badge>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant="outline"
                                                    className={`${categoryColors[strategy.category]} text-[10px] px-2 py-0.5`}
                                                >
                                                    {strategy.category}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {strategy.rating && (
                                                    <Badge
                                                        variant="outline"
                                                        className={`${ratingColors[strategy.rating]} font-bold text-[10px] px-2 py-0.5`}
                                                    >
                                                        {strategy.rating}
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {result ? `${result.win_rate}%` : "-"}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {result ? result.total_trades : "-"}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {result ? result.sharpe_ratio.toFixed(2) : "-"}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {result ? (
                                                    <span className="text-red-400">-{result.max_drawdown.toFixed(1)}%</span>
                                                ) : "-"}
                                            </TableCell>
                                            <TableCell className={`text-right font-mono ${result && result.pnl >= 0 ? "text-green-500" : "text-red-500"}`}>
                                                {result ? (
                                                    <>
                                                        {result.pnl >= 0 ? "+" : ""}${(result.pnl ?? 0).toLocaleString()}
                                                        <div className="text-[10px] opacity-70">
                                                            {result.pnl_perc >= 0 ? "+" : ""}{result.pnl_perc}%
                                                        </div>
                                                    </>
                                                ) : "-"}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        onClick={() => runBacktest(strategy)}
                                                        disabled={isLoading}
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-8 w-8 p-0"
                                                    >
                                                        {isLoading ? <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" /> : <Play className="h-4 w-4" />}
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-8 text-xs"
                                                        onClick={() => router.push(`/deploy?strategyId=${strategy.id}&coin=${selectedCoin}&timeframe=${selectedTimeframe}&leverage=${selectedLeverage}`)}
                                                    >
                                                        Deploy
                                                    </Button>
                                                    {!isSystem && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                                                            disabled={deleting === strategy.id}
                                                            onClick={() => handleDelete(strategy.id)}
                                                            title="Delete Strategy"
                                                        >
                                                            {deleting === strategy.id ? (
                                                                <div className="animate-spin h-3 w-3 border-2 border-red-500 border-t-transparent rounded-full" />
                                                            ) : (
                                                                <Trash2 className="h-4 w-4" />
                                                            )}
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                        {isExpanded && (
                                            <TableRow className="bg-muted/50 hover:bg-muted/50">
                                                <TableCell colSpan={10} className="p-4">
                                                    <div className="grid grid-cols-2 gap-8 text-sm">
                                                        <div className="space-y-4">
                                                            <div>
                                                                <h4 className="font-semibold mb-2">Strategy Logic</h4>
                                                                <div className="space-y-2 text-muted-foreground">
                                                                    <div className="grid grid-cols-[100px_1fr]">
                                                                        <span className="text-green-500 font-medium">Entry:</span>
                                                                        <span>{strategy.logic.entry}</span>
                                                                    </div>
                                                                    <div className="grid grid-cols-[100px_1fr]">
                                                                        <span className="text-red-500 font-medium">Exit:</span>
                                                                        <span>{strategy.logic.exit}</span>
                                                                    </div>
                                                                    <div className="grid grid-cols-[100px_1fr]">
                                                                        <span className="font-medium">Stop Loss:</span>
                                                                        <span>{strategy.logic.stopLoss}</span>
                                                                    </div>
                                                                    <div className="grid grid-cols-[100px_1fr]">
                                                                        <span className="font-medium">Take Profit:</span>
                                                                        <span>{strategy.logic.takeProfit}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <h4 className="font-semibold mb-1">Description</h4>
                                                                <p className="text-muted-foreground">{strategy.description}</p>
                                                            </div>
                                                        </div>

                                                        {strategy.deployment && (
                                                            <div className="bg-background border rounded-lg p-4">
                                                                <h4 className="font-semibold text-cyan-500 mb-3 flex items-center gap-2">
                                                                    <span className="h-2 w-2 rounded-full bg-cyan-500"></span>
                                                                    Deployment Recommendations
                                                                </h4>
                                                                <div className="grid grid-cols-2 gap-4">
                                                                    <div>
                                                                        <span className="text-muted-foreground text-xs block">Min Capital</span>
                                                                        <span className="font-mono">${strategy.deployment?.minCapital || "500"}</span>
                                                                    </div>
                                                                    <div>
                                                                        <span className="text-muted-foreground text-xs block">Recommended</span>
                                                                        <span className="font-mono">${strategy.deployment?.recommendedCapital || "1000"}</span>
                                                                    </div>
                                                                    <div>
                                                                        <span className="text-muted-foreground text-xs block">Risk Level</span>
                                                                        <Badge variant="outline" className="mt-1">{strategy.deployment?.riskLevel || "Low"}</Badge>
                                                                    </div>
                                                                    <div>
                                                                        <span className="text-muted-foreground text-xs block">Leverage</span>
                                                                        <span>{strategy.deployment?.leverage || "1x"}</span>
                                                                    </div>
                                                                </div>
                                                                <div className="mt-4 pt-4 border-t">
                                                                    <span className="text-muted-foreground text-xs block mb-1">Best Symbols</span>
                                                                    <div className="flex gap-1 flex-wrap">
                                                                        {strategy.deployment?.bestSymbols?.map(s => (
                                                                            <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </Fragment>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
