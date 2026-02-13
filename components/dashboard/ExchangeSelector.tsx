
import React from 'react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { EXCHANGES } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";

interface ExchangeSelectorProps {
    value: string;
    onValueChange: (value: string) => void;
    className?: string;
}

export function ExchangeSelector({ value, onValueChange, className }: ExchangeSelectorProps) {
    const selectedExchange = EXCHANGES.find(ex => ex.id === value) || EXCHANGES[0];

    return (
        <Select value={value} onValueChange={onValueChange}>
            <SelectTrigger className={`w-full ${className}`}>
                <SelectValue placeholder="Select Exchange">
                    <div className="flex items-center gap-2">
                        <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: selectedExchange.color }}
                        />
                        <span>{selectedExchange.name}</span>
                    </div>
                </SelectValue>
            </SelectTrigger>
            <SelectContent>
                {EXCHANGES.map((exchange) => (
                    <SelectItem key={exchange.id} value={exchange.id}>
                        <div className="flex items-center gap-2">
                            <div
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: exchange.color }}
                            />
                            <span>{exchange.name}</span>
                            {exchange.id === 'coindcx' && (
                                <Badge variant="outline" className="ml-auto text-[10px] py-0 h-4">INR</Badge>
                            )}
                            {exchange.id === 'delta' && (
                                <Badge variant="outline" className="ml-auto text-[10px] py-0 h-4">Futures</Badge>
                            )}
                        </div>
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
