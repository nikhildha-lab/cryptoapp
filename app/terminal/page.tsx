"use client";

import React, { useState, useEffect } from "react";
import { TradingViewChart } from "@/components/dashboard/TradingViewChart";
import { useDashboardMetrics } from "@/components/dashboard/MetricsHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target, ShieldAlert, Zap, TrendingUp, TrendingDown } from "lucide-react";

export default function TerminalPage() {
    const { metrics, strategies } = useDashboardMetrics();
    const [selectedStrategy, setSelectedStrategy] = useState<any>(null);

    const activeTrades = strategies.filter((s: any) => s.position !== null);

    useEffect(() => {
        if (activeTrades.length > 0 && !selectedStrategy) {
            setSelectedStrategy(activeTrades[0]);
        }
    }, [activeTrades, selectedStrategy]);

    const getOverlays = (strat: any) => {
        if (!strat) return [];
        const overlays: { type: 'entry' | 'sl' | 'tp'; price: number; label: string }[] = [
            { type: 'entry', price: strat.entryPrice, label: `ENTRY: ${strat.entryPrice}` }
        ];
        if (strat.current_sl) {
            overlays.push({ type: 'sl', price: strat.current_sl, label: `SL: ${strat.current_sl.toFixed(2)}` });
        }
        if (strat.current_tp) {
            overlays.push({ type: 'tp', price: strat.current_tp, label: `TP: ${strat.current_tp.toFixed(2)}` });
        }
        return overlays;
    };

    return (
        <div className="flex h-[calc(100vh-64px)] w-full overflow-hidden bg-slate-950">
            {/* Sidebar */}
            <div className="w-80 border-r border-slate-800 bg-slate-900/30 flex flex-col">
                <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                    <h2 className="text-sm font-black uppercase tracking-tighter text-slate-200">Open Positions</h2>
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20">{activeTrades.length}</Badge>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {activeTrades.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-center p-4">
                            <ShieldAlert className="h-8 w-8 text-slate-700 mb-2" />
                            <p className="text-xs text-slate-500">No active positions detected.</p>
                        </div>
                    ) : (
                        activeTrades.map((strat: any) => (
                            <div
                                key={strat.id}
                                onClick={() => setSelectedStrategy(strat)}
                                className={`p-3 rounded-lg border transition-all cursor-pointer ${selectedStrategy?.id === strat.id
                                    ? "bg-blue-600/20 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.1)]"
                                    : "bg-slate-900/50 border-slate-800 hover:border-slate-700"
                                    }`}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase">{strat.instanceName}</span>
                                        <span className="text-sm font-bold text-slate-100">{strat.symbol}</span>
                                    </div>
                                    <Badge className={strat.position === 'long' ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}>
                                        {strat.position?.toUpperCase()}
                                    </Badge>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-[10px] whitespace-nowrap">
                                    <div className="flex items-center gap-1 text-slate-400">
                                        <Zap className="h-3 w-3" /> {strat.leverage}x
                                    </div>
                                    <div className={`flex items-center gap-1 justify-end font-mono ${strat.unrealizedPnL >= 0 ? "text-green-400" : "text-red-400"}`}>
                                        {strat.unrealizedPnL >= 0 ? "+" : ""}{strat.unrealizedPnL?.toFixed(2)} USDT
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Main Terminal */}
            <div className="flex-1 flex flex-col bg-slate-950 p-4 gap-4 overflow-y-auto">
                {selectedStrategy ? (
                    <>
                        {/* Stats Bar */}
                        <div className="grid grid-cols-4 gap-4">
                            <Card className="bg-slate-900/50 border-slate-800">
                                <CardContent className="p-4 flex flex-col items-center justify-center gap-1">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Entry Price</span>
                                    <span className="text-xl font-black text-blue-400 font-mono">${selectedStrategy.entryPrice?.toLocaleString()}</span>
                                </CardContent>
                            </Card>
                            <Card className="bg-slate-900/50 border-slate-800">
                                <CardContent className="p-4 flex flex-col items-center justify-center gap-1">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Target Profit</span>
                                    <span className="text-xl font-black text-green-400 font-mono">${selectedStrategy.current_tp?.toLocaleString() || '---'}</span>
                                </CardContent>
                            </Card>
                            <Card className="bg-slate-900/50 border-slate-800">
                                <CardContent className="p-4 flex flex-col items-center justify-center gap-1">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Stop Loss</span>
                                    <span className="text-xl font-black text-red-400 font-mono">${selectedStrategy.current_sl?.toLocaleString() || '---'}</span>
                                </CardContent>
                            </Card>
                            <Card className="bg-slate-900/50 border-slate-800">
                                <CardContent className="p-4 flex flex-col items-center justify-center gap-1">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Unrealized PnL</span>
                                    <div className="flex items-center gap-2">
                                        {selectedStrategy.unrealizedPnL >= 0 ? <TrendingUp className="h-5 w-5 text-green-500" /> : <TrendingDown className="h-5 w-5 text-red-500" />}
                                        <span className={`text-xl font-black font-mono ${selectedStrategy.unrealizedPnL >= 0 ? "text-green-500" : "text-red-500"}`}>
                                            {selectedStrategy.unrealizedPnL >= 0 ? "+" : ""}{selectedStrategy.unrealizedPnL?.toFixed(2)}
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Chart Area */}
                        <div className="flex-1">
                            <TradingViewChart
                                symbol={selectedStrategy.symbol}
                                timeframe={selectedStrategy.timeframe}
                                overlays={getOverlays(selectedStrategy)}
                            />
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-800 rounded-3xl">
                        <div className="flex flex-col items-center max-w-sm text-center">
                            <div className="h-16 w-16 bg-blue-500/10 rounded-full flex items-center justify-center mb-6">
                                <Target className="h-8 w-8 text-blue-500" />
                            </div>
                            <h3 className="text-2xl font-black text-slate-200 mb-2 tracking-tighter">Terminal Standby</h3>
                            <p className="text-slate-500 text-sm mb-8 px-8">
                                Select an active position from the sidebar to visualize its performance, target levels, and market trends.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
