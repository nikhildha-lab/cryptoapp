"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Wand2, Loader2, CheckCircle2 } from "lucide-react";
import { useStrategies } from "@/hooks/useStrategies";
import { toast } from "sonner";

export function CreateStrategyDialog({ onStrategyCreated }: { onStrategyCreated?: () => void }) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState("");
    const [logic, setLogic] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);

    const handleCreate = async () => {
        if (!name || !logic) {
            toast.error("Please provide a name and strategy logic.");
            return;
        }

        setIsGenerating(true);
        try {
            const res = await fetch('/api/strategies/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    description: "AI Generated Strategy",
                    content: logic
                })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to create strategy");
            }

            toast.success("Strategy created successfully!");
            setOpen(false);
            setName("");
            setLogic("");

            if (onStrategyCreated) {
                onStrategyCreated();
            }

        } catch (error: any) {
            toast.error(`Error: ${error.message}`);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-2 border-dashed">
                    <Wand2 className="h-4 w-4 text-purple-500" />
                    Create Strategy
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[525px]">
                <DialogHeader>
                    <DialogTitle>Create AI Strategy</DialogTitle>
                    <DialogDescription>
                        Describe your strategy in plain English or paste Pine Script code.
                        Our AI will convert it into a deployable bot.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="name">Strategy Name</Label>
                        <Input
                            id="name"
                            placeholder="e.g. My Custom RSI Bot"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="logic">Trading Logic (Text or Code)</Label>
                        <Textarea
                            id="logic"
                            placeholder="e.g. Buy when RSI < 25 and Price > 200 EMA. Sell when RSI > 70."
                            className="h-[150px] font-mono text-sm"
                            value={logic}
                            onChange={(e) => setLogic(e.target.value)}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={isGenerating}>Cancel</Button>
                    <Button onClick={handleCreate} disabled={isGenerating} className="bg-purple-600 hover:bg-purple-700">
                        {isGenerating ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Generating Code...
                            </>
                        ) : (
                            <>
                                <Wand2 className="mr-2 h-4 w-4" />
                                Generate & Save
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
