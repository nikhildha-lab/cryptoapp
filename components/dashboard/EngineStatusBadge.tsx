"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Play, Loader2 } from "lucide-react";

export function EngineStatusBadge() {
    const [status, setStatus] = useState<{ online: boolean; lastBeat: string | null }>({ online: false, lastBeat: null });
    const [isLoading, setIsLoading] = useState(false);

    const fetchStatus = async () => {
        setIsLoading(true);
        try {
            const res = await fetch("/api/system/status/engine");
            const data = await res.json();
            setStatus(data);
        } catch (error) {
            console.error("Failed to fetch engine status", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(() => {
            // Background poll - don't show loading spinner for these
            fetch("/api/system/status/engine")
                .then(res => res.json())
                .then(data => setStatus(data))
                .catch(e => console.error(e));
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    const handleStartEngine = async () => {
        setIsLoading(true);
        try {
            const res = await fetch("/api/system/status/engine", {
                method: "POST"
            });
            if (res.ok) {
                // Poll quickly for a few seconds to catch the startup
                let checks = 0;
                const quickPoll = setInterval(async () => {
                    const r = await fetch("/api/system/status/engine");
                    const d = await r.json();
                    setStatus(d);
                    checks++;
                    if (checks > 5 || d.online) clearInterval(quickPoll);
                }, 1000);
            } else {
                alert("Failed to start engine.");
            }
        } catch (e) {
            console.error(e);
            alert("Error starting engine.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center gap-2">
            <Badge
                variant={status.online ? "default" : "destructive"}
                className={`text-xs font-normal transition-colors ${status.online ? "bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/20" : ""}`}
            >
                {status.online ? (
                    <span className="flex items-center">
                        <span className="relative flex h-2 w-2 mr-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                        Brain Running
                    </span>
                ) : (
                    "Brain Stopped"
                )}
            </Badge>

            <div className="flex items-center gap-1">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-slate-500 hover:text-white"
                    onClick={fetchStatus}
                    disabled={isLoading}
                    title="Refresh Status"
                >
                    <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
                </Button>

                {!status.online && (
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-[10px] px-2 border-slate-700 bg-slate-800/50 hover:bg-green-500/10 hover:text-green-500 hover:border-green-500/30 transition-all"
                        onClick={handleStartEngine}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                            <Play className="h-3 w-3 mr-1" />
                        )}
                        Start Brain
                    </Button>
                )}
            </div>
        </div>
    );
}
