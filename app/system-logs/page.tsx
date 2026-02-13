"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Terminal,
    Activity,
    AlertCircle,
    Info,
    RefreshCw,
    ArrowLeft,
    Trash2,
    Search,
    Filter,
    Download
} from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface LogEntry {
    id: string;
    timestamp: string;
    level: "info" | "warning" | "error" | "success";
    source: string;
    message: string;
}

export default function LogsPage() {
    const router = useRouter();
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [levelFilter, setLevelFilter] = useState<string>("all");
    const scrollRef = useRef<HTMLDivElement>(null);

    const fetchLogs = async () => {
        try {
            const res = await fetch("/api/system/logs");
            const data = await res.json();
            if (data.logs) {
                setLogs(data.logs);
            }
        } catch (error) {
            console.error("Failed to fetch logs", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
        const interval = setInterval(fetchLogs, 3000); // Poll every 3s
        return () => clearInterval(interval);
    }, []);

    const filteredLogs = logs.filter(log => {
        const matchesSearch = log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
            log.source.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesLevel = levelFilter === "all" || log.level === levelFilter;
        return matchesSearch && matchesLevel;
    });

    const exportLogs = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(logs, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `crypto_agent_logs_${new Date().toISOString()}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-10 h-[calc(100vh-100px)] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">System Logs</h1>
                        <p className="text-muted-foreground">
                            Deep-dive into engine heartbeats, execution events, and connectivity audits.
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={exportLogs}>
                        <Download className="h-4 w-4 mr-2" /> Export JSON
                    </Button>
                </div>
            </div>

            <Separator className="shrink-0" />

            {/* Filters Bar */}
            <div className="flex flex-col md:flex-row gap-4 shrink-0 bg-muted/30 p-4 rounded-lg border border-dashed">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by message or source..."
                        className="pl-9"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <select
                        className="bg-background border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        value={levelFilter}
                        onChange={(e) => setLevelFilter(e.target.value)}
                    >
                        <option value="all">All Levels</option>
                        <option value="success">Success Only</option>
                        <option value="info">Info Only</option>
                        <option value="warning">Warnings Only</option>
                        <option value="error">Errors Only</option>
                    </select>
                </div>
                <Button variant="ghost" size="sm" onClick={fetchLogs} className="shrink-0">
                    <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> Force Refresh
                </Button>
            </div>

            {/* Logs Table */}
            <Card className="flex-1 overflow-hidden border-2 border-primary/10">
                <ScrollArea className="h-full w-full bg-[#0c0c0c] text-green-500/90 font-mono text-[11px]">
                    <div className="p-4 space-y-1">
                        {filteredLogs.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-muted-foreground py-20">
                                <Terminal className="h-12 w-12 mb-4 opacity-20" />
                                <p>No logs found matching your criteria.</p>
                            </div>
                        ) : (
                            filteredLogs.map((log) => (
                                <div key={log.id} className="flex gap-4 items-start hover:bg-white/5 p-1 rounded transition-colors group">
                                    <span className="text-muted-foreground shrink-0 w-[160px]">
                                        [{new Date(log.timestamp).toLocaleString()}]
                                    </span>
                                    <span className={`shrink-0 w-[100px] font-bold uppercase ${log.level === 'success' ? 'text-emerald-500' :
                                            log.level === 'error' ? 'text-red-500' :
                                                log.level === 'warning' ? 'text-yellow-500' : 'text-blue-500'
                                        }`}>
                                        {log.level}
                                    </span>
                                    <span className="text-cyan-500/80 shrink-0 w-[120px]">
                                        @{log.source}
                                    </span>
                                    <span className="text-white/90 break-all">
                                        {log.message}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </ScrollArea>
            </Card>

            <div className="shrink-0 text-[10px] text-muted-foreground flex justify-between items-center px-2">
                <div>Showing {filteredLogs.length} of {logs.length} entries</div>
                <div className="flex items-center gap-1">
                    <Activity className="h-3 w-3 text-green-500 animate-pulse" />
                    <span>Real-time link established with Python Kernel</span>
                </div>
            </div>
        </div>
    );
}
