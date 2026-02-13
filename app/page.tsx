"use client";

import {
  useDashboardMetrics,
  PnLCard,
  ActiveStrategiesCard,
  PerformanceCard,
  WalletCard
} from "@/components/dashboard/MetricsHeader";
import { ActiveTradesGrid } from "@/components/dashboard/ActiveTradesGrid";
import { MarketSentiment } from "@/components/dashboard/MarketSentiment";
import { AgentLog } from "@/components/dashboard/AgentLog";
import { Separator } from "@/components/ui/separator";

export default function Home() {
  const { metrics, isRefreshing, fetchMetrics } = useDashboardMetrics();

  return (
    <div className="max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 py-4 w-full space-y-8">
      {/* 1. Intelligence Row - Market Sentiment (Now at Top) */}
      <div className="w-full">
        <MarketSentiment />
      </div>

      {/* 2. Primary Metrics Row - Unified Financial View */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <PnLCard metrics={metrics} />
        <ActiveStrategiesCard metrics={metrics} />
        <WalletCard metrics={metrics} isRefreshing={isRefreshing} onRefresh={() => fetchMetrics(true)} />
        <PerformanceCard metrics={metrics} />
      </div>

      {/* 2. Operational Sections */}
      <div className="space-y-8">
        {/* Active Trades Table */}
        <div className="w-full">
          <ActiveTradesGrid />
        </div>

        {/* System Logs */}
        <div className="w-full">
          <AgentLog />
        </div>
      </div>
    </div>
  );
}
