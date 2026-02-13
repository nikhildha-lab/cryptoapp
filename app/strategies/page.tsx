"use client";

import { useState } from "react";
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

    const { refresh: refreshStrategies } = useStrategies();

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

                <Tabs defaultValue="builder" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
                        <TabsTrigger value="builder">Strategy Builder</TabsTrigger>
                        <TabsTrigger value="auto">Automated Research</TabsTrigger>
                    </TabsList>

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
