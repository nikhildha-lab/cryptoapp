"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Terminal, Activity, AlertCircle, Info, RefreshCw, ExternalLink } from "lucide-react";

import { EngineStatusBadge } from "@/components/dashboard/EngineStatusBadge";

interface LogEntry {
    id: string;
    timestamp: string;
    level: "info" | "warning" | "error" | "success";
    source: string;
    message: string;
}

export function AgentLog() {
    const router = useRouter();
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isTesting, setIsTesting] = useState(false);
    const [feedHealth, setFeedHealth] = useState<any>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    const fetchFeedHealth = async () => {
        try {
            const res = await fetch("/api/system/feed-health");
            const data = await res.json();
            if (data.success) setFeedHealth(data);
        } catch (e) {
            console.error("Feed health fetch failed", e);
        }
    };

    const handleTestFeed = async () => {
        setIsTesting(true);
        try {
            await fetch("/api/system/test-feed", { method: "POST" });
            // Logs will auto-update via the poller
        } catch (error) {
            console.error("Test feed failed", error);
        } finally {
            setIsTesting(false);
        }
    };

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const res = await fetch("/api/system/logs");
                const data = await res.json();
                if (data.logs) {
                    setLogs(data.logs);
                }
            } catch (error) {
                console.error("Failed to fetch logs", error);
            }
        };

        fetchLogs();
        fetchFeedHealth();
        const logInterval = setInterval(fetchLogs, 3000);
        const healthInterval = setInterval(fetchFeedHealth, 10000);
        return () => {
            clearInterval(logInterval);
            clearInterval(healthInterval);
        };
    }, []);

    return (
        <Card className="col-span-1 md:col-span-3 lg:col-span-4 max-h-[600px]">
            <CardHeader className="py-3 px-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Terminal className="h-4 w-4 text-muted-foreground" />
                        <CardTitle className="text-sm font-medium">Live Kernel Audit</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={() => router.push("/system-logs")}
                        >
                            <ExternalLink className="h-3 w-3" />
                            View All
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={handleTestFeed}
                            disabled={isTesting}
                        >
                            <RefreshCw className={`h-3 w-3 ${isTesting ? 'animate-spin' : ''}`} />
                            Test Data Feed
                        </Button>
                        <div className="hidden md:flex items-center gap-3 px-3 py-1 bg-muted/30 rounded-full border border-white/5 mr-2">
                            <div className="flex items-center gap-1.5">
                                <Activity className={`h-3 w-3 ${feedHealth?.feeds && Object.values(feedHealth.feeds).some((f: any) => f.status !== 'healthy') ? 'text-orange-500' : 'text-blue-500'}`} />
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Feed Health:</span>
                                <span className={`text-[10px] font-mono font-bold ${feedHealth?.feeds && Object.values(feedHealth.feeds).some((f: any) => f.status === 'unstable') ? 'text-red-500' : (feedHealth?.feeds && Object.values(feedHealth.feeds).some((f: any) => f.status === 'degraded' || f.is_stale)) ? 'text-orange-500' : 'text-green-500'}`}>
                                    {feedHealth?.feeds ? (Object.values(feedHealth.feeds).some((f: any) => f.status === 'unstable') ? 'Unstable' : Object.values(feedHealth.feeds).some((f: any) => f.status === 'degraded' || f.is_stale) ? 'Degraded' : 'Active') : 'Checking...'}
                                </span>
                            </div>
                            {feedHealth?.feeds && (
                                <div className="h-3 w-px bg-white/10" />
                            )}
                            {feedHealth?.feeds && (
                                <span className="text-[10px] font-mono text-muted-foreground/60">
                                    avg: {feedHealth?.feeds && Object.values(feedHealth.feeds).length > 0
                                        ? Math.round(Object.values(feedHealth.feeds).reduce((acc: number, f: any) => acc + (f.latency_ms || 0), 0) / Object.values(feedHealth.feeds).length)
                                        : 0}ms
                                </span>
                            )}
                        </div>
                        <EngineStatusBadge />
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <ScrollArea className="h-[500px] w-full px-6 pb-4" ref={scrollRef}>
                    <div className="space-y-1 text-[10px] font-mono mt-2 leading-tight">
                        {logs.map((log) => (
                            <div key={log.id} className="flex gap-2 items-start hover:bg-muted/50 p-0.5 rounded">
                                <span className="text-muted-foreground min-w-[120px] shrink-0">
                                    {new Date(log.timestamp).toLocaleTimeString()}
                                </span>
                                <div className="flex-1 break-all">
                                    <span className={`font-semibold mr-2 ${log.level === 'success' ? 'text-green-500' :
                                        log.level === 'error' ? 'text-red-500' :
                                            log.level === 'warning' ? 'text-yellow-500' : 'text-blue-500'
                                        }`}>
                                        [{log.source}]
                                    </span>
                                    <span className="text-muted-foreground">{log.message}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
