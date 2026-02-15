
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { RefreshCw, Play, TrendingUp, AlertTriangle, Info, Square, ListChecks, Settings2, Heart, Brain, Target } from 'lucide-react';
import { AgentLog } from '@/components/dashboard/AgentLog';
import { MetricsHeader } from '@/components/dashboard/MetricsHeader';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import { toast } from "sonner";

interface StrategyResult {
    id: string;
    strategyId: string;
    symbol: string;
    timeframe: string;
    leverage: number;
    pnl: number;
    sharpe?: number;
    drawdown?: number;
    winRate?: number;
    totalTrades?: number;
    winningStreak?: number;
    losingStreak?: number;
    numCandles?: number;
    trades?: any[];
    params: any;
    rating: string;
}

export default function PerformancePage() {
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [results, setResults] = useState<StrategyResult[]>([]);
    const [loadingResults, setLoadingResults] = useState(false);
    const [deployMode, setDeployMode] = useState<"paper" | "live">("paper");
    const [optimizationMode, setOptimizationMode] = useState<"scalp" | "swing" | "all">("all");

    // Custom Tuning Parameters
    const [backtestDays, setBacktestDays] = useState(1095);

    // Advanced Filters
    const [selectedSymbols, setSelectedSymbols] = useState<string[]>([]);
    const [selectedTimeframes, setSelectedTimeframes] = useState<string[]>([]);
    const [minTradesFilter, setMinTradesFilter] = useState(0);

    // Favorites
    const [favorites, setFavorites] = useState<Set<string>>(new Set());
    const [favoriteItems, setFavoriteItems] = useState<StrategyResult[]>([]);

    const [activeDeployments, setActiveDeployments] = useState<any[]>([]);
    const [efficiencyReport, setEfficiencyReport] = useState<any>(null);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

    const fetchEfficiencyReport = async () => {
        try {
            const res = await fetch('/api/performance/efficiency');
            const data = await res.json();
            if (data.report) {
                setEfficiencyReport(data.report);
            }
        } catch (e) {
            console.error("Failed to fetch efficiency report", e);
        }
    };

    const fetchActiveStrategies = async () => {
        try {
            const res = await fetch('/api/dashboard/data'); // Use dashboard API for actual active list
            const data = await res.json();
            if (data.strategies && Array.isArray(data.strategies)) {
                setActiveDeployments(data.strategies);
            }
        } catch (e) {
            console.error("Failed to fetch active strategies", e);
        }
    };

    useEffect(() => {
        fetchActiveStrategies();
        fetchResults();
        fetchFavorites();
        fetchEfficiencyReport();
    }, []);

    const checkExactActive = (strat: StrategyResult) => {
        return activeDeployments.some(a =>
            a.symbol === strat.symbol &&
            a.timeframe === strat.timeframe &&
            (a.strategyId === strat.strategyId || a.strategy === strat.strategyId) &&
            a.leverage === strat.leverage &&
            Object.entries(strat.params || {}).every(([k, v]) => a[k] === v)
        );
    };

    const fetchFavorites = async () => {
        try {
            const res = await fetch('/api/performance/favorites');
            const data = await res.json();
            if (data.success && Array.isArray(data.favorites)) {
                setFavoriteItems(data.favorites);
                setFavorites(new Set(data.favorites.map((f: any) =>
                    `${f.symbol}-${f.timeframe}-${f.strategyId}`.toUpperCase()
                )));
            }
        } catch (e) {
            console.error("Failed to fetch favorites", e);
        }
    };

    const toggleFavorite = async (item: StrategyResult) => {
        try {
            const res = await fetch('/api/performance/favorites', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item)
            });
            const data = await res.json();
            if (data.success) {
                toast.success(data.message);
                fetchFavorites();
            }
        } catch (e) {
            toast.error("Failed to update favorite");
        }
    };

    const fetchResults = async () => {
        setLoadingResults(true);
        try {
            const res = await fetch('/api/performance/results');
            const data = await res.json();
            if (data.success && Array.isArray(data.results)) {
                setResults(data.results);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingResults(false);
        }
    };

    // Check for running optimization on mount
    useEffect(() => {
        const checkStatus = async () => {
            try {
                const res = await fetch('/api/performance/optimize/status');
                const data = await res.json();
                if (data.status === 'running') {
                    setIsOptimizing(true);
                    if (data.mode) setOptimizationMode(data.mode as any);
                    toast.info("Resuming Optimization Stream", { description: "The engine is still processing in the background." });

                    // Resume polling
                    const interval = setInterval(fetchResults, 3000);
                    // Clear interval when component unmounts or optimization stops
                    return () => clearInterval(interval);
                }
            } catch (e) {
                console.error("Failed to check status", e);
            }
        };

        checkStatus();
    }, []);

    const runOptimization = async (retrySkipped: boolean = false) => {
        setIsOptimizing(true);
        // setResults([]); // Don't clear results anymore as we have history now!

        toast.info(retrySkipped ? "Retrying Skipped Coins..." : `Deep Optimization Started (${optimizationMode.toUpperCase()})`, {
            description: `Auto-Scaling Mode • ${backtestDays} Days History`,
        });

        try {
            const res = await fetch('/api/performance/optimize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode: optimizationMode,
                    retrySkipped,
                    generations: 0, // Ignored by backend (Max Mode Force)
                    populationSize: 0, // Ignored by backend (Max Mode Force)
                    days: backtestDays,
                    symbols: selectedSymbols,
                    timeframes: selectedTimeframes
                })
            });
            const data = await res.json();

            if (data.success) {
                // Poll for results every 3 seconds for faster updates
                const interval = setInterval(fetchResults, 3000);

                // Stop polling after 15 mins (safety)
                setTimeout(() => {
                    clearInterval(interval);
                    setIsOptimizing(false);
                    toast.success("Optimization Process Finished", { description: "Check the results table." });
                    fetchActiveStrategies(); // Refresh active list
                }, 900000);
            } else {
                toast.error("Failed to start optimization", { description: data.error });
                setIsOptimizing(false);
            }
        } catch (e) {
            console.error(e);
            toast.error("Error", { description: "Network error" });
            setIsOptimizing(false);
        }
    };

    const stopOptimization = async () => {
        try {
            const res = await fetch('/api/performance/optimize', { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                toast.success("Optimization Stopped");
                setIsOptimizing(false);
                fetchActiveStrategies(); // Refresh active list
            }
        } catch (e) {
            toast.error("Error stopping optimization");
        }
    };

    const handleDeploy = async (strat: StrategyResult) => {
        const isDuplicate = activeDeployments.some(a =>
            a.symbol === strat.symbol &&
            a.timeframe === strat.timeframe &&
            a.strategyId === strat.strategyId &&
            a.leverage === strat.leverage &&
            Object.entries(strat.params || {}).every(([k, v]) => a[k] === v)
        );

        if (isDuplicate) {
            toast.warning("Exact Setup Already Active", {
                description: `${strat.symbol} ${strat.timeframe} with identical parameters and leverage is already running.`
            });
            return;
        }

        const toastId = toast.loading("Deploying Strategy...");
        try {
            const payload = {
                strategyId: strat.strategyId,
                symbol: strat.symbol,
                timeframe: strat.timeframe,
                leverage: strat.leverage,
                params: strat.params,
                mode: deployMode
            };

            const res = await fetch('/api/strategies/deploy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (data.success) {
                toast.dismiss(toastId);
                toast.success("Strategy Deployed! 🚀", {
                    description: `${strat.symbol} (${strat.timeframe}) is now running in ${deployMode === 'live' ? 'LIVE' : 'Paper'} Mode.`
                });
                fetchActiveStrategies(); // Refresh active list
            } else {
                toast.dismiss(toastId);
                toast.error("Deployment Failed", { description: data.error });
            }
        } catch (e) {
            toast.dismiss(toastId);
            toast.error("Error", { description: "Failed to connect to API" });
        }
    };

    const [selectedResults, setSelectedResults] = useState<Set<string>>(new Set());

    const getStratId = (strat: StrategyResult) => {
        return `${strat.symbol}-${strat.timeframe}-${strat.strategyId}`.toUpperCase();
    };

    const toggleSelectAll = (dataList: StrategyResult[]) => {
        if (selectedResults.size === dataList.length) {
            setSelectedResults(new Set());
        } else {
            setSelectedResults(new Set(dataList.map(item => item.id || getStratId(item))));
        }
    };

    const toggleSelect = (strat: StrategyResult) => {
        const id = strat.id || getStratId(strat);
        const newSelected = new Set(selectedResults);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedResults(newSelected);
    };

    const toggleExpand = (id: string) => {
        const newExpanded = new Set(expandedRows);
        if (newExpanded.has(id)) {
            newExpanded.delete(id);
        } else {
            newExpanded.add(id);
        }
        setExpandedRows(newExpanded);
    };

    const handleDeploySelected = async () => {
        const toDeploy = results.filter(s => selectedResults.has(s.id || getStratId(s)));
        if (toDeploy.length === 0) return;

        // Filter out exact duplicates (same params + leverage)
        const newDeployments = toDeploy.filter(s => !checkExactActive(s));
        const skippedCount = toDeploy.length - newDeployments.length;

        if (skippedCount > 0) {
            toast.warning(`Skipping ${skippedCount} duplicate strategies.`, {
                description: "These setups are already active with the same leverage."
            });
        }

        if (newDeployments.length === 0) return;

        const toastId = toast.loading(`Deploying ${newDeployments.length} selected strategies...`);

        try {
            // Prepare Payload for Batch
            const payload = newDeployments.map(strat => ({
                strategyId: strat.strategyId || (strat as any).strategy, // Fallback for JSON mismatch
                symbol: strat.symbol,
                timeframe: strat.timeframe,
                leverage: strat.leverage,
                params: strat.params,
                mode: deployMode
            }));

            const res = await fetch('/api/strategies/deploy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload) // COMPATIBLE WITH NEW BATCH API
            });

            if (res.ok) {
                const data = await res.json();
                toast.success(`Success! Deployed ${data.ids.length} strategies. 🚀`);
                setSelectedResults(new Set());
                fetchActiveStrategies(); // Refresh active list
            } else {
                toast.error("Batch deployment failed.");
            }
        } catch (e) {
            console.error("Batch deploy failed", e);
            toast.error("Failed to deploy strategies.");
        } finally {
            toast.dismiss(toastId);
        }
    };

    const renderResultsTable = (dataList: StrategyResult[], showCheckboxes: boolean = true) => (
        <Table>
            <TableHeader>
                <TableRow className="bg-slate-50/50 dark:bg-white/[0.02]">
                    {showCheckboxes && (
                        <TableHead className="w-[40px]">
                            <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-slate-700 bg-slate-900 focus:ring-blue-500"
                                checked={dataList.length > 0 && dataList.every(item => selectedResults.has(item.id || getStratId(item)))}
                                onChange={(e) => {
                                    e.stopPropagation();
                                    toggleSelectAll(dataList);
                                }}
                            />
                        </TableHead>
                    )}
                    <TableHead className="w-[40px]"></TableHead>
                    <TableHead className="w-[80px]">PnL (%)</TableHead>
                    <TableHead className="w-[80px]">Win %</TableHead>
                    <TableHead className="w-[80px]">Sharpe</TableHead>
                    <TableHead className="w-[80px]">DD (%)</TableHead>
                    <TableHead className="w-[100px]">Streaks (W/L)</TableHead>
                    <TableHead className="w-[60px]">Trades</TableHead>
                    <TableHead className="w-[80px]">Candles</TableHead>
                    <TableHead>Configuration</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {dataList.map((r, i) => {
                    const rowId = r.id || getStratId(r);
                    const isFavorite = favorites.has(`${r.symbol}-${r.timeframe}-${r.strategyId}`.toUpperCase());
                    const isExpanded = expandedRows.has(rowId);

                    const sameParamInstance = activeDeployments.find(a =>
                        a.symbol === r.symbol &&
                        a.timeframe === r.timeframe &&
                        (a.strategyId === r.strategyId || a.strategy === r.strategyId) &&
                        Object.entries(r.params || {}).every(([k, v]) => a[k] === v)
                    );

                    const isExactActive = sameParamInstance && sameParamInstance.leverage === r.leverage;
                    const isSameParams = !!sameParamInstance;
                    const isActiveBase = activeDeployments.some(a => a.symbol === r.symbol && a.timeframe === r.timeframe && a.strategyId === r.strategyId);

                    return (
                        <React.Fragment key={rowId}>
                            <TableRow
                                className={`transition-colors cursor-pointer group ${selectedResults.has(rowId) ? "bg-blue-500/10 hover:bg-blue-500/15" : "hover:bg-slate-100/50 dark:hover:bg-white/5"}`}
                                onClick={() => toggleExpand(rowId)}
                            >
                                {showCheckboxes && (
                                    <TableCell onClick={(e) => e.stopPropagation()}>
                                        <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-slate-700 bg-slate-900 focus:ring-blue-500 cursor-pointer"
                                            checked={selectedResults.has(rowId)}
                                            onChange={() => toggleSelect(r)}
                                            disabled={isExactActive}
                                        />
                                    </TableCell>
                                )}
                                <TableCell>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className={`h-8 w-8 rounded-full ${isFavorite ? 'text-red-500 hover:text-red-600' : 'text-slate-300 hover:text-red-400'}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toggleFavorite(r);
                                        }}
                                    >
                                        <Heart className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />
                                    </Button>
                                </TableCell>
                                <TableCell
                                    className="font-bold text-lg"
                                    style={{ color: r.pnl > 0 ? "#22c55e" : "#ef4444" }}
                                >
                                    {r.pnl?.toFixed(1)}%
                                </TableCell>
                                <TableCell className="font-medium text-xs">{r.winRate || (r as any).win_rate || "0"}%</TableCell>
                                <TableCell className="text-xs">{r.sharpe || (r as any).sharpe_ratio || "0"}</TableCell>
                                <TableCell className="text-red-400 text-xs">{r.drawdown || (r as any).max_drawdown || "0"}%</TableCell>
                                <TableCell>
                                    <div className="flex gap-2 text-[10px]">
                                        <span className="text-green-500 font-bold" title="Max Win Streak">{r.winningStreak || (r as any).winning_streak || 0}W</span>
                                        <span className="text-red-400 font-bold" title="Max Loss Streak">{r.losingStreak || (r as any).losing_streak || 0}L</span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-xs font-bold text-center">{r.totalTrades || (r as any).total_trades || 0}</TableCell>
                                <TableCell className="text-[10px] text-muted-foreground font-mono">{r.numCandles || "0"}</TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-blue-500">{r.symbol}</span>
                                            <Badge variant="outline" className="text-[10px] py-0">{r.timeframe}</Badge>
                                            <span className="text-xs text-muted-foreground">x{r.leverage}</span>
                                            {isSameParams && (
                                                <Badge className={`${isExactActive ? 'bg-orange-600/20 text-orange-500 border-orange-500/30' : 'bg-blue-600/20 text-blue-500 border-blue-500/30'} text-[9px] py-0 px-1 font-bold`}>
                                                    {isExactActive ? 'ALREADY RUNNING' : 'SAME PARAMS'}
                                                </Badge>
                                            )}
                                        </div>
                                        <Dialog>
                                            <DialogTrigger asChild>
                                                <button
                                                    className="text-[10px] text-muted-foreground hover:text-blue-500 underline text-left mt-1"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    View Config
                                                </button>
                                            </DialogTrigger>
                                            <DialogContent className="max-w-md bg-white dark:bg-slate-950">
                                                <DialogHeader>
                                                    <DialogTitle>Strategy Configuration</DialogTitle>
                                                    <DialogDescription>
                                                        Parameters for {r.strategyId} on {r.symbol} {r.timeframe}
                                                    </DialogDescription>
                                                </DialogHeader>
                                                <div className="grid grid-cols-2 gap-2 mt-4 p-4 rounded-lg bg-slate-50 dark:bg-white/5 font-mono text-[10px]">
                                                    {Object.entries(r.params || {}).map(([k, v]) => (
                                                        <div key={k} className="flex justify-between border-b border-slate-100 dark:border-white/5 py-1">
                                                            <span className="text-muted-foreground">{k}:</span>
                                                            <span className="font-bold">{String(v)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </DialogContent>
                                        </Dialog>
                                    </div>
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button
                                        size="sm"
                                        variant={isExactActive ? "outline" : "default"}
                                        disabled={isExactActive}
                                        className="h-8 text-[11px] px-3 gap-1"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeploy(r);
                                        }}
                                    >
                                        {isExactActive ? "Active" : (isSameParams ? "New Lev" : "Deploy")}
                                    </Button>
                                </TableCell>
                            </TableRow>
                            {
                                isExpanded && r.trades && r.trades.length > 0 && (
                                    <TableRow className="bg-slate-50/30 dark:bg-white/[0.01]">
                                        <TableCell colSpan={showCheckboxes ? 10 : 9} className="p-0 border-b">
                                            <div className="p-4 pl-12 animate-in slide-in-from-top-2 duration-200">
                                                <h4 className="text-xs font-bold mb-3 flex items-center gap-2 text-slate-400">
                                                    <ListChecks className="h-3 w-3 text-blue-500" />
                                                    Backtest Trade History ({r.trades.length} trades)
                                                </h4>
                                                <div className="rounded-lg border bg-white dark:bg-slate-950/50 max-h-[300px] overflow-y-auto">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow className="bg-slate-50/50 dark:bg-white/5 sticky top-0 z-10">
                                                                <TableHead className="text-[9px] h-7">Entry Time</TableHead>
                                                                <TableHead className="text-[9px] h-7">Type</TableHead>
                                                                <TableHead className="text-[9px] h-7">Entry Price</TableHead>
                                                                <TableHead className="text-[9px] h-7">Exit Price</TableHead>
                                                                <TableHead className="text-[9px] h-7">PnL (%)</TableHead>
                                                                <TableHead className="text-[9px] h-7 text-right">Net PnL ($)</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {r.trades.map((t: any, idx: number) => (
                                                                <TableRow key={idx} className="hover:bg-slate-50/50 dark:hover:bg-white/5 border-b-slate-100/50 dark:border-b-white/5">
                                                                    <TableCell className="text-[9px] py-1">{new Date(t.entry_time).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</TableCell>
                                                                    <TableCell className="text-[9px] py-1 font-bold">
                                                                        <span className={t.type === 'Long' ? 'text-blue-500' : 'text-orange-500'}>{t.type}</span>
                                                                    </TableCell>
                                                                    <TableCell className="text-[9px] py-1 font-mono">{t.entry_price}</TableCell>
                                                                    <TableCell className="text-[9px] py-1 font-mono">{t.exit_price}</TableCell>
                                                                    <TableCell className={`text-[9px] py-1 font-bold ${t.pnl_perc > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                                        {t.pnl_perc > 0 ? '+' : ''}{t.pnl_perc}%
                                                                    </TableCell>
                                                                    <TableCell className={`text-[9px] py-1 text-right font-mono ${t.pnl > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                                        {t.pnl > 0 ? '+' : ''}${t.pnl}
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )
                            }
                        </React.Fragment>
                    );
                })}
            </TableBody>
        </Table >
    );

    const handleDeployAll = async () => {
        if (results.length === 0) return;

        // Filter out already active strategies (check symbol-tf-id-params-leverage)
        const newDeployments = results.filter(s => !checkExactActive(s));
        const skippedCount = results.length - newDeployments.length;

        if (skippedCount > 0) {
            toast.warning(`Skipping ${skippedCount} duplicate strategies.`, {
                description: "These strategies are already active."
            });
        }

        if (newDeployments.length === 0) return;

        const toastId = toast.loading(`Deploying all ${newDeployments.length} new strategies...`);

        try {
            // Prepare Payload for Batch
            const payload = newDeployments.map(strat => ({
                strategyId: strat.strategyId || (strat as any).strategy, // Fallback for JSON mismatch
                symbol: strat.symbol,
                timeframe: strat.timeframe,
                leverage: strat.leverage,
                params: strat.params,
                mode: deployMode
            }));

            const res = await fetch('/api/strategies/deploy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload) // BATCH API
            });

            if (res.ok) {
                const data = await res.json();
                toast.success(`Success! Deployed all ${data.ids.length} strategies. 🚀`);
                fetchActiveStrategies(); // Refresh list
            } else {
                toast.error("Batch deployment failed.");
            }
        } catch (e) {
            console.error("Batch deploy failed", e);
            toast.error("Failed to deploy strategies.");
        } finally {
            toast.dismiss(toastId);
        }
    };

    return (
        <div className="flex min-h-screen flex-col bg-background">
            <main className="flex-1 space-y-4 p-8 pt-6">
                <div className="flex items-center justify-between space-y-2">
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold tracking-tight">Deep Optimization Engine</h1>
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full opacity-70 hover:opacity-100">
                                        <Info className="h-4 w-4" />
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-2xl bg-white dark:bg-slate-950">
                                    <DialogHeader>
                                        <DialogTitle>How the Genetic Optimizer Works</DialogTitle>
                                        <DialogDescription>
                                            Our engine uses evolutionary algorithms to "breed" the perfect trading strategy for current market conditions.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-lg border border-slate-100 dark:border-white/10">
                                                <div className="text-2xl mb-2">🧬</div>
                                                <h3 className="font-semibold mb-1">1. Population</h3>
                                                <p className="text-xs text-muted-foreground">
                                                    We generate random variations of strategy parameters (Stop Loss, Take Profit, Indicator settings).
                                                </p>
                                            </div>
                                            <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-lg border border-slate-100 dark:border-white/10">
                                                <div className="text-2xl mb-2">⚔️</div>
                                                <h3 className="font-semibold mb-1">2. Simulation</h3>
                                                <p className="text-xs text-muted-foreground">
                                                    Each variant is backtested against historical price data to measure profitability (PnL) and risk.
                                                </p>
                                            </div>
                                            <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-lg border border-slate-100 dark:border-white/10">
                                                <div className="text-2xl mb-2">🐣</div>
                                                <h3 className="font-semibold mb-1">3. Evolution</h3>
                                                <p className="text-xs text-muted-foreground">
                                                    The best performers are selected and "crossed over" to create the next generation of improved strategies.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="rounded-lg border border-slate-200 dark:border-white/10 p-4">
                                            <h4 className="font-medium mb-3 text-sm">Current Search Scope</h4>
                                            <div className="grid grid-cols-2 gap-4 text-xs">
                                                <div>
                                                    <span className="text-muted-foreground block mb-1">Strategies</span>
                                                    <div className="flex flex-wrap gap-1">
                                                        {['Trend Momentum', 'Triple Confirmation', 'NDRT', 'Mean Reversion', 'Volatility Scalper'].map(s => (
                                                            <span key={s} className="bg-slate-100 dark:bg-white/10 px-2 py-0.5 rounded text-[10px]">{s}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div>
                                                    <span className="text-muted-foreground block mb-1">Assets & Timeframes</span>
                                                    <div className="space-y-1">
                                                        <p>10 Major Coins (BTC, ETH, SOL, ADA, DOT, LINK, MATIC, XRP, DOGE, AVAX)</p>
                                                        <div className="flex gap-2">
                                                            <div><span className="font-semibold text-blue-500">Scalp Mode:</span> 3m, 5m, 15m, 30m</div>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <div><span className="font-semibold text-purple-500">Swing Mode:</span> 1h, 4h, 1d</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </div>
                        <p className="text-muted-foreground">Automatic Strategy Tuning & Shortlisting</p>
                    </div>
                    <div className="flex items-center space-x-2">
                        <div className="flex items-center bg-slate-100 dark:bg-white/5 p-1 rounded-lg border border-slate-200 dark:border-white/10 mr-2">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-white/10" title="Tuning Settings">
                                        <Settings2 className="h-4 w-4 text-slate-400" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-80 p-4 space-y-4 bg-white dark:bg-slate-950 border-slate-200 dark:border-white/10 max-h-[80vh] overflow-y-auto">
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] uppercase font-bold text-slate-400">Optimization Scope</Label>
                                            <div className="space-y-3">
                                                <div>
                                                    <Label className="text-[9px] text-muted-foreground mb-1 block">Symbols</Label>
                                                    <div className="flex flex-wrap gap-1">
                                                        {['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'ADA/USDT', 'DOGE/USDT', 'AVAX/USDT', 'MATIC/USDT', 'LINK/USDT'].map(s => (
                                                            <Badge
                                                                key={s}
                                                                variant={selectedSymbols.includes(s) ? "default" : "outline"}
                                                                className={`cursor-pointer text-[9px] px-1.5 py-0 ${selectedSymbols.includes(s) ? 'bg-blue-600' : 'opacity-60 hover:opacity-100'}`}
                                                                onClick={() => {
                                                                    setSelectedSymbols(prev =>
                                                                        prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
                                                                    );
                                                                }}
                                                            >
                                                                {s.split('/')[0]}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                    <p className="text-[8px] text-muted-foreground mt-1">Empty = All Major Coins</p>
                                                </div>
                                                <div>
                                                    <Label className="text-[9px] text-muted-foreground mb-1 block">Timeframes</Label>
                                                    <div className="flex flex-wrap gap-1">
                                                        {['3m', '5m', '15m', '30m', '1h', '4h', '1d'].map(t => (
                                                            <Badge
                                                                key={t}
                                                                variant={selectedTimeframes.includes(t) ? "default" : "outline"}
                                                                className={`cursor-pointer text-[9px] px-1.5 py-0 ${selectedTimeframes.includes(t) ? 'bg-purple-600' : 'opacity-60 hover:opacity-100'}`}
                                                                onClick={() => {
                                                                    setSelectedTimeframes(prev =>
                                                                        prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
                                                                    );
                                                                }}
                                                            >
                                                                {t}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                    <p className="text-[8px] text-muted-foreground mt-1">Empty = Mode Defaults</p>
                                                </div>
                                            </div>
                                        </div>



                                        <div className="space-y-2">
                                            <Label className="text-[10px] uppercase font-bold text-slate-400">Data Horizon</Label>
                                            <Select value={backtestDays.toString()} onValueChange={(v) => setBacktestDays(parseInt(v))}>
                                                <SelectTrigger className="h-8 text-xs">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="30">1 Month</SelectItem>
                                                    <SelectItem value="90">3 Months</SelectItem>
                                                    <SelectItem value="180">6 Months</SelectItem>
                                                    <SelectItem value="365">1 Year</SelectItem>
                                                    <SelectItem value="730">2 Years</SelectItem>
                                                    <SelectItem value="1095">3 Years</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-[10px] uppercase font-bold text-slate-400">Min Trades Filter</Label>
                                            <Select value={minTradesFilter.toString()} onValueChange={(v) => setMinTradesFilter(parseInt(v))}>
                                                <SelectTrigger className="h-8 text-xs">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="0">All (No Filter)</SelectItem>
                                                    <SelectItem value="5">Min 5 Trades</SelectItem>
                                                    <SelectItem value="10">Min 10 Trades</SelectItem>
                                                    <SelectItem value="20">Min 20 Trades</SelectItem>
                                                    <SelectItem value="50">Min 50 Trades</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                    </div>
                                </DropdownMenuContent>
                            </DropdownMenu>

                            <div className="h-4 w-[1px] bg-slate-200 dark:bg-white/10 mx-1" />

                            {(['scalp', 'swing', 'all'] as const).map((mode) => (
                                <button
                                    key={mode}
                                    onClick={() => setOptimizationMode(mode)}
                                    className={`text-xs px-3 py-1.5 rounded-md transition-all font-medium ${optimizationMode === mode
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'text-muted-foreground hover:bg-white/10'
                                        }`}
                                >
                                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                                </button>
                            ))}
                        </div>

                        {isOptimizing ? (
                            <Button type="button" onClick={stopOptimization} variant="destructive" size="lg" className="gap-2 animate-pulse">
                                <Square className="h-4 w-4 fill-current" />
                                STOP OPTIMIZATION
                            </Button>
                        ) : (
                            <div className="flex gap-2">
                                <Button type="button" onClick={() => runOptimization(false)} size="lg" className="gap-2">
                                    <Play className="h-4 w-4" />
                                    Run Deep Optimization
                                </Button>
                                <Button type="button" onClick={() => runOptimization(true)} variant="outline" size="lg" className="gap-2 border-yellow-500/50 text-yellow-500 hover:bg-yellow-500/10">
                                    <RefreshCw className="h-4 w-4" />
                                    Retry Skipped
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

                <Card className="col-span-4">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Deployment Candidates (Shortlist) ({results.length})</CardTitle>
                            <CardDescription>
                                Top performing strategies sorted by 365-Day PnL (5x Leverage).
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center bg-slate-100 dark:bg-white/5 p-1 rounded-lg border border-slate-200 dark:border-white/10">
                                <Button
                                    variant={deployMode === 'paper' ? 'default' : 'ghost'}
                                    size="sm"
                                    onClick={() => setDeployMode('paper')}
                                    className="h-8 text-xs px-4 rounded-md transition-all"
                                >
                                    Paper Mode
                                </Button>
                                <Button
                                    variant={deployMode === 'live' ? 'default' : 'ghost'}
                                    size="sm"
                                    onClick={() => setDeployMode('live')}
                                    className={`h-8 text-xs px-4 rounded-md transition-all ${deployMode === 'live' ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg' : ''}`}
                                >
                                    Live Mode
                                </Button>
                            </div>
                            <div className="flex gap-2">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" className="gap-2 text-xs">
                                            <ListChecks className="h-4 w-4" />
                                            Quick Select
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                        <DropdownMenuItem onClick={() => {
                                            const available = results.filter(s => !checkExactActive(s));
                                            const top20 = new Set(available.slice(0, 20).map(s => getStratId(s)));
                                            setSelectedResults(top20);
                                            toast.info(`Selected Top 20 Available Strategies`);
                                        }}>
                                            Select Top 20 (Available)
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => {
                                            const available = results.filter(s => !checkExactActive(s));
                                            const top30 = new Set(available.slice(0, 30).map(s => getStratId(s)));
                                            setSelectedResults(top30);
                                            toast.info(`Selected Top 30 Available Strategies`);
                                        }}>
                                            Select Top 30 (Available)
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => {
                                            const available = results.filter(s => !checkExactActive(s));
                                            const top50 = new Set(available.slice(0, 50).map(s => getStratId(s)));
                                            setSelectedResults(top50);
                                            toast.info(`Selected Top 50 Available Strategies`);
                                        }}>
                                            Select Top 50 (Available)
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>

                                {selectedResults.size > 0 && (
                                    <Button type="button" onClick={handleDeploySelected} variant="default" className={`${deployMode === 'live' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} gap-2 shadow-lg transition-all`}>
                                        <Play className="h-4 w-4" />
                                        Deploy {deployMode === 'live' ? 'LIVE' : 'Selected'} ({selectedResults.size})
                                    </Button>
                                )}
                                {results.length > 0 && (
                                    <Button type="button" onClick={handleDeployAll} variant="outline" className={`border-blue-500 text-blue-500 hover:bg-blue-500/10 gap-2 transition-all`}>
                                        <TrendingUp className="h-4 w-4" />
                                        Deploy All ({deployMode === 'live' ? 'LIVE' : 'Paper'})
                                    </Button>
                                )}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Tabs defaultValue="results" className="w-full">
                            <TabsList className="mb-4 bg-slate-100 dark:bg-white/5 p-1 h-10">
                                <TabsTrigger value="results" className="gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-blue-600">
                                    <ListChecks className="h-3 w-3" />
                                    Optimization Results
                                    {results.length > 0 && <Badge variant="secondary" className="px-1.5 py-0 text-[10px] ml-1">{results.length}</Badge>}
                                </TabsTrigger>
                                <TabsTrigger value="favorites" className="gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-red-600">
                                    <Heart className="h-3 w-3 fill-red-500 text-red-500" />
                                    My Favorites
                                    {favoriteItems.length > 0 && <Badge variant="secondary" className="px-1.5 py-0 text-[10px] ml-1 bg-red-500/10 text-red-500">{favoriteItems.length}</Badge>}
                                </TabsTrigger>
                                <TabsTrigger value="efficiency" className="gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-purple-600">
                                    <Brain className="h-3 w-3 text-purple-500" />
                                    Model Intelligence (AlphaXGB)
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="results" className="mt-0">
                                {loadingResults && <div className="p-12 text-center animate-pulse text-muted-foreground bg-slate-50/50 dark:bg-white/[0.02] rounded-xl border border-dashed border-slate-100 dark:border-white/5">Analyzing market patterns...</div>}
                                {!loadingResults && results.length === 0 && <div className="p-12 text-center text-muted-foreground border border-dashed border-slate-100 dark:border-white/5 rounded-xl">No current results. Use "Run Deep Optimization" to begin.</div>}
                                {results.length > 0 && renderResultsTable(results.filter(r => (r.totalTrades || (r as any).total_trades || 0) >= minTradesFilter))}
                            </TabsContent>

                            <TabsContent value="favorites" className="mt-0">
                                {favoriteItems.length === 0 ? (
                                    <div className="p-12 text-center border-2 border-dashed border-slate-100 dark:border-white/5 rounded-xl text-muted-foreground">
                                        No favorites yet. Toggle the heart icon in results to save a strategy.
                                    </div>
                                ) : (
                                    renderResultsTable(favoriteItems, false)
                                )}
                            </TabsContent>

                            <TabsContent value="efficiency" className="mt-0">
                                {!efficiencyReport ? (
                                    <div className="p-12 text-center animate-pulse text-muted-foreground bg-slate-50/50 dark:bg-white/[0.02] rounded-xl border border-dashed border-slate-100 dark:border-white/5">
                                        Loading AlphaXGB Reliability Metrics...
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                            <Card className="bg-purple-500/5 border-purple-500/20">
                                                <CardContent className="pt-6">
                                                    <div className="flex items-center justify-between">
                                                        <div className="text-sm font-medium text-purple-500">Directional Accuracy</div>
                                                        <Target className="h-4 w-4 text-purple-500" />
                                                    </div>
                                                    <div className="text-2xl font-bold mt-2">{efficiencyReport.metrics?.directional_accuracy_perc}%</div>
                                                    <div className="text-[10px] text-muted-foreground mt-1">Predicted Win vs Actual Win</div>
                                                </CardContent>
                                            </Card>
                                            <Card className="bg-blue-500/5 border-blue-500/20">
                                                <CardContent className="pt-6">
                                                    <div className="flex items-center justify-between">
                                                        <div className="text-sm font-medium text-blue-500">Correlation</div>
                                                        <TrendingUp className="h-4 w-4 text-blue-500" />
                                                    </div>
                                                    <div className="text-2xl font-bold mt-2">{efficiencyReport.metrics?.correlation}</div>
                                                    <div className="text-[10px] text-muted-foreground mt-1">Fitness to Market Reality</div>
                                                </CardContent>
                                            </Card>
                                            <Card className="bg-orange-500/5 border-orange-500/20">
                                                <CardContent className="pt-6">
                                                    <div className="flex items-center justify-between">
                                                        <div className="text-sm font-medium text-orange-500">Avg Error (MAE)</div>
                                                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                                                    </div>
                                                    <div className="text-2xl font-bold mt-2">{efficiencyReport.metrics?.mae}%</div>
                                                    <div className="text-[10px] text-muted-foreground mt-1">Mean Absolute Error in PnL</div>
                                                </CardContent>
                                            </Card>
                                            <Card className="bg-green-500/5 border-green-500/20">
                                                <CardContent className="pt-6">
                                                    <div className="flex items-center justify-between">
                                                        <div className="text-sm font-medium text-green-500">Samples</div>
                                                        <ListChecks className="h-4 w-4 text-green-500" />
                                                    </div>
                                                    <div className="text-2xl font-bold mt-2">{efficiencyReport.total_trades_analyzed}</div>
                                                    <div className="text-[10px] text-muted-foreground mt-1">Total Trades in Dataset</div>
                                                </CardContent>
                                            </Card>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-4">
                                                <h4 className="text-sm font-semibold flex items-center gap-2">
                                                    <Target className="h-4 w-4 text-green-500" />
                                                    Best AlphaXGB Predictions
                                                </h4>
                                                <div className="rounded-lg border border-slate-200 dark:border-white/10 overflow-hidden">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow className="bg-slate-50 dark:bg-white/5">
                                                                <TableHead className="text-[10px]">Symbol/TF</TableHead>
                                                                <TableHead className="text-[10px]">Predicted</TableHead>
                                                                <TableHead className="text-[10px]">Actual</TableHead>
                                                                <TableHead className="text-[10px]">Error</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {efficiencyReport.top_correlated_strategies?.map((item: any, idx: number) => (
                                                                <TableRow key={idx}>
                                                                    <TableCell className="text-[10px] py-2">{item.symbol} ({item.timeframe})</TableCell>
                                                                    <TableCell className="text-[10px] py-2 text-blue-500">{item.pnl}%</TableCell>
                                                                    <TableCell className="text-[10px] py-2 text-green-500">{item.actual_avg_pnl}%</TableCell>
                                                                    <TableCell className="text-[10px] py-2">±{item.abs_error}%</TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <h4 className="text-sm font-semibold flex items-center gap-2">
                                                    <AlertTriangle className="h-4 w-4 text-red-500" />
                                                    Worst AlphaXGB Mispredictions
                                                </h4>
                                                <div className="rounded-lg border border-slate-200 dark:border-white/10 overflow-hidden">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow className="bg-slate-50 dark:bg-white/5">
                                                                <TableHead className="text-[10px]">Symbol/TF</TableHead>
                                                                <TableHead className="text-[10px]">Predicted</TableHead>
                                                                <TableHead className="text-[10px]">Actual</TableHead>
                                                                <TableHead className="text-[10px]">Error</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {efficiencyReport.worst_predictions?.map((item: any, idx: number) => (
                                                                <TableRow key={idx}>
                                                                    <TableCell className="text-[10px] py-2">{item.symbol} ({item.timeframe})</TableCell>
                                                                    <TableCell className="text-[10px] py-2 text-blue-500">{item.pnl}%</TableCell>
                                                                    <TableCell className="text-[10px] py-2 text-red-500">{item.actual_avg_pnl}%</TableCell>
                                                                    <TableCell className="text-[10px] py-2 text-red-500">±{item.abs_error}%</TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>

                <AgentLog sourceFilter="Optimizer" title="Deep Optimization Audit" />
            </main>
        </div>
    );
}
