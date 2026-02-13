"""
Quick Test Script - Tests a subset of strategies for faster results
Run this first to verify the system before running comprehensive tests
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import backtrader as bt
import pandas as pd
import ccxt
from datetime import datetime
import json
from typing import Dict, List, Any
import time

# Import strategy classes
from strategies.rsi import RSIStrategy
from strategies.combo_strategies import (
    TripleConfirmationStrategy,
    TrendMomentumStrategy,
    VolatilityBreakoutStrategy
)

# Quick test configuration - smaller subset
COINS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT']
TIMEFRAMES = ['1d', '4h', '1h']

STRATEGIES = [
    {'name': '⭐ Triple Confirmation Pro', 'class': TripleConfirmationStrategy, 'category': 'Multi-Indicator'},
    {'name': '⭐ Trend Momentum Elite', 'class': TrendMomentumStrategy, 'category': 'Multi-Indicator'},
    {'name': '⭐ Volatility Breakout Master', 'class': VolatilityBreakoutStrategy, 'category': 'Multi-Indicator'},
]


def fetch_ohlcv(symbol: str, timeframe: str, limit: int = 500) -> pd.DataFrame:
    """Fetch OHLCV data from Binance"""
    try:
        exchange = ccxt.binance()
        ohlcv = exchange.fetch_ohlcv(symbol, timeframe, limit=limit)
        
        if not ohlcv:
            return pd.DataFrame()
            
        df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
        df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
        df.set_index('timestamp', inplace=True)
        return df
    except Exception as e:
        print(f"  ❌ Error fetching {symbol} {timeframe}: {e}")
        return pd.DataFrame()


def calculate_rating(metrics: Dict[str, float]) -> str:
    """Calculate letter grade based on performance metrics"""
    win_rate = metrics.get('win_rate', 0)
    sharpe = metrics.get('sharpe_ratio', 0)
    pnl = metrics.get('pnl', 0)
    max_dd = metrics.get('max_drawdown', 100)
    trades = metrics.get('total_trades', 0)
    
    if (win_rate >= 60 and sharpe >= 2.0 and pnl >= 20000 and max_dd < 15 and trades >= 15):
        return 'A+'
    if (win_rate >= 55 and sharpe >= 1.5 and pnl >= 15000 and max_dd < 20 and trades >= 12):
        return 'A'
    if (win_rate >= 50 and sharpe >= 1.0 and pnl >= 10000 and max_dd < 25 and trades >= 10):
        return 'B'
    if (win_rate >= 45 and sharpe >= 0.5 and pnl >= 5000 and max_dd < 30 and trades >= 8):
        return 'C'
    if (win_rate >= 40 and sharpe >= 0.0 and pnl >= 0 and trades >= 5):
        return 'D'
    return 'F'


def run_backtest(strategy_class, symbol: str, timeframe: str) -> Dict[str, Any]:
    """Run a single backtest"""
    cerebro = bt.Cerebro()
    cerebro.addstrategy(strategy_class)
    
    df = fetch_ohlcv(symbol, timeframe)
    if df.empty:
        return None
    
    data = bt.feeds.PandasData(dataname=df)
    cerebro.adddata(data)
    cerebro.broker.setcash(100000.0)
    
    cerebro.addanalyzer(bt.analyzers.SharpeRatio, _name='sharpe')
    cerebro.addanalyzer(bt.analyzers.DrawDown, _name='drawdown')
    cerebro.addanalyzer(bt.analyzers.TradeAnalyzer, _name='trades')
    
    try:
        results = cerebro.run()
        strat = results[0]
        
        final_value = cerebro.broker.getvalue()
        pnl = final_value - 100000.0
        
        try:
            sharpe = round(strat.analyzers.sharpe.get_analysis().get('sharperatio', 0) or 0, 2)
        except:
            sharpe = 0
            
        try:
            drawdown_info = strat.analyzers.drawdown.get_analysis()
            max_drawdown = round(drawdown_info.get('max', {}).get('drawdown', 0), 2)
        except:
            max_drawdown = 0.0
            
        try:
            trade_analysis = strat.analyzers.trades.get_analysis()
            total_trades = trade_analysis.get('total', {}).get('total', 0)
            won_trades = trade_analysis.get('won', {}).get('total', 0)
            win_rate = round((won_trades / total_trades * 100), 1) if total_trades > 0 else 0.0
        except:
            total_trades = 0
            won_trades = 0
            win_rate = 0.0
        
        metrics = {
            'pnl': round(pnl, 2),
            'sharpe_ratio': sharpe,
            'max_drawdown': max_drawdown,
            'win_rate': win_rate,
            'total_trades': total_trades,
            'won_trades': won_trades,
            'final_value': round(final_value, 2)
        }
        
        metrics['rating'] = calculate_rating(metrics)
        return metrics
    except Exception as e:
        print(f"  ❌ Backtest error: {e}")
        return None


def run_quick_tests():
    """Run quick tests on a subset"""
    
    print("=" * 80)
    print("QUICK STRATEGY TEST")
    print("=" * 80)
    print(f"Strategies: {len(STRATEGIES)}")
    print(f"Coins: {len(COINS)}")
    print(f"Timeframes: {len(TIMEFRAMES)}")
    print(f"Total Tests: {len(STRATEGIES) * len(COINS) * len(TIMEFRAMES)}")
    print("=" * 80)
    print()
    
    all_results = []
    test_count = 0
    total_tests = len(STRATEGIES) * len(COINS) * len(TIMEFRAMES)
    
    start_time = time.time()
    
    for strategy_def in STRATEGIES:
        strategy_name = strategy_def['name']
        strategy_class = strategy_def['class']
        category = strategy_def['category']
        
        print(f"\n{'=' * 80}")
        print(f"TESTING: {strategy_name}")
        print(f"{'=' * 80}")
        
        for coin in COINS:
            for timeframe in TIMEFRAMES:
                test_count += 1
                progress = (test_count / total_tests) * 100
                
                print(f"\n[{test_count}/{total_tests}] ({progress:.1f}%) {coin} | {timeframe}")
                print("-" * 60)
                
                result = run_backtest(strategy_class, coin, timeframe)
                
                if result:
                    result.update({
                        'strategy': strategy_name,
                        'category': category,
                        'symbol': coin,
                        'timeframe': timeframe
                    })
                    
                    all_results.append(result)
                    
                    print(f"  Rating: {result['rating']}")
                    print(f"  PnL: ${result['pnl']:,.2f}")
                    print(f"  Win Rate: {result['win_rate']}%")
                    print(f"  Sharpe: {result['sharpe_ratio']}")
                    print(f"  Trades: {result['total_trades']}")
                    
                    if result['rating'] in ['A+', 'A']:
                        print(f"  ⭐ {result['rating']} GRADE!")
                
                time.sleep(0.1)
    
    elapsed_time = time.time() - start_time
    
    # Save results
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    json_file = f'quick_test_results_{timestamp}.json'
    
    with open(json_file, 'w') as f:
        json.dump(all_results, f, indent=2)
    
    # Summary
    print(f"\n{'=' * 80}")
    print("QUICK TEST COMPLETE")
    print(f"{'=' * 80}")
    print(f"Tests Run: {len(all_results)}")
    print(f"Time: {elapsed_time:.1f} seconds")
    print(f"Results: {json_file}")
    
    ratings = [r['rating'] for r in all_results]
    print(f"\nRating Distribution:")
    print(f"  A+: {ratings.count('A+')}")
    print(f"  A:  {ratings.count('A')}")
    print(f"  B:  {ratings.count('B')}")
    print(f"  C:  {ratings.count('C')}")
    print(f"  D:  {ratings.count('D')}")
    print(f"  F:  {ratings.count('F')}")
    
    # Top performers
    top_5 = sorted(all_results, key=lambda x: x['pnl'], reverse=True)[:5]
    print(f"\nTop 5 Performers:")
    for i, r in enumerate(top_5, 1):
        print(f"{i}. {r['strategy']} | {r['symbol']} | {r['timeframe']}")
        print(f"   Rating: {r['rating']} | PnL: ${r['pnl']:,.2f} | WR: {r['win_rate']}%")
    
    return all_results


if __name__ == "__main__":
    print("\n🚀 Starting Quick Strategy Test...")
    print("⏱️  This will take approximately 2-3 minutes...\n")
    
    results = run_quick_tests()
    
    print(f"\n✅ Quick test complete!")
    print(f"💡 To run comprehensive tests (3,200 backtests), use: python3 comprehensive_test.py")
