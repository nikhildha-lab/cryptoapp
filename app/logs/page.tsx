"use client";

import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, ArrowUpRight, ArrowDownRight, Activity, ChevronDown, ChevronRight, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TradeLog {
    id: string;
    timestamp: string;
    strategyId: string;
    instanceId?: string;
    symbol: string;
    side: "BUY" | "SELL";
    price: number;
    pnl?: number;
    reason?: string;
    leverage?: number;
    timeframe?: string;
    status?: string;
    unrealizedPnL?: number;
    entryPrice?: number;
    capital?: number;
    signals?: Record<string, any>;
    exchange?: string;
}

export default function DeployedLogsPage() {
    const [trades, setTrades] = useState<TradeLog[]>([]);
    const [activeStrategies, setActiveStrategies] = useState<Record<string, any>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [mode, setMode] = useState<"live" | "paper">("paper");

    const fetchData = async (resetLogs = false) => {
        setIsLoading(true);
        try {
            if (resetLogs) {
                await fetch("/api/dashboard/trades", { method: "POST" });
                setTrades([]);
            }

            const [tradesRes, activeRes] = await Promise.all([
                fetch("/api/dashboard/trades"),
                fetch("/api/dashboard/data")
            ]);

            const tradesData = await tradesRes.json();
            const activeData = await activeRes.json();

            if (tradesData.success) {
                setTrades(tradesData.trades);
            }

            if (activeData.strategies) {
                const map: Record<string, any> = {};
                activeData.strategies.forEach((s: any) => {
                    map[s.strategyId] = s;
                });
                setActiveStrategies(map);
            }

        } catch (error) {
            console.error("Failed to fetch data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(() => fetchData(), 30000);
        return () => clearInterval(interval);
    }, []);

    const groupedTrades = useMemo(() => {
        const groups: Record<string, TradeLog[]> = {};
        trades.forEach(trade => {
            const id = trade.instanceId || trade.strategyId;
            if (!groups[id]) groups[id] = [];
            groups[id].push(trade);
        });
        return groups;
    }, [trades]);

    const allInstanceIds = useMemo(() => {
        const ids = new Set<string>();
        Object.values(activeStrategies).forEach((s: any) => {
            ids.add(s.id || s.instanceName || s.strategyId);
        });
        Object.keys(groupedTrades).forEach(id => ids.add(id));
        return Array.from(ids);
    }, [activeStrategies, groupedTrades]);

    return (
        <div className="space-y-3 p-4 bg-white min-h-screen">
            <div className="flex items-center justify-between border-b pb-2">
                <div>
                    <h2 className="text-lg font-bold tracking-tight text-slate-900 uppercase">Audit Logs</h2>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                        Execution History • High Density View
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="destructive"
                        size="sm"
                        className="h-7 text-[10px] px-3 font-bold uppercase tracking-tight bg-orange-600 hover:bg-orange-700 border-none"
                        onClick={async () => {
                            if (confirm("Clear stopped instances and push to training pool?")) {
                                setIsLoading(true);
                                try {
                                    const res = await fetch("/api/system/clear-and-push", { method: "POST" });
                                    const data = await res.json();
                                    if (data.success) {
                                        import("sonner").then(({ toast }) => {
                                            toast.success("Success", {
                                                description: data.message
                                            });
                                        });
                                        fetchData();
                                    }
                                } catch (e) {
                                    console.error("Migration failed", e);
                                } finally {
                                    setIsLoading(false);
                                }
                            }
                        }}
                    >
                        Clear & Push
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-[10px] px-3 border-slate-200 bg-white text-slate-600 font-bold uppercase tracking-tight"
                        onClick={() => fetchData()}
                        disabled={isLoading}
                    >
                        <RefreshCw className={`h-3 w-3 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="paper" className="w-full">
                <TabsList className="h-8 bg-slate-100/50 p-1">
                    <TabsTrigger value="paper" className="h-6 text-[10px] px-4 font-bold uppercase" onClick={() => setMode("paper")}>Paper (Sim)</TabsTrigger>
                    <TabsTrigger value="live" className="h-6 text-[10px] px-4 font-bold uppercase" onClick={() => setMode("live")}>Live (Real)</TabsTrigger>
                </TabsList>

                <TabsContent value="paper" className="mt-3 space-y-2">
                    {allInstanceIds.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-slate-400 border rounded-md border-dashed bg-slate-50/30">
                            <Layers className="h-6 w-6 mb-3 opacity-20" />
                            <p className="text-[10px] uppercase font-bold tracking-widest">No active or historical records</p>
                        </div>
                    ) : (
                        allInstanceIds.map(instanceId => (
                            <StrategyGroup
                                key={instanceId}
                                instanceId={instanceId}
                                activeData={Object.values(activeStrategies).find((s: any) => (s.id === instanceId || s.instanceName === instanceId || s.strategyId === instanceId))}
                                trades={groupedTrades[instanceId] || []}
                            />
                        ))
                    )}
                </TabsContent>

                <TabsContent value="live" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Live Execution History</CardTitle>
                            <CardDescription>Real orders executed on connected exchanges.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                <Activity className="h-12 w-12 mb-4 opacity-20" />
                                <p>No live trades recorded yet.</p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}

function StrategyGroup({ instanceId, activeData, trades }: { instanceId: string, activeData?: any, trades: TradeLog[] }) {
    const [isExpanded, setIsExpanded] = useState(false);

    const metrics = useMemo(() => {
        if (activeData) return activeData;

        const totalTrades = trades.length;
        const wins = trades.filter(t => (t.pnl || 0) > 0).length;
        const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
        const totalPnL = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);

        return {
            status: 'stopped',
            winRate,
            trades: totalTrades,
            pnlPerc: totalPnL,
            unrealizedPnL: 0,
            strategyId: trades[0]?.strategyId || 'Unknown'
        };
    }, [activeData, trades]);

    // Detect current position from latest trade
    const currentPosition = useMemo(() => {
        if (!trades || trades.length === 0) return null;
        const latest = trades[0];
        if (latest.pnl === undefined || latest.pnl === null) {
            return {
                side: latest.side,
                status: latest.side === 'BUY' ? 'LONG' : 'SHORT',
                entryPrice: latest.price
            };
        }
        return null;
    }, [trades]);

    return (
        <Card className={cn("transition-all duration-200 overflow-hidden", isExpanded ? "border-blue-500/30 shadow-md ring-1 ring-blue-500/5" : "border-slate-200 bg-white hover:border-slate-300")}>
            <div
                className="p-3 cursor-pointer flex items-center justify-between group"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-3">
                    <div className={cn("h-6 w-6 rounded flex items-center justify-center transition-all", isExpanded ? "bg-blue-600 text-white shadow-sm" : "bg-slate-50 text-slate-400 group-hover:bg-slate-100")}>
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </div>

                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-[11px] font-bold tracking-tight text-slate-900 uppercase">{instanceId}</h3>
                            <Badge variant="outline" className={cn("text-[9px] h-4 px-1.5 uppercase font-bold tracking-wider", metrics.status === 'active' ? "border-green-500/30 text-green-600 bg-green-500/5" : "border-slate-200 text-slate-400")}>
                                {metrics.status === 'active' ? 'Active' : 'Stopped'}
                            </Badge>
                            {currentPosition && (
                                <Badge variant="outline" className={cn("text-[9px] h-4 px-1.5 uppercase font-black tracking-widest", currentPosition.status === 'LONG' ? "border-blue-500/30 text-blue-600 bg-blue-500/5" : "border-orange-500/30 text-orange-600 bg-orange-500/5")}>
                                    {currentPosition.status}
                                </Badge>
                            )}
                            <span className="text-[9px] text-slate-400 font-mono font-medium">{metrics.strategyId}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                            <span className="text-[9px] text-slate-500 font-bold uppercase">{trades.length} Trades</span>
                            <span className="text-[9px] text-slate-500 font-bold uppercase">Win Rate: {metrics.winRate?.toFixed(1)}%</span>
                            {trades[0] && <span className="text-[9px] text-slate-400 font-mono bg-slate-50 px-1 rounded-sm">{trades[0].symbol}</span>}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="text-right">
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Realized PnL</p>
                        <p className={cn("text-[11px] font-mono font-bold leading-none", (metrics.pnlPerc || 0) >= 0 ? "text-green-600" : "text-red-600")}>
                            {(metrics.pnlPerc || 0) > 0 ? "+" : ""}{(metrics.pnlPerc || 0).toFixed(2)}%
                        </p>
                    </div>
                    {metrics.status === 'active' && (
                        <div className="text-right border-l border-slate-100 pl-6">
                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Unrealized</p>
                            <p className={cn("text-[11px] font-mono font-bold leading-none", (metrics.unrealizedPnL || 0) >= 0 ? "text-blue-600" : "text-orange-600")}>
                                ${(metrics.unrealizedPnL || 0).toLocaleString(undefined, { minimumFractionDigits: 1 })}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {isExpanded && (
                <div className="border-t border-slate-100 bg-slate-50/20 animate-in slide-in-from-top-1 duration-200">
                    <LogsTable trades={trades} activeStrategies={activeData ? { [instanceId]: activeData } : {}} />
                </div>
            )}
        </Card>
    );
}

function LogsTable({ trades, activeStrategies }: { trades: TradeLog[], activeStrategies?: Record<string, any> }) {
    if (trades.length === 0) {
        return <div className="text-center py-6 text-slate-400 text-[10px] italic uppercase font-bold tracking-widest">No execution history found</div>;
    }

    return (
        <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow className="bg-white hover:bg-white border-b border-slate-100">
                        <TableHead className="text-[9px] font-bold uppercase tracking-widest text-slate-400 py-2 h-8">Time</TableHead>
                        <TableHead className="text-[9px] font-bold uppercase tracking-widest text-slate-400 py-2 h-8">Action</TableHead>
                        <TableHead className="text-[9px] font-bold uppercase tracking-widest text-slate-400 py-2 h-8">Asset</TableHead>
                        <TableHead className="text-[9px] font-bold uppercase tracking-widest text-slate-400 text-right py-2 h-8">Size</TableHead>
                        <TableHead className="text-[9px] font-bold uppercase tracking-widest text-slate-400 text-right py-2 h-8">PnL/Val</TableHead>
                        <TableHead className="text-[9px] font-bold uppercase tracking-widest text-slate-400 text-right py-2 h-8">Signal/Ref</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {trades.map((trade) => {
                        const instanceId = trade.instanceId || trade.strategyId;
                        const activeStrat = activeStrategies?.[instanceId];
                        let displayUnrealizedPnL = trade.unrealizedPnL;
                        let isLiveUpdate = false;

                        if (activeStrat && activeStrat.status === 'active') {
                            if (activeStrat.unrealizedPnL !== undefined && trade.id === trades[0]?.id) {
                                displayUnrealizedPnL = activeStrat.unrealizedPnL;
                                isLiveUpdate = true;
                            }
                        }

                        // Determine if this is an open position row
                        const isOpenPosition = !trade.pnl && trade.side;
                        const positionStatus = isOpenPosition ? (trade.side === 'BUY' ? 'LONG' : 'SHORT') : null;

                        return (
                            <TableRow key={trade.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                <TableCell className="font-mono text-[10px] text-slate-500 py-2 leading-tight whitespace-nowrap">
                                    {new Date(trade.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </TableCell>
                                <TableCell className="py-2">
                                    <Badge variant={trade.side === "BUY" ? "default" : "destructive"} className={cn("text-[9px] h-4 px-1.5 font-bold uppercase tracking-tight", trade.side === "BUY" ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-red-100 text-red-700 hover:bg-red-100")}>
                                        {trade.side}
                                    </Badge>
                                </TableCell>
                                <TableCell className="py-2">
                                    <div className="flex flex-col leading-none">
                                        <span className="text-[10px] font-bold text-slate-900 tracking-tight leading-none">{trade.symbol}</span>
                                        <span className="text-[9px] text-slate-400 font-mono font-medium mt-1 leading-none">${trade.price.toLocaleString()}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-right py-2 leading-none">
                                    <div className="flex flex-col items-end leading-none">
                                        <span className="text-[10px] font-bold text-slate-900 font-mono leading-none">${(Number(trade.capital ?? 0) * (trade.leverage ?? 1)).toLocaleString()}</span>
                                        <span className="text-[8px] text-slate-400 font-bold uppercase tracking-tighter leading-none mt-1">{trade.leverage || 1}X Lev</span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-right py-2">
                                    {trade.pnl ? (
                                        <span className={cn("text-[10px] font-mono font-bold tracking-tight", trade.pnl > 0 ? "text-green-600" : "text-red-600")}>
                                            {trade.pnl > 0 ? "+" : ""}{trade.pnl.toFixed(2)}%
                                        </span>
                                    ) : (
                                        <div className="flex flex-col items-end leading-none">
                                            <span className={cn("text-[10px] font-mono font-bold tracking-tight", (displayUnrealizedPnL || 0) >= 0 ? "text-blue-600" : (positionStatus === 'SHORT' ? "text-orange-600" : "text-orange-600"))}>
                                                {isLiveUpdate && <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 mr-1 animate-pulse" />}
                                                ${Number(displayUnrealizedPnL || 0).toLocaleString(undefined, { minimumFractionDigits: 1 })}
                                            </span>
                                            <span className={cn("text-[8px] uppercase font-bold tracking-widest mt-1 leading-none", positionStatus === 'LONG' ? "text-blue-500" : "text-orange-500")}>
                                                ACTIVE {positionStatus}
                                            </span>
                                        </div>
                                    )}
                                </TableCell>
                                <TableCell className="text-right py-2">
                                    <div className="flex items-center justify-end gap-2">
                                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight truncate max-w-[60px] leading-none" title={trade.reason}>
                                            {trade.reason || "-"}
                                        </p>
                                        {trade.signals && (
                                            <div className="group/signal relative">
                                                <Activity className="h-4 w-4 text-slate-300 hover:text-blue-500 cursor-help transition-colors" />
                                                <div className="absolute bottom-full right-0 mb-2 w-40 p-2 bg-white text-slate-900 text-[9px] rounded-md shadow-xl border border-slate-100 hidden group-hover/signal:block z-50">
                                                    <div className="font-bold mb-1 border-b pb-1 uppercase tracking-widest text-slate-400">Signal Evidence</div>
                                                    {Object.entries(trade.signals).map(([k, v]) => (
                                                        <div key={k} className="flex justify-between py-0.5">
                                                            <span className="text-slate-400 uppercase tracking-tighter font-bold">{k}:</span>
                                                            <span className="font-mono text-blue-600 font-bold">{v}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
}
