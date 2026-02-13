"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { MoreHorizontal, Play, Pause, Square, Trash2, History, Clock, Info } from "lucide-react";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Trade {
    id: string;
    instanceName?: string;
    strategy: string;
    coin: string;
    timeframe: string;
    rating: string;
    category: string;
    status: "Running" | "Paused" | "Stopped";
    pnl: number;
    pnlPerc: number;
    unrealizedPnL: number;
    unrealizedPnLPerc: number;
    winRate: number;
    trades: number;
    mode?: "live" | "paper";
    capital: number;
    leverage: number;
    exchange: string;
    position?: "long" | "short" | null;
    config?: any; // To hold specific strategy parameters
}

interface HistoricalTrade {
    id: string;
    timestamp: string;
    side: "BUY" | "SELL";
    price: number;
    pnl?: number;
    symbol: string;
}

export function ActiveTradesGrid() {
    const [strategies, setStrategies] = useState<Trade[]>([]);
    const [selectedStrategy, setSelectedStrategy] = useState<Trade | null>(null);
    const [tradeHistory, setTradeHistory] = useState<HistoricalTrade[]>([]);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [error, setError] = useState(false);

    const fetchStrategies = useCallback(async () => {
        try {
            const res = await fetch("/api/dashboard/data");
            const data = await res.json();
            console.log("🔍 RAW API DATA:", data.strategies?.[0]); // Debug: Check first strategy
            if (data.strategies) {
                const mappedStrategies = data.strategies.map((s: any) => {
                    const mapped = {
                        id: s.id,
                        instanceName: s.instanceName,
                        strategy: s.strategyId,
                        mode: s.mode,
                        exchange: s.exchange,
                        coin: s.symbol || 'BTC/USDT',
                        timeframe: s.timeframe || '1h',
                        rating: 'N/A',
                        category: 'Custom',
                        status: s.status === 'active' ? 'Running' : s.status === 'paused' ? 'Paused' : 'Stopped',
                        pnl: (s.pnl || 0) + (s.unrealized_pnl || 0),
                        pnlPerc: (((s.pnl || 0) + (s.unrealized_pnl || 0)) / (s.capital || 1000)) * 100,
                        unrealizedPnL: s.unrealized_pnl || 0,
                        unrealizedPnLPerc: s.unrealized_pnl_perc || ((s.unrealized_pnl || 0) / (s.capital || 1000)) * 100,
                        winRate: s.winRate || 0,
                        trades: s.trades || 0,
                        capital: s.capital || 0,
                        leverage: s.leverage || 1,
                        position: s.position, // Fix: Map position from API
                        config: {
                            stop_loss: s.stop_loss,
                            take_profit: s.take_profit,
                            trailing_sl_perc: s.trailing_sl_perc,
                            rsi_period: s.rsi_period,
                            rsi_oversold: s.rsi_oversold,
                            rsi_overbought: s.rsi_overbought,
                            macd_fast: s.macd_fast,
                            macd_slow: s.macd_slow,
                            macd_signal: s.macd_signal,
                            bb_period: s.bb_period,
                            bb_devfactor: s.bb_devfactor,
                            fast_ema: s.fast_ema || s.ema_fast,
                            slow_ema: s.slow_ema || s.ema_slow,
                        }
                    };

                    // COMPREHENSIVE DEBUG LOGGING
                    console.log(`📦 STRATEGY "${s.strategyId}":`, {
                        raw_unrealizedPnL: s.unrealizedPnL,
                        raw_type: typeof s.unrealizedPnL,
                        mapped_unrealizedPnL: mapped.unrealizedPnL,
                        mapped_type: typeof mapped.unrealizedPnL,
                        fallback_triggered: s.unrealizedPnL ? "NO" : "YES (|| 0)"
                    });

                    return mapped;
                });
                console.log("📊 MAPPED STRATEGIES (first):", mappedStrategies[0]);
                console.log("🎯 SETTING STATE WITH:", mappedStrategies.length, "strategies");
                setStrategies(mappedStrategies);
                setError(false);
            }
        } catch (error) {
            console.error("Failed to fetch active strategies", error);
            setError(true);
        }
    }, []);

    const fetchHistory = async (strategyId: string) => {
        try {
            const res = await fetch(`/api/dashboard/trades?strategyId=${strategyId}`);
            const data = await res.json();
            if (data.success) {
                setTradeHistory(data.trades);
            }
        } catch (error) {
            console.error("Failed to fetch trade history", error);
        }
    };

    useEffect(() => {
        fetchStrategies();
        const interval = setInterval(fetchStrategies, 10000);
        return () => clearInterval(interval);
    }, [fetchStrategies]);

    const handleStop = async (strategyId: string) => {
        try {
            const res = await fetch('/api/deploy/stop', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ strategyId })
            });

            if (res.ok) {
                toast.success("Strategy stopped and removed from execution");
                await fetchStrategies();
            } else {
                toast.error("Failed to stop strategy");
            }
        } catch (error) {
            console.error(error);
            toast.error("An error occurred");
        }
    };

    const handlePause = async (strategyId: string) => {
        try {
            const res = await fetch('/api/deploy/pause', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ strategyId })
            });

            if (res.ok) {
                toast.success("Strategy paused. Existing position will be exited.");
                await fetchStrategies();
            } else {
                toast.error("Failed to pause strategy");
            }
        } catch (error) {
            console.error(error);
            toast.error("An error occurred");
        }
    };

    const handleResume = async (strategyId: string) => {
        try {
            const res = await fetch('/api/deploy/resume', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ strategyId })
            });

            if (res.ok) {
                toast.success("Strategy resumed. Monitoring for new entries.");
                await fetchStrategies();
            } else {
                toast.error("Failed to resume strategy");
            }
        } catch (error) {
            console.error(error);
            toast.error("An error occurred");
        }
    };

    const handleStopAll = async () => {
        const count = activeStrategies.length;
        if (count === 0) return;

        if (!confirm(`CAUTION: This will immediately stop ALL ${count} running strategies across both Live and Paper modes. Are you sure?`)) return;

        try {
            const res = await fetch("/api/deploy/stop-all", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({})
            });

            if (res.ok) {
                fetchStrategies();
            } else {
                alert("Failed to stop all strategies");
            }
        } catch (e) {
            console.error(e);
            alert("Error stopping all strategies");
        }
    };

    const handleViewHistory = (trade: Trade) => {
        setSelectedStrategy(trade);
        fetchHistory(trade.strategy);
        setIsHistoryOpen(true);
    };

    const activeStrategies = strategies.filter(s => s.status === 'Running');
    const liveStrategies = activeStrategies.filter(s => s.mode === 'live');
    const paperStrategies = activeStrategies.filter(s => s.mode === 'paper');

    return (
        <Card className="border-slate-200 dark:border-white/10 shadow-sm overflow-hidden">
            <CardHeader className="px-6 py-4 bg-slate-50/50 dark:bg-white/[0.02] border-b border-slate-100 dark:border-white/5">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-xl font-bold tracking-tight">Active Execution Labs</CardTitle>
                        <CardDescription className="text-sm">
                            Real-time monitoring of your deployed strategy instances.
                        </CardDescription>
                    </div>
                    {activeStrategies.length > 0 && (
                        <Button
                            variant="destructive"
                            size="sm"
                            className="bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border-red-500/20 gap-2 font-bold"
                            onClick={handleStopAll}
                        >
                            <Trash2 className="h-4 w-4" />
                            Stop All Instances
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <Tabs defaultValue={liveStrategies.length > 0 ? "real" : "paper"} className="w-full">
                    <div className="px-6 pb-4 border-b">
                        <TabsList>
                            <TabsTrigger value="real">Live Execution ({liveStrategies.length})</TabsTrigger>
                            <TabsTrigger value="paper">Paper Trading ({paperStrategies.length})</TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent value="real" className="p-0">
                        {error ? (
                            <div className="p-8 text-center text-red-500 font-medium bg-red-500/10 rounded-lg m-4 border border-red-500/20">
                                ⚠️ System Offline: Failed to fetch active strategies. Check backend connection.
                            </div>
                        ) : liveStrategies.length > 0 ? (
                            <TradesTable
                                trades={liveStrategies}
                                onStop={handleStop}
                                onPause={handlePause}
                                onResume={handleResume}
                                onViewHistory={handleViewHistory}
                            />
                        ) : (
                            <div className="p-8 text-center text-muted-foreground">No active live strategies. Deploy one from the Strategy Lab.</div>
                        )}
                    </TabsContent>
                    <TabsContent value="paper" className="p-0">
                        {error ? (
                            <div className="p-8 text-center text-red-500 font-medium bg-red-500/10 rounded-lg m-4 border border-red-500/20">
                                ⚠️ System Offline: Failed to fetch active strategies. Check backend connection.
                            </div>
                        ) : paperStrategies.length > 0 ? (
                            <TradesTable
                                trades={paperStrategies}
                                onStop={handleStop}
                                onPause={handlePause}
                                onResume={handleResume}
                                onViewHistory={handleViewHistory}
                            />
                        ) : (
                            <div className="p-8 text-center text-muted-foreground">No active paper strategies. Deploy one from the Strategy Lab.</div>
                        )}
                    </TabsContent>
                </Tabs>
            </CardContent>
            <Sheet open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
                <SheetContent className="sm:max-w-md border-l border-white/5 bg-slate-950 p-0">
                    <div className="flex h-full flex-col">
                        <SheetHeader className="p-6 border-b border-white/5 bg-slate-900/50">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                                    <Clock className="h-5 w-5 text-blue-500" />
                                </div>
                                <div>
                                    <SheetTitle className="text-xl font-bold text-white">
                                        {selectedStrategy?.instanceName || selectedStrategy?.strategy}
                                    </SheetTitle>
                                    <SheetDescription className="text-slate-400 font-mono text-xs uppercase tracking-tight">
                                        {selectedStrategy?.strategy} Instance
                                    </SheetDescription>
                                </div>
                            </div>
                        </SheetHeader>

                        <ScrollArea className="flex-1">
                            <div className="p-6 space-y-4">
                                {tradeHistory.length > 0 ? (
                                    tradeHistory.map((trade) => (
                                        <div key={trade.id} className="group relative p-4 rounded-xl border border-white/5 bg-slate-900/50 hover:border-white/10 transition-all">
                                            <div className="flex items-center justify-between mb-3">
                                                <Badge className={`${trade.side === 'BUY' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'} border-none px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase`}>
                                                    {trade.side}
                                                </Badge>
                                                <span className="text-[10px] text-slate-500 font-medium">
                                                    {new Date(trade.timestamp).toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="flex items-end justify-between">
                                                <div>
                                                    <p className="text-[10px] text-slate-500 font-semibold mb-0.5 uppercase tracking-wide">Execution Price</p>
                                                    <p className="text-lg font-mono font-bold text-white tracking-tight">
                                                        ${(trade.price ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                    </p>
                                                </div>
                                                {trade.pnl !== undefined && (
                                                    <div className="text-right">
                                                        <p className="text-[10px] text-slate-500 font-semibold mb-0.5 uppercase tracking-wide">PnL</p>
                                                        <p className={`text-lg font-mono font-bold ${(trade.pnl ?? 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                            {(trade.pnl ?? 0) >= 0 ? '+' : ''}{(trade.pnl ?? 0).toFixed(2)}%
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="h-40 flex flex-col items-center justify-center text-center space-y-3 opacity-50">
                                        <History className="h-8 w-8 text-slate-500" />
                                        <p className="text-sm text-slate-400">No trades recorded yet.</p>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                </SheetContent>
            </Sheet>
        </Card>
    );
}

function TradesTable({ trades, onStop, onPause, onResume, onViewHistory }: {
    trades: Trade[],
    onStop: (id: string) => void,
    onPause: (id: string) => void,
    onResume: (id: string) => void,
    onViewHistory: (t: Trade) => void
}) {
    // Sort trades: Open positions first
    const sortedTrades = [...trades].sort((a, b) => {
        // 1. Open Positions First
        const aOpen = a.position !== null && a.position !== undefined;
        const bOpen = b.position !== null && b.position !== undefined;
        if (aOpen && !bOpen) return -1;
        if (!aOpen && bOpen) return 1;

        // 2. Sort by PnL (descending) within groups
        return (b.pnl || 0) - (a.pnl || 0);
    });

    return (
        <Table>
            <TableHeader>
                <TableRow className="bg-muted/50 border-b border-white/5">
                    <TableHead className="w-[140px] text-[10px] font-bold uppercase tracking-wider text-slate-400 py-3">Trade Status</TableHead>
                    <TableHead className="w-[200px] text-[10px] font-bold uppercase tracking-wider text-slate-400 py-3">Strategy & Instance</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Coin</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-400 text-center">Leverage</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-400 text-right">Capital</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-400 text-right">PnL (Total)</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-400 text-right">PnL (Unrealized)</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-400 text-right">Win Rate</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-400 text-right">Trades</TableHead>
                    <TableHead className="w-[100px] text-right text-[10px] font-bold uppercase tracking-wider text-slate-400 pr-6">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {sortedTrades.map((trade) => (
                    <TableRow key={trade.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] border-b border-slate-100 dark:border-white/5 transition-colors">
                        <TableCell className="py-4">
                            {trade.position ? (
                                <Badge className={`${trade.position === 'long' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'} gap-1.5 px-2 py-1 font-bold text-[10px] uppercase tracking-wider`}>
                                    <div className={`h-1.5 w-1.5 rounded-full ${trade.position === 'long' ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
                                    Active {trade.position}
                                </Badge>
                            ) : trade.status === 'Paused' ? (
                                <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20 gap-1.5 px-2 py-1 font-bold text-[10px] uppercase tracking-wider">
                                    <Pause className="h-2 w-2" />
                                    Paused
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 px-2 py-1 font-bold text-[10px] uppercase tracking-wider">
                                    Sidelined
                                </Badge>
                            )}
                        </TableCell>
                        <TableCell className="py-4">
                            <div className="flex flex-col">
                                <span className="font-bold text-slate-900 dark:text-white text-sm tracking-tight">
                                    {trade.instanceName || trade.strategy}
                                </span>
                                <div className="flex items-center gap-1.5 mt-1">
                                    <span className="text-[10px] text-slate-500 font-medium">
                                        {trade.strategy} | {trade.mode?.toUpperCase() || "PAPER"}
                                    </span>
                                    {trade.config && (
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Info className="h-3 w-3 text-slate-400 cursor-help hover:text-blue-500 transition-colors" />
                                                </TooltipTrigger>
                                                <TooltipContent className="bg-slate-900 border-slate-800 text-white text-xs p-3 shadow-xl">
                                                    <p className="font-bold mb-2 text-blue-400 uppercase tracking-wider text-[10px]">Strategy Config</p>
                                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono">
                                                        {Object.entries(trade.config).map(([key, value]) => (
                                                            value !== undefined && value !== null ? (
                                                                <div key={key} className="flex flex-col">
                                                                    <span className="text-[9px] text-slate-500 uppercase">{key.replace(/_/g, ' ')}</span>
                                                                    <span className="font-bold">{String(value)}</span>
                                                                </div>
                                                            ) : null
                                                        ))}
                                                    </div>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    )}
                                </div>
                            </div>
                        </TableCell>
                        <TableCell>
                            <Badge variant="outline" className="text-[10px] font-mono bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300">
                                {trade.coin}
                            </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                            <Badge variant="secondary" className="text-[10px] font-mono bg-blue-500/10 text-blue-500 border-none">
                                {trade.leverage}x
                            </Badge>
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono font-bold text-slate-900 dark:text-white">
                            ${Number(trade.capital ?? 0).toLocaleString()}
                        </TableCell>
                        <TableCell className={`text-right text-xs font-mono font-bold ${(trade.pnl ?? 0) >= 0 ? "text-green-600 dark:text-green-500" : "text-red-600 dark:text-red-500"}`}>
                            ${(trade.pnl ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            <div className="text-[10px] opacity-70">
                                {(trade.pnlPerc ?? 0) >= 0 ? "+" : ""}{(trade.pnlPerc ?? 0).toFixed(2)}%
                            </div>
                        </TableCell>
                        <TableCell className={`text-right text-xs font-mono font-bold ${(trade.unrealizedPnL ?? 0) >= 0 ? "text-green-600 dark:text-green-500" : "text-red-600 dark:text-red-500"}`}>
                            {trade.position ? (
                                <>
                                    ${(trade.unrealizedPnL ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    <div className="text-[10px] opacity-70">
                                        {(trade.unrealizedPnLPerc ?? 0) >= 0 ? "+" : ""}{(trade.unrealizedPnLPerc ?? 0).toFixed(2)}%
                                    </div>
                                </>
                            ) : (
                                <span className="text-slate-400 dark:text-slate-600 font-normal">-</span>
                            )}
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono font-medium text-slate-600 dark:text-slate-300">
                            {(trade.winRate ?? 0).toFixed(1)}%
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono font-medium text-slate-500 dark:text-slate-400">{(trade.trades ?? 0)}</TableCell>
                        <TableCell className="text-right pr-6">
                            <div className="flex items-center justify-end gap-1">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-slate-400 hover:text-blue-500 hover:bg-blue-500/10 rounded-lg transition-all"
                                    onClick={() => onViewHistory(trade)}
                                    title="View Trade History"
                                >
                                    <History className="h-4 w-4" />
                                </Button>
                                {trade.status === 'Paused' ? (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-orange-500 hover:text-orange-600 hover:bg-orange-500/10 rounded-lg transition-all"
                                        onClick={() => onResume(trade.id)}
                                        title="Resume Strategy"
                                    >
                                        <Play className="h-4 w-4 fill-current" />
                                    </Button>
                                ) : (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-slate-400 hover:text-orange-500 hover:bg-orange-500/10 rounded-lg transition-all"
                                        onClick={() => onPause(trade.id)}
                                        title="Pause Strategy"
                                    >
                                        <Pause className="h-4 w-4" />
                                    </Button>
                                )}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                                    onClick={() => onStop(trade.id)}
                                    title="Stop Strategy"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}
