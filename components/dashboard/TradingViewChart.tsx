"use client";

import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, ISeriesApi, IPriceLine } from 'lightweight-charts';

interface TradeOverlay {
    type: 'entry' | 'sl' | 'tp';
    price: number;
    label: string;
}

interface TradingViewChartProps {
    symbol: string;
    timeframe: string;
    overlays?: TradeOverlay[];
}

export const TradingViewChart: React.FC<TradingViewChartProps> = ({
    symbol,
    timeframe,
    overlays = []
}) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<any>(null);
    const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
    const priceLinesRef = useRef<IPriceLine[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!chartContainerRef.current) return;

        // Initialize Chart
        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: '#0f172a' },
                textColor: '#94a3b8',
            },
            grid: {
                vertLines: { color: '#1e293b' },
                horzLines: { color: '#1e293b' },
            },
            width: chartContainerRef.current.clientWidth,
            height: 600,
            timeScale: {
                timeVisible: true,
                secondsVisible: false,
            },
        });

        const candlestickSeries = chart.addCandlestickSeries({
            upColor: '#22c55e',
            downColor: '#ef4444',
            borderVisible: false,
            wickUpColor: '#22c55e',
            wickDownColor: '#ef4444',
        });

        seriesRef.current = candlestickSeries;
        chartRef.current = chart;

        const handleResize = () => {
            chart.applyOptions({ width: chartContainerRef.current?.clientWidth });
        };

        window.addEventListener('resize', handleResize);

        // Fetch Initial Data
        const fetchData = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/market-data/ohlcv?symbol=${symbol}&timeframe=${timeframe}&limit=200`);
                const result = await res.json();
                if (result.success) {
                    candlestickSeries.setData(result.data);
                    chart.timeScale().fitContent();
                }
            } catch (error) {
                console.error("Chart data fetch failed", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
        };
    }, [symbol, timeframe]);

    // Update Overlays (SL/TP/Entry Lines)
    useEffect(() => {
        if (!seriesRef.current) return;

        // Clear existing lines
        priceLinesRef.current.forEach(line => seriesRef.current?.removePriceLine(line));
        priceLinesRef.current = [];

        // Add new lines
        overlays.forEach(ov => {
            const color = ov.type === 'entry' ? '#3b82f6' : ov.type === 'sl' ? '#ef4444' : '#22c55e';
            const priceLine = seriesRef.current?.createPriceLine({
                price: ov.price,
                color: color,
                lineWidth: 2,
                lineStyle: 2, // Dashed
                axisLabelVisible: true,
                title: ov.label,
            });
            if (priceLine) priceLinesRef.current.push(priceLine);
        });
    }, [overlays, symbol]);

    return (
        <div className="relative w-full bg-slate-950 rounded-xl border border-slate-800 overflow-hidden shadow-2xl">
            {loading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm">
                    <div className="flex flex-col items-center gap-4">
                        <div className="h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Synchronizing Market Data...</span>
                    </div>
                </div>
            )}
            <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    <h2 className="text-sm font-bold text-slate-200">{symbol} <span className="text-slate-500 ml-1">[{timeframe}]</span></h2>
                </div>
                <div className="flex gap-2">
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-blue-500/10 border border-blue-500/20">
                        <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                        <span className="text-[10px] font-bold text-blue-400 uppercase">Entry</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-green-500/10 border border-green-500/20">
                        <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        <span className="text-[10px] font-bold text-green-400 uppercase">TP</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-red-500/10 border border-red-500/20">
                        <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
                        <span className="text-[10px] font-bold text-red-400 uppercase">SL</span>
                    </div>
                </div>
            </div>
            <div ref={chartContainerRef} className="w-full h-[600px]" />
        </div>
    );
};
