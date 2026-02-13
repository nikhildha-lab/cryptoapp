
import os
import sys
import json
from datetime import datetime, timedelta

# Add backend to sys path
sys.path.append(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend'))
from backtest_engine import BacktestEngine

def run_ai_test():
    coins = ["BTC/USDT"]
    timeframe = "4h"
    days = 365
    capital = 10000
    
    # Calculate Dates
    start_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
    end_date = datetime.now().strftime("%Y-%m-%d")
    
    print(f"🤖 TESTING AI AGENT LOGIC (OPTIMIZED MODE)")
    print(f"   Timeframe: {timeframe} | Period: {days} Days ({start_date} -> {end_date})")
    print(f"   Leverage: 5x | Strategy: Trend Rider (Momentum)")
    
    for symbol in coins:
        print(f"\n🔹 TESTING {symbol}...")
        
        # Define Strategy
        strategy_config = {
            "id": "ai-agent-pro",
            "type": "AI_AGENT",
            "symbol": symbol,
            "timeframe": timeframe,
            "min_confidence": 75,
            "leverage": 5
            # No fixed SL/TP - Trend Exit
        }
        
        # Initialize Engine (Force Backtest Mode is handled in Engine init now)
        try:
            engine = BacktestEngine(initial_capital=capital, exchange_id='binance')
        except Exception as e:
            print(f"Failed to init engine: {e}")
            return

        report = engine.run(strategy_config, start_date, end_date)
        
        if report:
            print(f"   💰 End Equity: ${report['final_equity']:,.2f} | Return: {report['total_return_perc']}% | WR: {report['win_rate']}% | Trades: {report['total_trades']}")
        else:
            print("   ❌ Backtest failed (No Data)")

if __name__ == "__main__":
    run_ai_test()
