"use client";

import { useState } from "react";
import { useStrategies } from "@/hooks/useStrategies";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronDown, ChevronUp, Code, Copy, Check, FileCode, Info } from "lucide-react";
import { toast } from "sonner";

export function StrategyDocumentation() {
    const { strategies } = useStrategies();
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [codeContent, setCodeContent] = useState<Record<string, string>>({});
    const [loadingCode, setLoadingCode] = useState<Record<string, boolean>>({});
    const [copied, setCopied] = useState(false);

    const toggleExpand = (id: string) => {
        if (expandedId === id) {
            setExpandedId(null);
        } else {
            setExpandedId(id);
        }
    };

    const fetchCode = async (strategyId: string) => {
        if (codeContent[strategyId]) return;

        setLoadingCode(prev => ({ ...prev, [strategyId]: true }));
        try {
            const res = await fetch(`/api/strategies/code?id=${strategyId}`);
            if (!res.ok) throw new Error("Failed to fetch code");
            const data = await res.json();
            setCodeContent(prev => ({ ...prev, [strategyId]: data.code }));
        } catch (_) {
            toast.error("Could not load strategy code");
        } finally {
            setLoadingCode(prev => ({ ...prev, [strategyId]: false }));
        }
    };

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success("Code copied to clipboard");
    };

    return (
        <Card className="col-span-4 mt-8">
            <CardHeader>
                <div className="flex items-center gap-2">
                    <FileCode className="h-5 w-5 text-primary" />
                    <CardTitle>Strategy Encyclopedia</CardTitle>
                </div>
                <CardDescription>
                    Deep dive into the logic, parameters, and source code of every strategy.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {strategies.map((strategy) => {
                        const isExpanded = expandedId === strategy.id;

                        return (
                            <div key={strategy.id} className="border rounded-lg overflow-hidden transition-all duration-200">
                                <div
                                    className={`p-4 flex items-center justify-between cursor-pointer hover:bg-muted/50 ${isExpanded ? "bg-muted/30" : ""}`}
                                    onClick={() => toggleExpand(strategy.id)}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs ${strategy.category === "Trend" ? "bg-blue-100 text-blue-600" :
                                            strategy.category === "Mean Reversion" ? "bg-purple-100 text-purple-600" :
                                                strategy.category === "Breakout" ? "bg-orange-100 text-orange-600" :
                                                    "bg-gray-100 text-gray-600"
                                            }`}>
                                            {strategy.id.slice(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-sm">{strategy.name}</h3>
                                            <p className="text-xs text-muted-foreground">{strategy.category} • {strategy.params.timeframe}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {strategy.rating && (
                                            <Badge variant="outline" className={
                                                strategy.rating.startsWith('A') ? "text-green-600 border-green-200 bg-green-50" : "text-gray-600"
                                            }>
                                                Grade: {strategy.rating}
                                            </Badge>
                                        )}
                                        {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="border-t bg-card animate-in slide-in-from-top-2 duration-200">
                                        <div className="p-6">
                                            <Tabs defaultValue="logic" className="w-full">
                                                <TabsList className="grid w-full grid-cols-2 mb-4 w-[200px]">
                                                    <TabsTrigger value="logic">Logic & Rules</TabsTrigger>
                                                    <TabsTrigger value="code" onClick={() => fetchCode(strategy.id)}>Source Code</TabsTrigger>
                                                </TabsList>

                                                <TabsContent value="logic" className="space-y-6">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                        <div className="space-y-4">
                                                            <div>
                                                                <h4 className="flex items-center gap-2 font-medium text-sm text-primary mb-2">
                                                                    <Info className="h-4 w-4" /> Description
                                                                </h4>
                                                                <p className="text-sm text-muted-foreground leading-relaxed">
                                                                    {strategy.description}
                                                                </p>
                                                            </div>
                                                            <div>
                                                                <h4 className="font-medium text-sm mb-2">Ideal Conditions</h4>
                                                                <div className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 text-sm p-3 rounded-md border border-yellow-500/20">
                                                                    {strategy.optimalConditions}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="space-y-3">
                                                            <div className="p-3 bg-muted/30 rounded-lg border">
                                                                <span className="text-xs font-bold text-green-600 block mb-1">ENTRY RULES</span>
                                                                <code className="text-sm font-mono text-foreground">{strategy.logic.entry}</code>
                                                            </div>
                                                            <div className="p-3 bg-muted/30 rounded-lg border">
                                                                <span className="text-xs font-bold text-red-600 block mb-1">EXIT RULES</span>
                                                                <code className="text-sm font-mono text-foreground">{strategy.logic.exit}</code>
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-3">
                                                                <div className="p-3 bg-muted/30 rounded-lg border">
                                                                    <span className="text-xs font-bold text-orange-600 block mb-1">STOP LOSS</span>
                                                                    <code className="text-sm font-mono">{strategy.logic.stopLoss}</code>
                                                                </div>
                                                                <div className="p-3 bg-muted/30 rounded-lg border">
                                                                    <span className="text-xs font-bold text-blue-600 block mb-1">TAKE PROFIT</span>
                                                                    <code className="text-sm font-mono">{strategy.logic.takeProfit}</code>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </TabsContent>

                                                <TabsContent value="code">
                                                    <div className="relative rounded-lg border bg-zinc-950 text-zinc-50 overflow-hidden">
                                                        <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900/50">
                                                            <span className="text-xs font-mono text-zinc-400">python / {strategy.id}.py</span>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-6 w-6 p-0 hover:bg-zinc-800 text-zinc-400"
                                                                onClick={() => codeContent[strategy.id] && handleCopy(codeContent[strategy.id])}
                                                            >
                                                                {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                                                            </Button>
                                                        </div>
                                                        <ScrollArea className="h-[400px] w-full">
                                                            <div className="p-4">
                                                                {loadingCode[strategy.id] ? (
                                                                    <div className="flex items-center justify-center py-20 text-zinc-500 gap-2">
                                                                        <Code className="h-4 w-4 animate-pulse" /> Loading source...
                                                                    </div>
                                                                ) : codeContent[strategy.id] ? (
                                                                    <pre className="font-mono text-xs leading-relaxed">
                                                                        {codeContent[strategy.id]}
                                                                    </pre>
                                                                ) : (
                                                                    <div className="text-center py-20 text-zinc-500 text-sm">
                                                                        Click to load source code
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </ScrollArea>
                                                    </div>
                                                </TabsContent>
                                            </Tabs>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
