"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, XCircle, RefreshCw, Server, Globe, Database, Github, Terminal } from "lucide-react";

interface MCPStatus {
    id: string;
    name: string;
    type: "Data" | "Tool" | "Infrastructure";
    status: "connected" | "disconnected" | "error";
    latency?: string;
    icon: React.ReactNode;
}

export default function SettingsPage() {
    const [mcpStatus, setMcpStatus] = useState<MCPStatus[]>([
        { id: "brave", name: "Brave Search", type: "Tool", status: "connected", latency: "45ms", icon: <Globe className="h-4 w-4" /> },
        { id: "github", name: "GitHub Repository", type: "Infrastructure", status: "connected", latency: "Local", icon: <Github className="h-4 w-4" /> },
        { id: "postgres", name: "PostgreSQL Database", type: "Infrastructure", status: "disconnected", icon: <Database className="h-4 w-4" /> },
        { id: "filesystem", name: "Local Filesystem", type: "Infrastructure", status: "connected", latency: "0ms", icon: <Server className="h-4 w-4" /> },
        { id: "fetch-ai", name: "Fetch.ai Network", type: "Tool", status: "connected", latency: "120ms", icon: <Terminal className="h-4 w-4" /> },
        { id: "coingecko", name: "CoinGecko API", type: "Data", status: "connected", latency: "85ms", icon: <Server className="h-4 w-4" /> },
    ]);

    const [isChecking, setIsChecking] = useState(false);
    const [healthStatus, setHealthStatus] = useState<any>(null);
    const [logs, setLogs] = useState<any[]>([]);

    // Audit State
    const [auditReport, setAuditReport] = useState<string>("");
    const [isAuditing, setIsAuditing] = useState(false);
    const [auditOutput, setAuditOutput] = useState<string>("");
    const [auditResult, setAuditResult] = useState<any>(null);

    const runLiveAudit = async () => {
        setIsAuditing(true);
        setAuditOutput("Initializing Audit System...\n");
        try {
            const res = await fetch('/api/system/run-audit', { method: 'POST' });
            const data = await res.json();
            setAuditResult(data);
            setAuditOutput(data.output);
        } catch (error) {
            setAuditOutput("Audit Request Failed.");
        } finally {
            setIsAuditing(false);
        }
    };

    const fetchAuditReport = async () => {
        try {
            const res = await fetch('/api/system/audit-report');
            const data = await res.json();
            if (data.content) setAuditReport(data.content);
        } catch (e) {
            console.error(e);
        }
    };

    const [connectingService, setConnectingService] = useState<string | null>(null);
    const [connectedServices, setConnectedServices] = useState<Record<string, boolean>>({
        telegram: false,
        discord: false
    });

    const handleConnectService = async (service: string) => {
        setConnectingService(service);
        // Simulate connection delay
        await new Promise(resolve => setTimeout(resolve, 2000));
        setConnectedServices(prev => ({ ...prev, [service]: true }));
        setConnectingService(null);
    };

    const checkConnections = async () => {
        setIsChecking(true);
        try {
            // Parallel fetch for efficiency
            const [statusRes, healthRes, logsRes] = await Promise.all([
                fetch('/api/system/status'),
                fetch('/api/system-health'),
                fetch('/api/system/logs')
            ]);

            const statusData = await statusRes.json();
            if (statusData.mcpStatus) setMcpStatus(statusData.mcpStatus);
            if (statusData.connectedServices) setConnectedServices(statusData.connectedServices);

            const healthData = await healthRes.json();
            setHealthStatus(healthData);

            const logsData = await logsRes.json();
            if (logsData.logs) setLogs(logsData.logs);

        } catch (error) {
            console.error("Failed to check system status:", error);
            setMcpStatus(prev => prev.map(mcp => ({ ...mcp, status: "error", latency: undefined })));
        } finally {
            setIsChecking(false);
        }
    };

    useEffect(() => {
        checkConnections();
        fetchAuditReport();
        const interval = setInterval(checkConnections, 5000); // Auto-refresh checks
        return () => clearInterval(interval);
    }, []);

    const [apiKeys, setApiKeys] = useState({
        BINANCE_API_KEY: "",
        BINANCE_SECRET_KEY: "",
        COINDCX_API_KEY: "",
        COINDCX_SECRET_KEY: "",
        KRAKEN_API_KEY: "",
        KRAKEN_SECRET_KEY: "",
        GEMINI_API_KEY: "",
        OPENAI_API_KEY: "",
        TELEGRAM_BOT_TOKEN: "",
        DISCORD_WEBHOOK_URL: "",
        DATABASE_URL: ""
    });

    const handleKeyChange = (key: string, value: string) => {
        setApiKeys(prev => ({ ...prev, [key]: value }));
    };

    const handleSaveKeys = async () => {
        try {
            const response = await fetch('/api/settings/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keys: apiKeys })
            });

            if (response.ok) {
                alert("API Keys saved successfully! System allows live connection now.");
                checkConnections(); // Refresh status
            } else {
                alert("Failed to save keys.");
            }
        } catch (error) {
            console.error("Error saving keys:", error);
            alert("Error saving configuration.");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                    <p className="text-muted-foreground">
                        Manage system configurations and integrations.
                    </p>
                </div>
            </div>
            <Separator />

            <Tabs defaultValue="integrations" className="w-full">
                <TabsList className="grid w-full grid-cols-3 max-w-[600px]">
                    <TabsTrigger value="general">General</TabsTrigger>
                    <TabsTrigger value="integrations">Integrations</TabsTrigger>
                    <TabsTrigger value="audit">System Audit</TabsTrigger>
                    <TabsTrigger value="api-keys">API Keys</TabsTrigger>
                </TabsList>

                <TabsContent value="integrations" className="space-y-6 mt-6">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Model Context Protocol (MCP) Status</CardTitle>
                                    <CardDescription>
                                        Real-time status of connected tools and data sources.
                                    </CardDescription>
                                </div>
                                <Button variant="outline" size="sm" onClick={checkConnections} disabled={isChecking}>
                                    <RefreshCw className={`h-4 w-4 mr-2 ${isChecking ? "animate-spin" : ""}`} />
                                    Check Status
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {mcpStatus.map((mcp) => (
                                    <div key={mcp.id} className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-muted/50 transition-colors">
                                        <div className="flex items-center space-x-4">
                                            <div className="p-2 bg-muted rounded-full">
                                                {mcp.icon}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium leading-none">{mcp.name}</p>
                                                <p className="text-xs text-muted-foreground mt-1">{mcp.type}</p>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <Badge variant={mcp.status === "connected" ? "default" : "destructive"} className={mcp.status === "connected" ? "bg-green-500 hover:bg-green-600" : ""}>
                                                {mcp.status === "connected" ? "Active" : "Error"}
                                            </Badge>
                                            {mcp.latency && (
                                                <span className="text-[10px] text-muted-foreground font-mono">
                                                    {mcp.latency}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>External Services</CardTitle>
                            <CardDescription>
                                Configure third-party service integrations.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-4">
                                <div className="flex items-center justify-between p-4 border rounded-lg">
                                    <div className="space-y-0.5">
                                        <div className="font-medium">Telegram Notifications</div>
                                        <div className="text-xs text-muted-foreground">Send trade alerts to Telegram bot</div>
                                    </div>
                                    <Button
                                        variant={connectedServices.telegram ? "outline" : "outline"}
                                        size="sm"
                                        className={connectedServices.telegram ? "text-green-500 border-green-500 hover:text-green-600" : ""}
                                        onClick={() => handleConnectService('telegram')}
                                        disabled={connectedServices.telegram || connectingService === 'telegram'}
                                    >
                                        {connectingService === 'telegram' ? (
                                            "Connecting..."
                                        ) : connectedServices.telegram ? (
                                            <>
                                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                                Connected
                                            </>
                                        ) : (
                                            "Connect"
                                        )}
                                    </Button>
                                </div>
                                <div className="flex items-center justify-between p-4 border rounded-lg">
                                    <div className="space-y-0.5">
                                        <div className="font-medium">Discord Webhooks</div>
                                        <div className="text-xs text-muted-foreground">Post updates to Discord channel</div>
                                    </div>
                                    <Button
                                        variant={connectedServices.discord ? "outline" : "outline"}
                                        size="sm"
                                        className={connectedServices.discord ? "text-green-500 border-green-500 hover:text-green-600" : ""}
                                        onClick={() => handleConnectService('discord')}
                                        disabled={connectedServices.discord || connectingService === 'discord'}
                                    >
                                        {connectingService === 'discord' ? (
                                            "Connecting..."
                                        ) : connectedServices.discord ? (
                                            <>
                                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                                Connected
                                            </>
                                        ) : (
                                            "Connect"
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="audit" className="mt-6 space-y-6">
                    <div className="flex justify-between items-center">
                        <h2 className="text-lg font-semibold">System Health & Integrity</h2>
                        <Button
                            onClick={runLiveAudit}
                            disabled={isAuditing}
                            className={auditResult?.success === false ? "bg-red-600 hover:bg-red-700" : ""}
                        >
                            <RefreshCw className={`h-4 w-4 mr-2 ${isAuditing ? "animate-spin" : ""}`} />
                            {isAuditing ? "Running Audit..." : "Run Live Verification"}
                        </Button>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Engine Status</CardTitle>
                                <RefreshCw className={isChecking ? "h-4 w-4 text-muted-foreground animate-spin" : "h-4 w-4 text-muted-foreground"} />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold flex items-center gap-2">
                                    {(healthStatus?.engine?.status === 'online') ? (
                                        <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
                                    ) : (
                                        <div className="h-3 w-3 rounded-full bg-red-500" />
                                    )}
                                    {healthStatus?.engine?.status === 'online' ? "Online" : "Offline"}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Heartbeat: {healthStatus?.engine?.latency ? `${healthStatus.engine.latency}ms ago` : 'Never'}
                                </p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Data Purity</CardTitle>
                                <Database className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {healthStatus?.data?.status === 'secure' ? "Secure" : "Incomplete"}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {healthStatus?.data?.message || "Checking keys..."}
                                </p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Strategy Integrity</CardTitle>
                                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{healthStatus?.strategies?.count || 0}</div>
                                <p className="text-xs text-muted-foreground">
                                    Active Strategies Loaded
                                </p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">System Logs</CardTitle>
                                <Terminal className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{logs.length}</div>
                                <p className="text-xs text-muted-foreground">
                                    Events Recorded
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                        <Card className="col-span-1 h-[500px] flex flex-col">
                            <CardHeader>
                                <CardTitle>Live System Logs</CardTitle>
                                <CardDescription>
                                    Real-time audit trail output.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex-1 overflow-hidden">
                                <div className="bg-black/90 text-green-400 font-mono text-xs p-4 rounded-md h-full overflow-y-auto space-y-1">
                                    {auditOutput ? (
                                        <pre className="whitespace-pre-wrap">{auditOutput}</pre>
                                    ) : logs.length > 0 ? (
                                        logs.map((log: any, i: number) => (
                                            <div key={i} className="flex gap-2">
                                                <span className="text-slate-500">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                                                <span className={log.level === 'error' ? 'text-red-500 font-bold' : log.level === 'warning' ? 'text-yellow-500' : 'text-blue-400'}>
                                                    [{log.source.toUpperCase()}]
                                                </span>
                                                <span>{log.message}</span>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-slate-500 italic">Ready to verify system integrity...</div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="col-span-1 h-[500px] flex flex-col">
                            <CardHeader>
                                <CardTitle>Comprehensive Audit Plan</CardTitle>
                                <CardDescription>
                                    Production Hardening Report (Live)
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex-1 overflow-hidden">
                                <div className="bg-muted p-4 rounded-md h-full overflow-y-auto text-sm prose dark:prose-invert max-w-none">
                                    {auditReport ? (
                                        <pre className="whitespace-pre-wrap font-sans">{auditReport}</pre>
                                    ) : (
                                        <div className="flex items-center justify-center h-full">
                                            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="general" className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>System Preferences</CardTitle>
                            <CardDescription>
                                General display and operation settings.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-2">
                                <Label htmlFor="theme">Theme</Label>
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" className="w-full justify-start">Dark Mode (Default)</Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="api-keys" className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>API Key Management</CardTitle>
                            <CardDescription>
                                Securely manage your exchange API keys. Keys are stored locally in .env.local.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <h3 className="text-sm font-semibold text-muted-foreground">Exchanges</h3>
                                    <div className="p-3 border rounded-md space-y-3 bg-muted/20">
                                        <h4 className="font-medium text-sm flex items-center gap-2">
                                            <img src="https://coindcx.com/favicon.ico" alt="CoinDCX" className="w-4 h-4" onError={(e) => e.currentTarget.style.display = 'none'} />
                                            CoinDCX
                                        </h4>
                                        <div className="grid gap-2">
                                            <Label className="text-xs">API Key</Label>
                                            <Input
                                                type="password"
                                                value={apiKeys.COINDCX_API_KEY}
                                                onChange={(e) => handleKeyChange("COINDCX_API_KEY", e.target.value)}
                                                placeholder="Enter CoinDCX API Key"
                                                className="h-8"
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label className="text-xs">Secret Key</Label>
                                            <Input
                                                type="password"
                                                value={apiKeys.COINDCX_SECRET_KEY}
                                                onChange={(e) => handleKeyChange("COINDCX_SECRET_KEY", e.target.value)}
                                                placeholder="Enter CoinDCX Secret Key"
                                                className="h-8"
                                            />
                                        </div>
                                    </div>

                                    <div className="p-3 border rounded-md space-y-3 bg-muted/20">
                                        <h4 className="font-medium text-sm flex items-center gap-2">
                                            <Globe className="w-4 h-4 text-yellow-500" />
                                            Binance
                                        </h4>
                                        <div className="grid gap-2">
                                            <Label className="text-xs">API Key</Label>
                                            <Input
                                                type="password"
                                                value={apiKeys.BINANCE_API_KEY}
                                                onChange={(e) => handleKeyChange("BINANCE_API_KEY", e.target.value)}
                                                placeholder="Enter Binance API Key"
                                                className="h-8"
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label className="text-xs">Secret Key</Label>
                                            <Input
                                                type="password"
                                                value={apiKeys.BINANCE_SECRET_KEY}
                                                onChange={(e) => handleKeyChange("BINANCE_SECRET_KEY", e.target.value)}
                                                placeholder="Enter Binance Secret Key"
                                                className="h-8"
                                            />
                                        </div>
                                    </div>

                                    <div className="p-3 border rounded-md space-y-3 bg-muted/20">
                                        <h4 className="font-medium text-sm flex items-center gap-2">
                                            <Globe className="w-4 h-4 text-purple-500" />
                                            Kraken
                                        </h4>
                                        <div className="grid gap-2">
                                            <Label className="text-xs">API Key</Label>
                                            <Input
                                                type="password"
                                                value={apiKeys.KRAKEN_API_KEY}
                                                onChange={(e) => handleKeyChange("KRAKEN_API_KEY", e.target.value)}
                                                placeholder="Enter Kraken API Key"
                                                className="h-8"
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label className="text-xs">Private Key (Secret)</Label>
                                            <Input
                                                type="password"
                                                value={apiKeys.KRAKEN_SECRET_KEY}
                                                onChange={(e) => handleKeyChange("KRAKEN_SECRET_KEY", e.target.value)}
                                                placeholder="Enter Kraken Private Key"
                                                className="h-8"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <h3 className="text-sm font-semibold text-muted-foreground">AI & Integrations</h3>
                                    <div className="grid gap-2">
                                        <Label>Gemini API Key</Label>
                                        <Input
                                            type="password"
                                            value={apiKeys.GEMINI_API_KEY}
                                            onChange={(e) => handleKeyChange("GEMINI_API_KEY", e.target.value)}
                                            placeholder="Gemini API Key"
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Telegram Bot Token</Label>
                                        <Input
                                            type="password"
                                            value={apiKeys.TELEGRAM_BOT_TOKEN}
                                            onChange={(e) => handleKeyChange("TELEGRAM_BOT_TOKEN", e.target.value)}
                                            placeholder="Telegram Bot Token"
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Discord Webhook</Label>
                                        <Input
                                            type="password"
                                            value={apiKeys.DISCORD_WEBHOOK_URL}
                                            onChange={(e) => handleKeyChange("DISCORD_WEBHOOK_URL", e.target.value)}
                                            placeholder="Discord Webhook URL"
                                        />
                                    </div>
                                </div>
                            </div>
                            <Button onClick={handleSaveKeys} className="w-full md:w-auto">Save Configuration</Button>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
