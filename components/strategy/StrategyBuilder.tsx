"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, User, Play } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";

interface Message {
    role: "user" | "assistant";
    content: string;
    canSave?: boolean;
    saved?: boolean;
}

interface BacktestResult {
    pnl: number;
    sharpe_ratio: number;
    max_drawdown: number;
    win_rate: number;
    chart_data: { date: string; pnl: number }[];
}

interface StrategyBuilderProps {
    onBacktestComplete: (result: BacktestResult) => void;
    onStrategyCreated?: () => void;
}

export function StrategyBuilder({ onBacktestComplete, onStrategyCreated }: StrategyBuilderProps) {
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [lastLogic, setLastLogic] = useState("");
    const [messages, setMessages] = useState<Message[]>([
        {
            role: "assistant",
            content: "Hello! I can help you design and backtest strategies. Try typing 'Test RSI Strategy' to run a simulation.",
        },
    ]);

    const handleSave = async (index: number) => {
        const name = window.prompt("Name your strategy:");
        if (!name) return;

        const loadingId = toast.loading("Creating strategy context...");

        try {
            const res = await fetch("/api/strategies/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name,
                    description: `Generated via Chat: ${lastLogic}`,
                    logic: lastLogic
                })
            });

            if (!res.ok) throw new Error("Failed to create strategy");

            toast.success("Strategy saved to library!", { id: loadingId });

            // Mark message as saved
            setMessages(prev => prev.map((m, i) => i === index ? { ...m, saved: true } : m));

            if (onStrategyCreated) onStrategyCreated();

        } catch (error) {
            toast.error("Failed to save strategy", { id: loadingId });
        }
    };

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMsg = input;
        setLastLogic(userMsg);

        // Add user message
        const newMessages = [...messages, { role: "user" as const, content: userMsg }];
        setMessages(newMessages);
        setInput("");
        setIsLoading(true);

        try {
            // 1. Call Agent to parse strategy
            setMessages((prev) => [...prev, { role: "assistant", content: "Analyzing strategy..." }]);

            const agentResponse = await fetch("/api/agent", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt: userMsg }),
            });

            const agentData = await agentResponse.json();

            if (agentData.error || !agentData.params) {
                // Remove "Analyzing..." message and add error
                setMessages((prev) => {
                    const filtered = prev.filter(m => m.content !== "Analyzing strategy...");
                    return [...filtered, { role: "assistant", content: `Error: ${agentData.error || "Could not understand strategy."} \nReasoning: ${agentData.reasoning || "N/A"}` }];
                });
                setIsLoading(false);
                return;
            }

            // 2. Display Agent Reasoning
            setMessages((prev) => {
                const filtered = prev.filter(m => m.content !== "Analyzing strategy...");
                return [...filtered, { role: "assistant", content: `I've configured a ${agentData.params.strategy} strategy on ${agentData.params.symbol}. \n\nAnalysis: ${agentData.reasoning}` }];
            });

            // 3. Trigger Backtest with Agent Params
            setMessages((prev) => [...prev, { role: "assistant", content: "Running backtest..." }]);

            const backtestResponse = await fetch("/api/backtest", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(agentData.params),
            });

            const result = await backtestResponse.json();
            onBacktestComplete(result);

            setMessages((prev) => {
                const filtered = prev.filter(m => m.content !== "Running backtest...");
                return [...filtered, {
                    role: "assistant",
                    content: `Backtest Complete! 
                    \nPNL: $${result.pnl.toFixed(2)}
                    \nWin Rate: ${(result.win_rate * 100).toFixed(1)}%
                    \nSharpe: ${result.sharpe_ratio.toFixed(2)}`,
                    canSave: true
                }];
            });

        } catch (error) {
            console.error(error);
            setMessages((prev) => [...prev, { role: "assistant", content: "An error occurred during processing." }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card className="h-[600px] flex flex-col">
            <CardHeader>
                <CardTitle>Strategy Builder AI</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-0">
                <ScrollArea className="h-[450px] p-4">
                    <div className="space-y-4">
                        {messages.map((msg, i) => (
                            <div
                                key={i}
                                className={`flex gap-3 ${msg.role === "assistant" ? "flex-row" : "flex-row-reverse"
                                    }`}
                            >
                                <Avatar className="h-8 w-8">
                                    <AvatarFallback>{msg.role === "assistant" ? "AI" : "ME"}</AvatarFallback>
                                    {msg.role === "assistant" && <Bot className="h-5 w-5 p-1" />}
                                    {msg.role === "user" && <User className="h-5 w-5 p-1" />}
                                </Avatar>
                                <div
                                    className={`rounded-lg p-3 text-sm max-w-[80%] whitespace-pre-wrap ${msg.role === "assistant"
                                        ? "bg-secondary text-secondary-foreground"
                                        : "bg-primary text-primary-foreground"
                                        }`}
                                >
                                    {msg.content}
                                    {msg.canSave && !msg.saved && (
                                        <div className="mt-3 pt-2 border-t border-secondary-foreground/10">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="bg-background text-foreground hover:bg-background/90"
                                                onClick={() => handleSave(i)}
                                            >
                                                Save as Strategy
                                            </Button>
                                        </div>
                                    )}
                                    {msg.saved && (
                                        <div className="mt-2 text-xs opacity-70 italic">
                                            ✓ Strategy Saved
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {isLoading && <div className="text-xs text-muted-foreground text-center">Thinking...</div>}
                    </div>
                </ScrollArea>
            </CardContent>
            <CardFooter className="p-4 pt-0">
                <div className="flex w-full items-center space-x-2">
                    <Input
                        placeholder="Type 'Test RSI'..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSend()}
                        disabled={isLoading}
                    />
                    <Button size="icon" onClick={handleSend} disabled={isLoading}>
                        <Send className="h-4 w-4" />
                    </Button>
                </div>
            </CardFooter>
        </Card>
    );
}
