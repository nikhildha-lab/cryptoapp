"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { STRATEGIES, Strategy } from "@/lib/constants";
import { ArrowLeft, Rocket, ShieldCheck, CheckCircle2, RotateCcw, Plus, Trash2 } from "lucide-react";
import { ExchangeSelector } from "@/components/dashboard/ExchangeSelector";

interface DeploymentRow {
    id: string; // Unique ID for the row
    strategyId: string;
    coin: string;
    timeframe: string;
    capital: string;
    leverage: string;
    exchange: string;
}

const AVAILABLE_COINS = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "AVAX/USDT", "ADA/USDT", "MATIC/USDT", "DOT/USDT"];
const AVAILABLE_TIMEFRAMES = ["1m", "3m", "5m", "15m", "1h", "4h", "1d"];

export default function DeployPage() {
    const router = useRouter();

    // Global Settings
    const [globalMode, setGlobalMode] = useState<"paper" | "live">("paper");
    const [globalExchange, setGlobalExchange] = useState("binance");
    const [isConnected, setIsConnected] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [isDeploying, setIsDeploying] = useState(false);

    // Grid State: Initialize with rows for all strategies by default
    const [rows, setRows] = useState<DeploymentRow[]>([]);
    const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);

    const searchParams = useSearchParams();
    const shortlistParam = searchParams.get("shortlist");
    const singleIdParam = searchParams.get("strategyId");

    // Config params from previous screen
    const coinParam = searchParams.get("coin");
    const timeframeParam = searchParams.get("timeframe");
    const leverageParam = searchParams.get("leverage");
    const exchangeParam = searchParams.get("exchange");

    useEffect(() => {
        let strategiesToInitialize = STRATEGIES;

        if (shortlistParam) {
            const shortlistedIds = shortlistParam.split(",");
            strategiesToInitialize = STRATEGIES.filter(s => shortlistedIds.includes(s.id));
        } else if (singleIdParam) {
            strategiesToInitialize = STRATEGIES.filter(s => s.id === singleIdParam);
        }

        const initialRows = strategiesToInitialize.map(s => ({
            id: crypto.randomUUID(),
            strategyId: s.id,
            coin: coinParam || s.params.symbol || "BTC/USDT",
            timeframe: timeframeParam || s.params.timeframe || "1h",
            capital: "1000",
            leverage: leverageParam || s.deployment?.leverage?.split('-')[0] || "5",
            exchange: exchangeParam || globalExchange
        }));

        setRows(initialRows);
        setSelectedRowIds(initialRows.map(r => r.id));
    }, [shortlistParam, singleIdParam, coinParam, timeframeParam, leverageParam, exchangeParam, globalExchange]);

    const handleConnect = async () => {
        setIsVerifying(true);
        try {
            const response = await fetch('/api/system/status');
            const data = await response.json();
            if (data.exchanges && data.exchanges[globalExchange]) {
                setIsConnected(true);
            } else {
                alert(`No API keys found for ${globalExchange.toUpperCase()}. Please configure them in Settings.`);
                setIsConnected(false);
            }
        } catch (error) {
            console.error(error);
            alert("Failed to verify connection.");
        } finally {
            setIsVerifying(false);
        }
    };

    const [totalBudget, setTotalBudget] = useState("5000");

    // Distributed Capital Logic: Auto-divide total budget among selected rows
    useEffect(() => {
        if (selectedRowIds.length > 0) {
            const budgetPerBot = Math.floor(Number(totalBudget) / selectedRowIds.length);
            setRows(prev => prev.map(row => {
                if (selectedRowIds.includes(row.id)) {
                    return { ...row, capital: String(budgetPerBot) };
                }
                return row;
            }));
        }
    }, [totalBudget, selectedRowIds.length]);

    const toggleSelection = (id: string) => {
        setSelectedRowIds(prev =>
            prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
        );
    };

    const toggleSelectAll = () => {
        if (selectedRowIds.length === rows.length) {
            setSelectedRowIds([]);
        } else {
            setSelectedRowIds(rows.map(r => r.id));
        }
    };

    const updateRow = (id: string, field: keyof DeploymentRow, value: string) => {
        setRows(prev => prev.map(row => {
            if (row.id !== id) return row;

            const updatedRow = { ...row, [field]: value };

            if (field === 'strategyId') {
                const strat = STRATEGIES.find(s => s.id === value);
                if (strat) {
                    updatedRow.coin = strat.params.symbol || updatedRow.coin;
                    updatedRow.timeframe = strat.params.timeframe || updatedRow.timeframe;
                    // Distributed logic takes over capital
                }
            }
            return updatedRow;
        }));
    };

    const addRow = () => {
        const newRow: DeploymentRow = {
            id: crypto.randomUUID(),
            strategyId: STRATEGIES[0].id,
            coin: "BTC/USDT",
            timeframe: "1h",
            capital: "0", // Will be auto-set by distributed logic
            leverage: "5",
            exchange: globalExchange
        };
        setRows([...rows, newRow]);
        setSelectedRowIds([...selectedRowIds, newRow.id]);
    };

    const removeRow = (id: string) => {
        setRows(rows.filter(r => r.id !== id));
        setSelectedRowIds(selectedRowIds.filter(rid => rid !== id));
    };

    const handleBulkDeploy = async () => {
        if (selectedRowIds.length === 0) return;
        setIsDeploying(true);

        const results = { success: 0, failed: 0 };
        const errors: string[] = [];

        try {
            for (const rowId of selectedRowIds) {
                const row = rows.find(r => r.id === rowId);
                if (!row) continue;

                try {
                    const response = await fetch('/api/deploy', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            strategyId: row.strategyId,
                            exchange: row.exchange,
                            mode: globalMode,
                            capital: row.capital,
                            leverage: row.leverage,
                            symbolOverride: row.coin,
                            timeframeOverride: row.timeframe
                        })
                    });

                    if (!response.ok) throw new Error("API Error");
                    results.success++;
                } catch (e: any) {
                    results.failed++;
                    errors.push(`${row.strategyId}: ${e.message}`);
                }
            }

            if (results.failed === 0) {
                alert(`Successfully deployed ${results.success} agents! 24/7 Tracking Activated.`);
                router.push("/");
            } else {
                alert(`Partial Deployment: ${results.success} successful, ${results.failed} failed.\nCheck logs for details.`);
            }

        } catch (e) {
            alert("Deployment process failed.");
        } finally {
            setIsDeploying(false);
        }
    };

    const getStrategyDetails = (id: string) => STRATEGIES.find(s => s.id === id);

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-10">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Bulk Agent Deployment</h1>
                    <p className="text-muted-foreground">
                        Configure a fleet of trading agents. Mix strategies, coins, exchanges and timeframes.
                    </p>
                </div>
            </div>
            <Separator />

            {/* Global Configuration Bar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">1. Default Execution Mode</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex gap-2">
                            <div
                                className={`flex-1 p-3 border rounded-md cursor-pointer flex items-center gap-2 justify-center transition-colors ${globalMode === 'paper' ? 'bg-primary/10 border-primary' : 'hover:bg-muted'}`}
                                onClick={() => setGlobalMode('paper')}
                            >
                                <ShieldCheck className="h-4 w-4 text-green-500" />
                                <span className="font-semibold text-sm">Paper</span>
                            </div>
                            <div
                                className={`flex-1 p-3 border rounded-md cursor-pointer flex items-center gap-2 justify-center transition-colors ${globalMode === 'live' ? 'bg-red-500/10 border-red-500' : 'hover:bg-muted'}`}
                                onClick={() => setGlobalMode('live')}
                            >
                                <Rocket className="h-4 w-4 text-red-500" />
                                <span className="font-semibold text-sm">Live</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">2. Default Exchange</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <ExchangeSelector
                            value={globalExchange}
                            onValueChange={(v) => {
                                setGlobalExchange(v);
                                setIsConnected(false);
                                setRows(prev => prev.map(r => ({ ...r, exchange: v })));
                            }}
                        />
                        <div className="flex justify-end">
                            {isConnected ? (
                                <span className="text-xs text-green-500 flex items-center font-medium">
                                    <CheckCircle2 className="h-3 w-3 mr-1" /> Connected
                                </span>
                            ) : (
                                <span
                                    className="text-xs text-blue-500 cursor-pointer hover:underline"
                                    onClick={handleConnect}
                                >
                                    {isVerifying ? "Verifying..." : "Verify Connection"}
                                </span>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-muted/10">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">3. Wallet Deployment Budget</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                            <Input
                                type="number"
                                value={totalBudget}
                                onChange={(e) => setTotalBudget(e.target.value)}
                                className="pl-7 h-10 font-bold"
                            />
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-2">
                            Total capital distributed among {selectedRowIds.length} agents.
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-primary/5 border-primary/20">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">4. Deploy Action</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Button
                            className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-lg"
                            size="default"
                            onClick={handleBulkDeploy}
                            disabled={selectedRowIds.length === 0 || isDeploying || (globalMode === 'live' && !isConnected)}
                        >
                            {isDeploying ? "Deploying..." : `Deploy ${selectedRowIds.length} Agents`}
                        </Button>
                        <p className="text-[10px] text-center text-muted-foreground mt-2">
                            ${(Number(totalBudget) / (selectedRowIds.length || 1)).toFixed(0)} allocated per agent.
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Builder Table */}
            <Card>
                <CardHeader className="px-6 py-4 border-b">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <CardTitle>Strategy Builder</CardTitle>
                            <Badge variant="secondary" className="font-normal">{rows.length} Configured</Badge>
                        </div>
                        <Button variant="outline" size="sm" onClick={addRow} className="group">
                            <Plus className="h-4 w-4 mr-1 group-hover:text-green-500" /> Add Row
                        </Button>
                    </div>
                </CardHeader>
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead className="w-[40px]">
                                <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded border-gray-300"
                                    checked={selectedRowIds.length === rows.length && rows.length > 0}
                                    onChange={toggleSelectAll}
                                />
                            </TableHead>
                            <TableHead className="w-[200px]">Strategy</TableHead>
                            <TableHead className="w-[180px]">Exchange</TableHead>
                            <TableHead className="w-[150px]">Coin Pair</TableHead>
                            <TableHead className="w-[120px]">Timeframe</TableHead>
                            <TableHead className="w-[120px]">Capital ($)</TableHead>
                            <TableHead className="w-[100px]">Leverage</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.map((row) => {
                            const strategy = getStrategyDetails(row.strategyId);
                            return (
                                <TableRow key={row.id} className={selectedRowIds.includes(row.id) ? "bg-muted/20" : ""}>
                                    <TableCell>
                                        <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-gray-300"
                                            checked={selectedRowIds.includes(row.id)}
                                            onChange={() => toggleSelection(row.id)}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Select
                                            value={row.strategyId}
                                            onValueChange={(v) => updateRow(row.id, 'strategyId', v)}
                                            disabled={!selectedRowIds.includes(row.id)}
                                        >
                                            <SelectTrigger className="h-9 w-full">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {STRATEGIES.map(s => (
                                                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <div className="text-[10px] text-muted-foreground mt-1 truncate max-w-[150px]">
                                            {strategy?.description}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <ExchangeSelector
                                            value={row.exchange}
                                            onValueChange={(v) => updateRow(row.id, 'exchange', v)}
                                            className="h-9"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Select
                                            value={row.coin}
                                            onValueChange={(v) => updateRow(row.id, 'coin', v)}
                                            disabled={!selectedRowIds.includes(row.id)}
                                        >
                                            <SelectTrigger className="h-9">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {AVAILABLE_COINS.map(c => (
                                                    <SelectItem key={c} value={c}>{c}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell>
                                        <Select
                                            value={row.timeframe}
                                            onValueChange={(v) => updateRow(row.id, 'timeframe', v)}
                                            disabled={!selectedRowIds.includes(row.id)}
                                        >
                                            <SelectTrigger className="h-9">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {AVAILABLE_TIMEFRAMES.map(t => (
                                                    <SelectItem key={t} value={t}>{t}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell>
                                        <Input
                                            type="number"
                                            className="h-9"
                                            value={row.capital}
                                            onChange={(e) => updateRow(row.id, 'capital', e.target.value)}
                                            disabled={!selectedRowIds.includes(row.id)}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Select
                                            value={row.leverage}
                                            onValueChange={(v) => updateRow(row.id, 'leverage', v)}
                                            disabled={!selectedRowIds.includes(row.id)}
                                        >
                                            <SelectTrigger className="h-9">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="1">1x</SelectItem>
                                                <SelectItem value="2">2x</SelectItem>
                                                <SelectItem value="3">3x</SelectItem>
                                                <SelectItem value="5">5x</SelectItem>
                                                <SelectItem value="10">10x</SelectItem>
                                                <SelectItem value="20">20x</SelectItem>
                                                <SelectItem value="50">50x</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => removeRow(row.id)}
                                            className="h-8 w-8 text-muted-foreground hover:text-red-500"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </Card>
        </div>
    );
}
