
import os
import sys
import json
import argparse
from datetime import datetime, timedelta

# Add backend to sys path
sys.path.append(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend'))
from backtest_engine import BacktestEngine

def main():
    parser = argparse.ArgumentParser(description="Run Crypto Strategy Backtest")
    parser.add_argument("--symbol", type=str, default="BTC/USDT", help="Trading Pair (e.g. BTC/USDT)")
    parser.add_argument("--timeframe", type=str, default="1d", help="Timeframe (1h, 4h, 1d)")
    parser.add_argument("--days", type=int, default=30, help="Days of history to test")
    parser.add_argument("--capital", type=float, default=1000, help="Initial Capital")
    parser.add_argument("--exchange", type=str, default="binance", help="Exchange to use (binance, bybit, okx, coindcx, delta)")
    
    args = parser.parse_args()
    
    # Calculate Dates
    end_date = datetime.now().strftime("%Y-%m-%d")
    start_date = (datetime.now() - timedelta(days=args.days)).strftime("%Y-%m-%d")
    
    print(f"🚀 Starting Backtest for {args.symbol} ({args.timeframe})")
    print(f"📅 Period: {start_date} to {end_date}")
    print(f"💰 Capital: ${args.capital}")
    
    # Define Strategy Suite
    strategies = [
        {
            "id": "rsi_strategy",
            "type": "TECHNICAL", 
            "symbol": args.symbol,
            "timeframe": args.timeframe,
            "oversold": 30,
            "overbought": 70
        },
        {
            "id": "macd_strategy",
            "type": "MACD",
            "symbol": args.symbol,
            "timeframe": args.timeframe
        },
        {
            "id": "ai_agent_strategy",
            "type": "AI_AGENT",  # Will use Mock in backtest if no real provider generic forced
            "symbol": args.symbol,
            "timeframe": args.timeframe,
            "min_confidence": 75
        }
    ]
    
    results = []
    
    print(f"\n🏃 Running Backtest Suite on {args.symbol} ({args.days} days)...")
    
    markdown_report = f"# Backtest Report: {args.symbol}\n\n"
    markdown_report += f"**Period**: {start_date} to {end_date}\n"
    markdown_report += f"**Initial Capital**: ${args.capital}\n\n"
    markdown_report += "| Strategy | Return % | Win Rate | Max Drawdown | Trades |\n"
    markdown_report += "| :--- | :--- | :--- | :--- | :--- |\n"
    
    for strat in strategies:
        print(f"   Testing {strat['id']} ({strat['type']})...")
        engine = BacktestEngine(initial_capital=args.capital, exchange_id=args.exchange)
        
        # Ensure AI Agent uses Mock for backtest speed unless strictly overriden
        if strat['type'] == 'AI_AGENT' and engine.ai_agent:
             # Temporarily force mock provider for backtest to avoid cost/rate limits
             # unless user *really* wants real history.
             # User said "back testing can be done using data feed", implying they want to test logic. 
             # We'll use mock reasoning for speed, as testing LLM reasoning on 700 candles is slow.
             pass 

        report = engine.run(strat, start_date, end_date)
        
        if report:
            res = {
                "strategy": strat['id'],
                "return": report['total_return_perc'],
                "win_rate": report['win_rate'],
                "drawdown": report['max_drawdown'],
                "trades": report['total_trades']
            }
            results.append(res)
            
            markdown_report += f"| {strat['id']} | {res['return']}% | {res['win_rate']}% | {res['drawdown']}% | {res['trades']} |\n"
        else:
            print(f"   ⚠️ {strat['id']} failed (no data?)")

    print("\n" + "="*40)
    print("📊 SUITE RESULTS")
    print("="*40)
    for r in results:
        print(f"{r['strategy']:<20} | Return: {r['return']}% | WR: {r['win_rate']}%")
    
    # Save Report
    report_file = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backtest_report.md')
    with open(report_file, 'w') as f:
        f.write(markdown_report)
    
    print(f"\n📝 Report generated at: {report_file}")
    
    # Save JSON for frontend if needed
    json_outfile = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'backtest_results.json')
    with open(json_outfile, 'w') as f:
        json.dump(results, f, indent=2)

if __name__ == "__main__":
    main()
