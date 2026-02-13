"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, RefreshCw, Hash, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

// --- HOOK ---
export function useDashboardMetrics() {
    const [metrics, setMetrics] = useState({
        totalStrategies: 0,
        distinctStrategies: 0,
        activeLiveStrategies: 0,
        activePaperStrategies: 0,
        openTradesLive: 0,
        openTradesPaper: 0,
        winRate: 0,
        totalPnL: 0,
        totalPnLLive: 0,
        totalPnLPaper: 0,
        realizedPnL: 0,
        unrealizedPnL: 0,
        pnlPercentage: 0,
        pnlPercentageLive: 0,
        pnlPercentagePaper: 0,
        capitalDeployed: 0,
        activePositionCapital: 0,
        activePositionCapitalLive: 0,
        activePositionCapitalPaper: 0,
        totalTrades: 0,
        drawdown: 0,
        walletBalance: 0,
        walletBalanceInr: 0,
        lastUpdated: "-",
        error: false
    });
    const [strategies, setStrategies] = useState<any[]>([]);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const fetchMetrics = async (refresh = false) => {
        try {
            if (refresh) setIsRefreshing(true);

            // Fetch dashboard metrics
            const res = await fetch(`/api/dashboard/data?t=${Date.now()}`);
            const data = await res.json();

            // Fetch real balance
            const balanceUrl = refresh ? "/api/dashboard/balance?refresh=true" : "/api/dashboard/balance";
            const balanceRes = await fetch(balanceUrl);
            const balanceData = await balanceRes.json();
            const realBalance = balanceData.balance?.total_value_usdt || 0;
            const realBalanceInr = balanceData.balance?.total_value_inr || 0;

            // Format timestamp
            let updatedTime = "-";
            if (balanceData.balance?.timestamp) {
                updatedTime = new Date(balanceData.balance.timestamp).toLocaleTimeString();
            }

            if (data.metrics) {
                setMetrics(prev => ({
                    ...prev,
                    ...data.metrics,
                    walletBalance: realBalance,
                    walletBalanceInr: realBalanceInr,
                    lastUpdated: updatedTime
                }));
            }

            if (data.strategies) {
                const mapped = data.strategies.map((s: any) => ({
                    ...s,
                    entryPrice: s.entry_price,
                    unrealizedPnL: s.unrealized_pnl,
                    pnlPerc: s.pnl_perc
                }));
                setStrategies(mapped);
            }


        } catch (error) {
            console.error("Failed to fetch metrics:", error);
            setMetrics(prev => ({ ...prev, error: true }));
        } finally {
            if (refresh) setIsRefreshing(false);
        }
    };

    useEffect(() => {
        fetchMetrics();
        const interval = setInterval(() => fetchMetrics(false), 10000); // 10s poll
        return () => clearInterval(interval);
    }, []);

    return { metrics, strategies, isRefreshing, fetchMetrics };
}

// --- COMPONENTS ---

export function PnLCard({ metrics }: { metrics: any }) {
    const isPositive = (metrics.totalPnL ?? 0) >= 0;
    return (
        <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 py-3 px-4">
                <CardTitle className="text-base font-bold text-muted-foreground uppercase tracking-wider">PnL</CardTitle>
                <Wallet className="h-4 w-4 text-muted-foreground/50" />
            </CardHeader>
            <CardContent className="pb-4 pt-0 px-4">
                <div className="flex items-baseline gap-2">
                    <div className={`text-3xl font-bold ${isPositive ? "text-green-500" : "text-red-500"}`}>
                        {isPositive ? "+" : ""}${(metrics.totalPnL ?? 0).toLocaleString(undefined, { minimumFractionDigits: 0 })}
                    </div>
                    <div className={`text-base font-bold ${isPositive ? "text-green-600/80" : "text-red-600/80"}`}>
                        ({isPositive ? "+" : ""}{(metrics.pnlPercentage ?? 0).toFixed(1)}%)
                    </div>
                </div>

                {/* Split PnL Display */}
                <div className="flex gap-4 mt-2 mb-1">
                    <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                        <div className="flex flex-col leading-none">
                            <span className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Live</span>
                            <span className={`text-xs font-mono font-bold ${(metrics.totalPnLLive ?? 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                                ${(metrics.totalPnLLive ?? 0).toLocaleString(undefined, { minimumFractionDigits: 0 })}
                                <span className="opacity-70 ml-1">
                                    ({(metrics.pnlPercentageLive ?? 0) > 0 ? "+" : ""}{(metrics.pnlPercentageLive ?? 0).toFixed(1)}%)
                                </span>
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                        <div className="flex flex-col leading-none">
                            <span className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Paper</span>
                            <span className={`text-xs font-mono font-bold ${(metrics.totalPnLPaper ?? 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                                ${(metrics.totalPnLPaper ?? 0).toLocaleString(undefined, { minimumFractionDigits: 0 })}
                                <span className="opacity-70 ml-1">
                                    ({(metrics.pnlPercentagePaper ?? 0) > 0 ? "+" : ""}{(metrics.pnlPercentagePaper ?? 0).toFixed(1)}%)
                                </span>
                            </span>
                        </div>
                    </div>
                </div>
                <div className="text-[10px] text-muted-foreground/60 font-medium mt-1 italic">
                    Calculated as: (Total PnL / Capital at Risk) × 100
                </div>
                <div className="flex gap-4 mt-3 pt-2 border-t border-slate-100 dark:border-white/5">
                    <div>
                        <p className="text-xs uppercase text-muted-foreground font-bold tracking-wider">Realized</p>
                        <p className={`text-base font-mono font-bold ${metrics.realizedPnL >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                            ${(metrics.realizedPnL ?? 0).toLocaleString(undefined, { minimumFractionDigits: 0 })}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs uppercase text-muted-foreground font-bold tracking-wider">Unrealized</p>
                        <p className={`text-base font-mono font-bold ${metrics.unrealizedPnL >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                            ${(metrics.unrealizedPnL ?? 0).toLocaleString(undefined, { minimumFractionDigits: 0 })}
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

export function ActiveStrategiesCard({ metrics }: { metrics: any }) {
    return (
        <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 py-3 px-4">
                <CardTitle className="text-base font-bold text-muted-foreground uppercase tracking-wider">Strategies</CardTitle>
                <Hash className="h-4 w-4 text-muted-foreground/50" />
            </CardHeader>
            <CardContent className="pb-4 pt-0 px-4">
                <div className="flex items-baseline gap-2">
                    <div className="text-3xl font-bold">{metrics.distinctStrategies ?? 0}</div>
                    <div className="text-sm text-muted-foreground font-medium">Distinct Algos</div>
                </div>
                <div className="flex gap-4 mt-3 pt-2 border-t border-slate-100 dark:border-white/5">
                    <div>
                        <p className="text-xs uppercase text-muted-foreground font-bold tracking-wider">Deployments</p>
                        <div className="flex gap-4 items-center mt-0.5">
                            <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                <span className="text-base font-mono font-bold">
                                    {metrics.activeLiveStrategies ?? 0} Live
                                    <span className="text-muted-foreground/60 text-xs ml-1 font-medium">
                                        ({metrics.openTradesLive ?? 0} Open)
                                    </span>
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                                <span className="text-base font-mono font-bold">
                                    {metrics.activePaperStrategies ?? 0} Paper
                                    <span className="text-muted-foreground/60 text-xs ml-1 font-medium">
                                        ({metrics.openTradesPaper ?? 0} Open)
                                    </span>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

export function PerformanceCard({ metrics }: { metrics: any }) {
    return (
        <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 py-3 px-4">
                <CardTitle className="text-base font-bold text-muted-foreground uppercase tracking-wider">Performance</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground/50" />
            </CardHeader>
            <CardContent className="pb-4 pt-0 px-4">
                <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                    <div>
                        <p className="text-xs uppercase text-muted-foreground font-bold tracking-wider">Trades</p>
                        <p className="text-lg font-mono font-bold text-slate-900 dark:text-white leading-none mt-1">
                            {metrics.totalTrades ?? 0}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs uppercase text-muted-foreground font-bold tracking-wider">Win Rate</p>
                        <p className="text-lg font-mono font-bold text-green-500 leading-none mt-1">
                            {(metrics.winRate ?? 0).toFixed(1)}%
                        </p>
                    </div>
                    <Separator className="col-span-2 opacity-50" />
                    <div>
                        <p className="text-xs uppercase text-muted-foreground font-bold tracking-wider">Drawdown</p>
                        <p className="text-lg font-mono font-bold text-red-500 leading-none mt-1">
                            -{(metrics.drawdown ?? 0).toFixed(1)}%
                        </p>
                    </div>
                    <div>
                        <p className="text-xs uppercase text-muted-foreground font-bold tracking-wider">Capital</p>
                        <p className="text-lg font-mono font-bold text-blue-500 leading-none mt-1">
                            ${(metrics.capitalDeployed ?? 0).toLocaleString()}
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

export function WalletCard({ metrics, isRefreshing, onRefresh }: { metrics: any, isRefreshing: boolean, onRefresh: () => void }) {
    const [platform, setPlatform] = useState("coindcx");

    const getBalance = () => {
        if (platform === "coindcx") return metrics.walletCapital || metrics.walletBalanceInr || 5000;
        return 0;
    };

    return (
        <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 py-3 px-4">
                <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-bold text-muted-foreground uppercase tracking-wider">Wallet</CardTitle>
                    <Select value={platform} onValueChange={setPlatform}>
                        <SelectTrigger className="w-[110px] h-8 text-xs px-2 border-none bg-muted/50">
                            <SelectValue placeholder="Platform" />
                        </SelectTrigger>
                        <SelectContent align="end">
                            <SelectItem value="coindcx" className="text-xs">Wallet Budget</SelectItem>
                            <SelectItem value="binance" className="text-xs">Binance</SelectItem>
                            <SelectItem value="delta" className="text-xs">Delta</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 hover:bg-transparent"
                        onClick={onRefresh}
                        disabled={isRefreshing}
                    >
                        <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="pb-4 pt-0 px-4">
                <div className="text-3xl font-bold text-blue-500 flex items-center gap-1">
                    $
                    {getBalance().toLocaleString(undefined, { minimumFractionDigits: 0 })}
                </div>
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100 dark:border-white/5">
                    <div>
                        <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">
                            {platform} Assets
                        </p>
                        {metrics.activePositionCapital > 0 && platform === "coindcx" && (
                            <div className="flex flex-col gap-0.5 mt-1">
                                {metrics.activePositionCapitalLive > 0 && (
                                    <p className="text-[10px] text-orange-600 font-bold">
                                        ${metrics.activePositionCapitalLive.toLocaleString()} Real Risk
                                    </p>
                                )}
                                {metrics.activePositionCapitalPaper > 0 && (
                                    <p className="text-[10px] text-slate-400 font-bold">
                                        ${metrics.activePositionCapitalPaper.toLocaleString()} Paper Risk
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                    {metrics.lastUpdated !== "-" && platform === "coindcx" && (
                        <p className="text-xs text-muted-foreground italic">
                            {metrics.lastUpdated}
                        </p>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

const Separator = ({ className }: { className?: string }) => <div className={`h-px bg-slate-100 dark:bg-white/10 ${className}`} />;

export function MetricsHeader() {
    const { metrics, isRefreshing, fetchMetrics } = useDashboardMetrics();

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <PnLCard metrics={metrics} />
            <ActiveStrategiesCard metrics={metrics} />
            <PerformanceCard metrics={metrics} />
            <WalletCard metrics={metrics} isRefreshing={isRefreshing} onRefresh={() => fetchMetrics(true)} />
        </div>
    );
}
