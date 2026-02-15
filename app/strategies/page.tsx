"use client";

import { useState, useEffect } from "react";
import { useStrategies } from "@/hooks/useStrategies";
import { StrategyComparison } from "@/components/dashboard/StrategyComparison";
import { StrategyDocumentation } from "@/components/dashboard/StrategyDocumentation";
import { CreateStrategyDialog } from "@/components/strategy/CreateStrategyDialog";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FlaskConical, Play, Timer, CheckCircle, AlertCircle, FileText } from "lucide-react";
import { StrategyBuilder } from "@/components/strategy/StrategyBuilder";
import { BacktestChart } from "@/components/strategy/BacktestChart";
import { RiskControls } from "@/components/strategy/RiskControls";

interface BacktestResult {
    pnl: number;
    sharpe_ratio: number;
    max_drawdown: number;
    win_rate: number;
    chart_data: { date: string; pnl: number }[];
}

export default function StrategyPage() {
    // Research Lab State
    const [agentStatus, setAgentStatus] = useState<"idle" | "running">("idle");
    const [scope, setScope] = useState("all");
    const [schedule, setSchedule] = useState("daily");
    const [chartData, setChartData] = useState<{ date: string; pnl: number }[]>([]);
    const [reports, setReports] = useState<any[]>([]);
    const [favorites, setFavorites] = useState<{ items: any[], last_sync?: string }>({ items: [] });
    const [selectedFavorites, setSelectedFavorites] = useState<Set<string>>(new Set());
    const [isSyncing, setIsSyncing] = useState(false);
    const [isDeploying, setIsDeploying] = useState(false);
    const [expandedStrategy, setExpandedStrategy] = useState<string | null>(null);

    const { refresh: refreshStrategies } = useStrategies();

    const toggleFavoriteSelection = (id: string) => {
        setSelectedFavorites(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const fetchFavorites = async () => {
        try {
            const res = await fetch('/api/favorites');
            if (res.ok) {
                const data = await res.json();
                setFavorites(data);
            }
        } catch (error) {
            console.error("Failed to fetch favorites:", error);
        }
    };

    const syncFavorites = async () => {
        setIsSyncing(true);
        try {
            const res = await fetch('/api/favorites', { method: 'POST', body: JSON.stringify({ threshold: 7.0 }) });
            if (res.ok) {
                const result = await res.json();
                setFavorites(result.data);
                alert("Top picks synced from AI successfully!");
            }
        } catch (error) {
            console.error("Failed to sync favorites:", error);
        } finally {
            setIsSyncing(false);
        }
    };

    const deployFavorites = async () => {
        const count = selectedFavorites.size > 0 ? selectedFavorites.size : favorites.items.length;
        const msg = selectedFavorites.size > 0
            ? `Are you sure you want to deploy the ${count} selected strategies?`
            : `Are you sure you want to deploy ALL ${count} top-performing picks?`;

        if (!confirm(msg)) return;

        setIsDeploying(true);
        try {
            const res = await fetch('/api/favorites/deploy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: Array.from(selectedFavorites) })
            });
            if (res.ok) {
                const result = await res.json();
                alert(result.message);
                refreshStrategies();
                window.location.reload();
            } else {
                const err = await res.json();
                alert(`Deployment failed: ${err.error}`);
            }
        } catch (error) {
            console.error("Failed to deploy favorites:", error);
        } finally {
            setIsDeploying(false);
        }
    };

    useEffect(() => {
        fetchFavorites();
    }, []);

    const handleBacktestComplete = (result: BacktestResult) => {
        setChartData(result.chart_data);
    };

    const handleStrategyCreated = () => {
        refreshStrategies();
        // Also reload the page to ensure all components sync up if they don't share context properly yet
        // Ideally we'd use a Context Provider, but for now this is safe
        window.location.reload();
    };

    const startResearch = async () => {
        setAgentStatus("running");
        try {
            // Verify configuration first
            const statusRes = await fetch('/api/system/status');
            const status = await statusRes.json();

            if (!status.mcpStatus || !status.mcpStatus.find((m: any) => m.id === "brave" && m.status === "connected")) {
                // We could be stricter here, but let's just check for general agent capability
                // Actually relying on the generic API key check in /api/agent is better
            }

            const res = await fetch('/api/agent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: "Analyze current market trends for BTC and ETH using available tools." })
            });

            if (!res.ok) {
                const err = await res.json();
                alert(`Research Failed: ${err.error || "Unknown error"}`);
                setAgentStatus("idle");
                return;
            }

            // In a real system, this would stream results or poll. 
            // For now, we just acknowledge the request was sent to the LLM.
            alert("Research Request Sent to Agent. Results will appear in logs (Backend config required for persistence).");

        } catch (error) {
            console.error("Research error:", error);
            alert("Failed to start research agent.");
        } finally {
            setAgentStatus("idle");
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Strategy Dashboard</h1>
                    <p className="text-muted-foreground">
                        Monitor performance, design strategies, and deploy your agents.
                    </p>
                </div>
                <CreateStrategyDialog onStrategyCreated={handleStrategyCreated} />
            </div>
            <Separator />

            {/* Performance Matrix */}
            <section>
                <div className="flex items-center gap-2 mb-4">
                    <h2 className="text-xl font-semibold tracking-tight">Performance Matrix</h2>
                </div>
                <StrategyComparison />
            </section>

            <Separator />

            {/* Strategy Documentation */}
            <section>
                <StrategyDocumentation />
            </section>

            <Separator />

            {/* Research Lab Section */}
            <section>
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-xl font-semibold tracking-tight">Research Lab</h2>
                        <p className="text-sm text-muted-foreground">
                            AI-powered strategy experimentation and backtesting environment.
                        </p>
                    </div>
                </div>

                <Tabs defaultValue="picks" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 max-w-[600px]">
                        <TabsTrigger value="picks">Top Picks (AI)</TabsTrigger>
                        <TabsTrigger value="builder">Strategy Builder</TabsTrigger>
                        <TabsTrigger value="auto">Automated Research</TabsTrigger>
                    </TabsList>

                    {/* Tab 0: Top Picks / Favorites */}
                    <TabsContent value="picks" className="space-y-6 mt-6">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle className="flex items-center gap-2">
                                        <FlaskConical className="h-5 w-5 text-yellow-500" />
                                        AlphaXGB Top Performing Picks
                                    </CardTitle>
                                    <CardDescription>
                                        High-confidence strategy combinations identified by the AI continuous learning model.
                                    </CardDescription>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" onClick={syncFavorites} disabled={isSyncing}>
                                        {isSyncing ? "Syncing Logic..." : "Sync from AI"}
                                    </Button>
                                    <Button className="bg-green-600 hover:bg-green-700" size="sm" onClick={deployFavorites} disabled={isDeploying || favorites.items?.length === 0}>
                                        {isDeploying ? "Deploying..." : selectedFavorites.size > 0 ? `Deploy ${selectedFavorites.size} Selected` : "Deploy All Top Picks"}
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {favorites.items?.length > 0 ? (
                                    <div className="border rounded-lg overflow-hidden">
                                        <div className="bg-muted/30 grid grid-cols-[100px_1fr_1fr_80px_100px_100px_100px_100px] p-3 text-[10px] font-bold uppercase tracking-wider border-b items-center">
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedFavorites.size === favorites.items.length}
                                                    onChange={() => {
                                                        if (selectedFavorites.size === favorites.items.length) setSelectedFavorites(new Set());
                                                        else setSelectedFavorites(new Set(favorites.items.map((f: any) => f.id)));
                                                    }}
                                                    className="h-3 w-3"
                                                />
                                                <span>Strategy</span>
                                            </div>
                                            <span>Symbol</span>
                                            <span className="text-center">TF</span>
                                            <span className="text-center">Score</span>
                                            <span className="text-center">Win Rate</span>
                                            <span className="text-center">Trades</span>
                                            <span className="text-center">Sharpe</span>
                                            <span className="text-center">Drawdown</span>
                                        </div>
                                        <div className="divide-y max-h-[400px] overflow-y-auto">
                                            {favorites.items.map((fav: any) => (
                                                <>
                                                    <div
                                                        key={fav.id}
                                                        className={`grid grid-cols-[100px_1fr_1fr_80px_100px_100px_100px_100px] p-3 text-sm hover:bg-muted/20 transition-colors items-center cursor-pointer ${selectedFavorites.has(fav.id) ? "bg-green-500/5" : ""}`}
                                                        onClick={(e) => {
                                                            // Prevent toggle if clicking checkbox
                                                            if ((e.target as HTMLElement).tagName === 'INPUT') return;
                                                            // Calculate ID for expansion (using strategyId + symbol + timeframe as unique key if needed, or just map index)
                                                            // But favorites has unique IDs usually.
                                                            const expandId = fav.id;
                                                            setExpandedStrategy(prev => prev === expandId ? null : expandId);
                                                        }}
                                                    >
                                                        <div className="flex items-center gap-2 overflow-hidden">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedFavorites.has(fav.id)}
                                                                onChange={() => toggleFavoriteSelection(fav.id)}
                                                                className="h-3 w-3"
                                                            />
                                                            <span className="font-medium truncate text-xs">{fav.strategyId}</span>
                                                        </div>
                                                        <span className="font-mono text-xs">{fav.symbol}</span>
                                                        <span className="text-muted-foreground text-center text-xs">{fav.timeframe}</span>
                                                        <div className="text-center">
                                                            <Badge variant="outline" className="text-yellow-500 border-yellow-500/20 bg-yellow-500/5 text-[10px] px-1">
                                                                {fav.alpha_score ? fav.alpha_score.toFixed(1) : "N/A"}
                                                            </Badge>
                                                        </div>
                                                        <span className="text-center font-bold text-green-500 text-xs">{(fav.winRate * 100).toFixed(0)}%</span>
                                                        <span className="text-center text-muted-foreground text-xs">{fav.trades}</span>
                                                        <span className="text-center text-cyan-500 font-mono text-xs">{fav.sharpe?.toFixed(2) || "N/A"}</span>
                                                        <span className="text-center text-red-400 font-mono text-xs">-{fav.drawdown?.toFixed(1) || "0"}%</span>
                                                    </div>

                                                    {/* Nested Trades View */}
                                                    {expandedStrategy === fav.id && (
                                                        <div className="col-span-8 bg-muted/10 border-b border-l border-r mx-4 mb-4 rounded-b-lg p-4">
                                                            <h4 className="text-xs font-semibold mb-2 flex items-center gap-2">
                                                                <FileText className="h-3 w-3" />
                                                                Trade History ({fav.trades} trades)
                                                            </h4>
                                                            {fav.trades_list && fav.trades_list.length > 0 ? (
                                                                <div className="max-h-[300px] overflow-y-auto border rounded-md bg-background">
                                                                    <table className="w-full text-xs">
                                                                        <thead className="bg-muted text-muted-foreground sticky top-0">
                                                                            <tr>
                                                                                <th className="p-2 text-left">Entry Time</th>
                                                                                <th className="p-2 text-left">Type</th>
                                                                                <th className="p-2 text-right">Entry Price</th>
                                                                                <th className="p-2 text-right">Exit Price</th>
                                                                                <th className="p-2 text-right">PnL</th>
                                                                                <th className="p-2 text-right">PnL %</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody className="divide-y">
                                                                            {fav.trades_list.map((trade: any, idx: number) => (
                                                                                <tr key={idx} className="hover:bg-muted/50">
                                                                                    <td className="p-2 font-mono text-muted-foreground">{new Date(trade.entry_time).toLocaleString()}</td>
                                                                                    <td className={`p-2 font-bold ${trade.type === 'Long' ? 'text-green-600' : 'text-red-600'}`}>
                                                                                        {trade.type}
                                                                                    </td>
                                                                                    <td className="p-2 text-right font-mono">${trade.entry_price}</td>
                                                                                    <td className="p-2 text-right font-mono">${trade.exit_price}</td>
                                                                                    <td className={`p-2 text-right font-mono ${trade.pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                                                        {trade.pnl >= 0 ? '+' : ''}{trade.pnl}
                                                                                    </td>
                                                                                    <td className={`p-2 text-right font-bold ${trade.pnl_perc >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                                                        {trade.pnl_perc}%
                                                                                    </td>
                                                                                </tr>
                                                                            ))}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            ) : (
                                                                <div className="text-center py-8 text-muted-foreground text-xs italic">
                                                                    No individual trade data available.
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center p-12 text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                                        <AlertCircle className="h-8 w-8 mb-2 opacity-50" />
                                        <p>No high-performing picks found yet.</p>
                                        <p className="text-xs">Click "Sync from AI" to process historical trade data.</p>
                                    </div>
                                )}
                                {favorites.last_sync && (
                                    <p className="text-[10px] text-muted-foreground mt-4 text-right">
                                        Last Intelligence Sync: {new Date(favorites.last_sync).toLocaleString()}
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Tab 1: Manual Strategy Builder */}
                    <TabsContent value="builder" className="space-y-6 mt-6">
                        <div className="grid gap-6 lg:grid-cols-2">
                            <StrategyBuilder
                                onBacktestComplete={handleBacktestComplete}
                                onStrategyCreated={handleStrategyCreated}
                            />
                            <div className="space-y-6">
                                <BacktestChart data={chartData} />
                                <RiskControls />
                            </div>
                        </div>
                    </TabsContent>

                    {/* Tab 2: Automated Research Agent */}
                    <TabsContent value="auto" className="space-y-6 mt-6">
                        <div className="grid gap-6 md:grid-cols-3">
                            {/* Left Column: Agent Config */}
                            <Card className="md:col-span-1">
                                <CardHeader>
                                    <div className="flex items-center gap-2">
                                        <FlaskConical className="h-5 w-5 text-purple-500" />
                                        <CardTitle>Research Agent</CardTitle>
                                    </div>
                                    <CardDescription>
                                        Configure automated experiments.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="p-4 border rounded-lg bg-muted/50 flex items-center justify-between">
                                        <span className="text-sm font-medium">Status</span>
                                        <Badge variant={agentStatus === "running" ? "default" : "secondary"}>
                                            {agentStatus === "running" ? "Running Experiment..." : "Idle"}
                                        </Badge>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Experiment Scope</Label>
                                        <Select value={scope} onValueChange={setScope}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Strategies</SelectItem>
                                                <SelectItem value="trend">Trend Following Only</SelectItem>
                                                <SelectItem value="mean_reversion">Mean Reversion Only</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Schedule</Label>
                                        <Select value={schedule} onValueChange={setSchedule}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="daily">Daily (02:00 AM)</SelectItem>
                                                <SelectItem value="weekly">Weekly (Sunday)</SelectItem>
                                                <SelectItem value="manual">Manual Only</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <Button
                                        className="w-full bg-purple-600 hover:bg-purple-700"
                                        onClick={startResearch}
                                        disabled={agentStatus === "running"}
                                    >
                                        <Play className="h-4 w-4 mr-2" />
                                        Run Experiment Now
                                    </Button>
                                </CardContent>
                            </Card>

                            {/* Right Column: Reports */}
                            <Card className="md:col-span-2">
                                <CardHeader>
                                    <CardTitle>Experiment Reports</CardTitle>
                                    <CardDescription>
                                        Findings from recent autonomous research sessions.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <ScrollArea className="h-[500px] pr-4">
                                        {reports.length > 0 ? (
                                            <div className="space-y-4">
                                                {reports.map((report) => (
                                                    <div key={report.id} className="p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                                                        <div className="flex items-start justify-between mb-2">
                                                            <div className="flex items-center gap-2">
                                                                <FileText className="h-4 w-4 text-blue-500" />
                                                                <h3 className="font-semibold text-sm">{report.title}</h3>
                                                            </div>
                                                            <Badge variant="outline" className={
                                                                report.status === "Completed" ? "text-green-500 border-green-500/20 bg-green-500/10" : "text-red-500 border-red-500/20 bg-red-500/10"
                                                            }>
                                                                {report.status}
                                                            </Badge>
                                                        </div>
                                                        <p className="text-sm text-muted-foreground mb-3">
                                                            {report.findings}
                                                        </p>
                                                        <div className="flex items-center text-xs text-muted-foreground gap-4">
                                                            <div className="flex items-center gap-1">
                                                                <Timer className="h-3 w-3" />
                                                                {report.date}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                                                <FlaskConical className="h-8 w-8 mb-2 opacity-50" />
                                                <p>No reports generated yet.</p>
                                                <p className="text-sm">Run an experiment to generate findings.</p>
                                            </div>
                                        )}
                                    </ScrollArea>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>
                </Tabs>
            </section>
        </div>
    );
}
