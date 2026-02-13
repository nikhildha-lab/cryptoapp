"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { useState } from "react";

export function RiskControls() {
    const [stopLoss, setStopLoss] = useState([2]);
    const [takeProfit, setTakeProfit] = useState([5]);
    const [leverage, setLeverage] = useState([5]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Risk Management</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <div className="flex justify-between">
                        <Label>Stop Loss</Label>
                        <span className="text-sm font-bold text-red-500">{stopLoss}%</span>
                    </div>
                    <Slider
                        defaultValue={[2]}
                        max={10}
                        step={0.1}
                        value={stopLoss}
                        onValueChange={setStopLoss}
                        className="w-full"
                    />
                </div>
                <div className="space-y-2">
                    <div className="flex justify-between">
                        <Label>Take Profit</Label>
                        <span className="text-sm font-bold text-green-500">{takeProfit}%</span>
                    </div>
                    <Slider
                        defaultValue={[5]}
                        max={20}
                        step={0.5}
                        value={takeProfit}
                        onValueChange={setTakeProfit}
                        className="w-full"
                    />
                </div>
                <div className="space-y-2">
                    <div className="flex justify-between">
                        <Label>Leverage</Label>
                        <span className="text-sm font-bold text-blue-500">{leverage}x</span>
                    </div>
                    <Slider
                        defaultValue={[5]}
                        max={10}
                        step={1}
                        value={leverage}
                        onValueChange={setLeverage}
                        className="w-full"
                    />
                </div>
            </CardContent>
        </Card>
    );
}
