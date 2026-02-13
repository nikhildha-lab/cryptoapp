
import sys
import os
import pandas as pd
import numpy as np
from datetime import datetime

# Add parent to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backtest_engine import BacktestEngine

def run_verification():
    print("="*60)
    print("🔍 VERIFYING ADVANCED EXIT STRATEGIES")
    print("="*60)

    engine = BacktestEngine(initial_capital=1000)
    
    # Generate mock data (a steady uptrend with some pullbacks)
    dates = pd.date_range(start="2024-01-01", periods=100, freq='h')
    price = 1000
    prices = []
    for i in range(100):
        # Mostly up, occasional 2% dips
        change = np.random.normal(0.01, 0.005) 
        if i % 10 == 0: change = -0.02 # Pullback
        price *= (1 + change)
        prices.append(price)
    
    df = pd.DataFrame({
        'timestamp': dates,
        'open': prices,
        'high': [p * 1.01 for p in prices],
        'low': [p * 0.99 for p in prices],
        'close': prices,
        'volume': [1000] * 100
    })

    # 1. Baseline: Static SL (2%) and TP (5%)
    strategy_static = {
        'strategyId': 'test-strat',
        'symbol': 'BTC/USDT',
        'timeframe': '1h',
        'stop_loss': 0.02,
        'take_profit': 0.05,
        'trailing_sl_perc': 0,
        'tp_extension_factor': 0
    }

    # 2. Optimized: Trailing SL (1.5%) and TP Extension (2%)
    strategy_advanced = {
        'strategyId': 'test-strat',
        'symbol': 'BTC/USDT',
        'timeframe': '1h',
        'stop_loss': 0.02,
        'take_profit': 0.05,
        'trailing_sl_perc': 0.015,
        'tp_extension_factor': 0.02
    }

    print("\n--- Running Static Exit Backtest ---")
    engine.balance = 1000
    engine.position = None
    engine.trades = []
    # Force a BUY signal at start
    engine._process_signal("BUY", prices[0], dates[0], strategy_static)
    
    for i in range(1, len(df)):
        row = df.iloc[i]
        engine._check_sl_tp(row, strategy_static)
        # Track Equity
        curr_eq = engine.balance
        if engine.position:
            curr_eq += engine.position['amount'] * row['close']
        engine.equity_curve.append({'timestamp': row['timestamp'], 'equity': curr_eq})
    
    res_static = engine._generate_report()
    print(f"Static Return: {res_static['total_return_perc']}%")
    print(f"Num Trades: {res_static['total_trades']}")

    print("\n--- Running Advanced Exit Backtest ---")
    engine.balance = 1000
    engine.position = None
    engine.trades = []
    engine.equity_curve = []
    # Force a BUY signal at start
    engine._process_signal("BUY", prices[0], dates[0], strategy_advanced)
    
    for i in range(1, len(df)):
        row = df.iloc[i]
        engine._check_sl_tp(row, strategy_advanced)
        # Track Equity
        curr_eq = engine.balance
        if engine.position:
            curr_eq += engine.position['amount'] * row['close']
        engine.equity_curve.append({'timestamp': row['timestamp'], 'equity': curr_eq})
    
    res_advanced = engine._generate_report()
    print(f"Advanced Return: {res_advanced['total_return_perc']}%")
    print(f"Num Trades: {res_advanced['total_trades']}")

    diff = res_advanced['total_return_perc'] - res_static['total_return_perc']
    print("\n" + "="*60)
    if diff > 0:
        print(f"✅ SUCCESS: Advanced Exit captured {diff:.2f}% more profit!")
    else:
        print(f"ℹ️ Results similar on this mock data. Diff: {diff:.2f}%")
    print("="*60)

if __name__ == "__main__":
    run_verification()
