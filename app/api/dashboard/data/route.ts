import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic'; // Prevent caching
const ACTIVE_STRATEGIES_FILE = path.join(process.cwd(), 'data', 'active_strategies.json');

export async function GET() {
    try {
        let activeStrategies = [];
        if (fs.existsSync(ACTIVE_STRATEGIES_FILE)) {
            const fileContent = fs.readFileSync(ACTIVE_STRATEGIES_FILE, 'utf-8');
            try {
                activeStrategies = JSON.parse(fileContent);
            } catch (e) {
                console.error("Failed to parse active strategies", e);
            }
        }

        // Calculate aggregated metrics
        const totalStrategies = activeStrategies.length;
        const activeLiveStrategies = activeStrategies.filter((s: any) => s.mode === 'live').length;
        const activePaperStrategies = activeStrategies.filter((s: any) => s.mode !== 'live').length;

        // Distinct strategies (unique strategyId)
        const distinctStrategies = new Set(activeStrategies.map((s: any) => s.strategyId)).size;

        const realizedPnL = activeStrategies.reduce((sum: number, s: any) => sum + (s.pnl || 0), 0);
        const unrealizedPnL = activeStrategies.reduce((sum: number, s: any) => sum + (s.unrealizedPnL || 0), 0);
        const totalPnL = realizedPnL + unrealizedPnL;

        const openTradesLive = activeStrategies.filter((s: any) => s.mode === 'live' && s.position !== null).length;
        const openTradesPaper = activeStrategies.filter((s: any) => s.mode !== 'live' && s.position !== null).length;

        const walletCapital = 5000; // Standardized as requested
        const capitalDeployed = activeStrategies.reduce((sum: number, s: any) => sum + (s.capital || 0), 0);

        // precise "Money at Risk" calculation (Live)
        const activePositionCapitalLive = activeStrategies
            .filter((s: any) => s.position !== null && s.mode === 'live')
            .reduce((sum: number, s: any) => sum + (s.capital || 0), 0);

        // PnL Live
        const realizedPnLLive = activeStrategies.filter((s: any) => s.mode === 'live').reduce((sum: number, s: any) => sum + (s.pnl || 0), 0);
        const unrealizedPnLLive = activeStrategies.filter((s: any) => s.mode === 'live').reduce((sum: number, s: any) => sum + (s.unrealizedPnL || 0), 0);
        const totalPnLLive = realizedPnLLive + unrealizedPnLLive;

        // ROI Live (use active capital if > 0, else total allocated live capital)
        const capitalDeployedLive = activeStrategies.filter((s: any) => s.mode === 'live').reduce((sum: number, s: any) => sum + (s.capital || 0), 0);
        const effectiveCapitalLive = activePositionCapitalLive > 0 ? activePositionCapitalLive : capitalDeployedLive;
        const pnlPercentageLive = effectiveCapitalLive > 0 ? (totalPnLLive / effectiveCapitalLive) * 100 : 0;


        // precise "Money at Risk" calculation (Paper)
        const activePositionCapitalPaper = activeStrategies
            .filter((s: any) => s.position !== null && s.mode !== 'live')
            .reduce((sum: number, s: any) => sum + (s.capital || 0), 0);

        // PnL Paper
        const realizedPnLPaper = activeStrategies.filter((s: any) => s.mode !== 'live').reduce((sum: number, s: any) => sum + (s.pnl || 0), 0);
        const unrealizedPnLPaper = activeStrategies.filter((s: any) => s.mode !== 'live').reduce((sum: number, s: any) => sum + (s.unrealizedPnL || 0), 0);
        const totalPnLPaper = realizedPnLPaper + unrealizedPnLPaper;

        // ROI Paper
        const capitalDeployedPaper = activeStrategies.filter((s: any) => s.mode !== 'live').reduce((sum: number, s: any) => sum + (s.capital || 0), 0);
        const effectiveCapitalPaper = activePositionCapitalPaper > 0 ? activePositionCapitalPaper : capitalDeployedPaper;
        const pnlPercentagePaper = effectiveCapitalPaper > 0 ? (totalPnLPaper / effectiveCapitalPaper) * 100 : 0;

        // Aggregated Totals (Restored)
        const activePositionCapital = activePositionCapitalLive + activePositionCapitalPaper;
        // Fallback to allocated if no active trades to show "Portfolio Return on Deployment"
        const effectiveCapital = activePositionCapital > 0 ? activePositionCapital : capitalDeployed;
        const pnlPercentage = effectiveCapital > 0 ? (totalPnL / effectiveCapital) * 100 : 0;

        const totalTrades = activeStrategies.reduce((sum: number, s: any) => sum + (s.trades || 0), 0);
        const totalWins = activeStrategies.reduce((sum: number, s: any) => sum + (s.wins || 0), 0);
        const winRate = totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0;

        // --- DRAWDOWN CALCULATION ---
        let maxDrawdown = 0;
        const TRADE_HISTORY_FILE = path.join(process.cwd(), 'data', 'trade_history.json');

        if (fs.existsSync(TRADE_HISTORY_FILE)) {
            try {
                const history = JSON.parse(fs.readFileSync(TRADE_HISTORY_FILE, 'utf-8'));
                if (Array.isArray(history) && history.length > 0) {
                    // Sort by timestamp to get chronological order
                    const sortedHistory = [...history].sort((a, b) =>
                        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                    );

                    let peak = walletCapital;
                    let currentBalance = walletCapital;
                    let maxDrop = 0;

                    for (const trade of sortedHistory) {
                        if (trade.pnl !== null && trade.pnl !== undefined) {
                            currentBalance += trade.pnl;
                            if (currentBalance > peak) {
                                peak = currentBalance;
                            }
                            const drop = peak - currentBalance;
                            if (drop > maxDrop) {
                                maxDrop = drop;
                            }
                        }
                    }

                    if (peak > 0) {
                        maxDrawdown = (maxDrop / peak) * 100;
                    }
                }
            } catch (e) {
                console.error("Drawdown calc failed", e);
            }
        }

        return NextResponse.json({
            metrics: {
                totalStrategies,
                distinctStrategies,
                activeLiveStrategies,
                activePaperStrategies,
                openTradesLive,
                openTradesPaper,
                activePositionCapital,
                activePositionCapitalLive,
                activePositionCapitalPaper,
                totalPnL,
                totalPnLLive,
                totalPnLPaper,
                pnlPercentageLive,
                pnlPercentagePaper,
                realizedPnL,
                unrealizedPnL,
                pnlPercentage,
                capitalDeployed,
                totalTrades,
                winRate: winRate,
                walletCapital,
                drawdown: maxDrawdown
            },
            strategies: activeStrategies
        });

    } catch (error: any) {
        console.error("Dashboard data fetch failed:", error);
        return NextResponse.json({ error: "Failed to fetch dashboard data" }, { status: 500 });
    }
}
