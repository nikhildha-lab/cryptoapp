
import os
import sys
import json
from datetime import datetime, timedelta

# Add backend to sys path
sys.path.append(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend'))
from backtest_engine import BacktestEngine

def main():
    print("🚀 Verifying Advanced Strategy Logic...")
    
    # Define Advanced Strategies
    strategies = [
        {
            "id": "triple-confirmation",
            "type": "TECHNICAL",
            "symbol": "BTC/USDT",
            "timeframe": "1h",
            "rsi_oversold": 80, # Aggressive to force BUY
            "rsi_overbought": 20,
            "volume_multiplier": 0.5 # Low barrier
        },
        {
            "id": "volatility-scalper",
            "type": "TECHNICAL", 
            "symbol": "BTC/USDT", 
            "timeframe": "15m", # Faster timeframe
            "fast_ema": 5,
            "slow_ema": 10,
            "vol_multiplier": 0.5
        },
        {
            "id": "ndrt-strategy",
            "type": "TECHNICAL",
            "symbol": "BTC/USDT",
            "timeframe": "15m" # Fractals more likely
        }
    ]
    
    engine = BacktestEngine(initial_capital=10000, exchange_id='binance')
    
    # Run short backtest (7 days)
    end_date = datetime.now().strftime("%Y-%m-%d")
    start_date = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
    
    for strat in strategies:
        print(f"\n🧪 Testing {strat['id']}...")
        report = engine.run(strat, start_date, end_date)
        
        if report:
            print(f"   ✅ Completed. Return: {report['total_return_perc']}%. Trades: {report['total_trades']}")
            if report['total_trades'] > 0:
                print(f"      Last Trade: {report['trades'][-1]['side']} @ {report['trades'][-1]['price']}")
        else:
            print("   ❌ Failed (No Data or Error)")

if __name__ == "__main__":
    main()
