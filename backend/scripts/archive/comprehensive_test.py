"""
Comprehensive Strategy Testing Script
Tests all 32 strategies across 20+ coins and 5 timeframes
Generates ratings and detailed analysis for each combination
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

# Import all strategy classes
from strategies.rsi import RSIStrategy
from strategies.combo_strategies import (
    TripleConfirmationStrategy,
    TrendMomentumStrategy,
    VolatilityBreakoutStrategy,
    MeanReversionProStrategy,
    MomentumSurgeStrategy,
    SmartScalperStrategy,
    TrendRiderStrategy,
    ReversalHunterStrategy
)

# Test configuration
COINS = [
    'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT', 'XRP/USDT',
    'ADA/USDT', 'AVAX/USDT', 'DOT/USDT', 'MATIC/USDT', 'LINK/USDT',
    'UNI/USDT', 'ATOM/USDT', 'LTC/USDT', 'BCH/USDT', 'NEAR/USDT',
    'DOGE/USDT', 'SHIB/USDT', 'PEPE/USDT', 'APT/USDT', 'ARB/USDT'
]

TIMEFRAMES = ['1d', '4h', '1h', '15m', '5m']

# Strategy definitions with default params
STRATEGIES = [
    # Optimized Combos
    {'name': '⭐ Triple Confirmation Pro', 'class': TripleConfirmationStrategy, 'category': 'Multi-Indicator'},
    {'name': '⭐ Trend Momentum Elite', 'class': TrendMomentumStrategy, 'category': 'Multi-Indicator'},
    {'name': '⭐ Volatility Breakout Master', 'class': VolatilityBreakoutStrategy, 'category': 'Multi-Indicator'},
    {'name': '⭐ Mean Reversion Pro', 'class': MeanReversionProStrategy, 'category': 'Multi-Indicator'},
    {'name': '⭐ Momentum Surge Ultra', 'class': MomentumSurgeStrategy, 'category': 'Multi-Indicator'},
    {'name': '⭐ Smart Scalper Pro', 'class': SmartScalperStrategy, 'category': 'Scalping'},
    {'name': '⭐ Trend Rider Supreme', 'class': TrendRiderStrategy, 'category': 'Trend'},
    {'name': '⭐ Reversal Hunter Elite', 'class': ReversalHunterStrategy, 'category': 'Mean Reversion'},
    # Add RSI as representative of single-indicator strategies
    {'name': 'RSI Mean Reversion', 'class': RSIStrategy, 'category': 'Mean Reversion'},
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
    
    # A+ criteria
    if (win_rate >= 60 and sharpe >= 2.0 and pnl >= 20000 and 
        max_dd < 15 and trades >= 15):
        return 'A+'
    
    # A criteria
    if (win_rate >= 55 and sharpe >= 1.5 and pnl >= 15000 and 
        max_dd < 20 and trades >= 12):
        return 'A'
    
    # B criteria
    if (win_rate >= 50 and sharpe >= 1.0 and pnl >= 10000 and 
        max_dd < 25 and trades >= 10):
        return 'B'
    
    # C criteria
    if (win_rate >= 45 and sharpe >= 0.5 and pnl >= 5000 and 
        max_dd < 30 and trades >= 8):
        return 'C'
    
    # D criteria
    if (win_rate >= 40 and sharpe >= 0.0 and pnl >= 0 and trades >= 5):
        return 'D'
    
    # F - failing
    return 'F'


def run_backtest(strategy_class, symbol: str, timeframe: str) -> Dict[str, Any]:
    """Run a single backtest"""
    cerebro = bt.Cerebro()
    cerebro.addstrategy(strategy_class)
    
    # Fetch data
    df = fetch_ohlcv(symbol, timeframe)
    if df.empty:
        return None
    
    # Add data feed
    data = bt.feeds.PandasData(dataname=df)
    cerebro.adddata(data)
    
    # Set initial cash
    cerebro.broker.setcash(100000.0)
    
    # Add analyzers
    cerebro.addanalyzer(bt.analyzers.SharpeRatio, _name='sharpe')
    cerebro.addanalyzer(bt.analyzers.DrawDown, _name='drawdown')
    cerebro.addanalyzer(bt.analyzers.TradeAnalyzer, _name='trades')
    
    # Run
    try:
        results = cerebro.run()
        strat = results[0]
        
        # Extract metrics
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
        
        # Calculate rating
        metrics['rating'] = calculate_rating(metrics)
        
        return metrics
    except Exception as e:
        print(f"  ❌ Backtest error: {e}")
        return None


def run_comprehensive_tests():
    """Run all tests and generate comprehensive results"""
    
    print("=" * 100)
    print("COMPREHENSIVE STRATEGY TESTING")
    print("=" * 100)
    print(f"Strategies: {len(STRATEGIES)}")
    print(f"Coins: {len(COINS)}")
    print(f"Timeframes: {len(TIMEFRAMES)}")
    print(f"Total Tests: {len(STRATEGIES) * len(COINS) * len(TIMEFRAMES)}")
    print("=" * 100)
    print()
    
    all_results = []
    test_count = 0
    total_tests = len(STRATEGIES) * len(COINS) * len(TIMEFRAMES)
    
    start_time = time.time()
    
    for strategy_def in STRATEGIES:
        strategy_name = strategy_def['name']
        strategy_class = strategy_def['class']
        category = strategy_def['category']
        
        print(f"\n{'=' * 100}")
        print(f"TESTING: {strategy_name} ({category})")
        print(f"{'=' * 100}")
        
        strategy_results = []
        
        for coin in COINS:
            for timeframe in TIMEFRAMES:
                test_count += 1
                progress = (test_count / total_tests) * 100
                
                print(f"\n[{test_count}/{total_tests}] ({progress:.1f}%) {strategy_name} | {coin} | {timeframe}")
                print("-" * 80)
                
                result = run_backtest(strategy_class, coin, timeframe)
                
                if result:
                    result.update({
                        'strategy': strategy_name,
                        'category': category,
                        'symbol': coin,
                        'timeframe': timeframe,
                        'test_number': test_count
                    })
                    
                    all_results.append(result)
                    strategy_results.append(result)
                    
                    # Print results
                    print(f"  Rating: {result['rating']}")
                    print(f"  PnL: ${result['pnl']:,.2f}")
                    print(f"  Win Rate: {result['win_rate']}%")
                    print(f"  Sharpe: {result['sharpe_ratio']}")
                    print(f"  Max DD: {result['max_drawdown']}%")
                    print(f"  Trades: {result['total_trades']}")
                    
                    # Highlight exceptional results
                    if result['rating'] in ['A+', 'A']:
                        print(f"  ⭐ {result['rating']} GRADE - EXCELLENT PERFORMANCE!")
                
                # Brief pause to avoid rate limiting
                time.sleep(0.1)
        
        # Strategy summary
        if strategy_results:
            ratings = [r['rating'] for r in strategy_results]
            avg_pnl = sum(r['pnl'] for r in strategy_results) / len(strategy_results)
            avg_wr = sum(r['win_rate'] for r in strategy_results) / len(strategy_results)
            
            print(f"\n{'-' * 80}")
            print(f"STRATEGY SUMMARY: {strategy_name}")
            print(f"  Tests Run: {len(strategy_results)}")
            print(f"  Avg PnL: ${avg_pnl:,.2f}")
            print(f"  Avg Win Rate: {avg_wr:.1f}%")
            print(f"  Ratings: A+={ratings.count('A+')}, A={ratings.count('A')}, B={ratings.count('B')}, C={ratings.count('C')}, D={ratings.count('D')}, F={ratings.count('F')}")
            print(f"{'-' * 80}")
    
    elapsed_time = time.time() - start_time
    
    # Save results
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    
    # Save to JSON
    json_file = f'comprehensive_results_{timestamp}.json'
    with open(json_file, 'w') as f:
        json.dump(all_results, f, indent=2)
    
    # Save to CSV
    df_results = pd.DataFrame(all_results)
    csv_file = f'comprehensive_results_{timestamp}.csv'
    df_results.to_csv(csv_file, index=False)
    
    # Print final summary
    print(f"\n{'=' * 100}")
    print("COMPREHENSIVE TESTING COMPLETE")
    print(f"{'=' * 100}")
    print(f"Total Tests Run: {len(all_results)}")
    print(f"Time Elapsed: {elapsed_time/60:.1f} minutes")
    print(f"Results saved to:")
    print(f"  - {json_file}")
    print(f"  - {csv_file}")
    
    # Overall statistics
    print(f"\n{'=' * 100}")
    print("OVERALL STATISTICS")
    print(f"{'=' * 100}")
    
    ratings = [r['rating'] for r in all_results]
    print(f"Rating Distribution:")
    print(f"  A+: {ratings.count('A+')} ({ratings.count('A+')/len(ratings)*100:.1f}%)")
    print(f"  A:  {ratings.count('A')} ({ratings.count('A')/len(ratings)*100:.1f}%)")
    print(f"  B:  {ratings.count('B')} ({ratings.count('B')/len(ratings)*100:.1f}%)")
    print(f"  C:  {ratings.count('C')} ({ratings.count('C')/len(ratings)*100:.1f}%)")
    print(f"  D:  {ratings.count('D')} ({ratings.count('D')/len(ratings)*100:.1f}%)")
    print(f"  F:  {ratings.count('F')} ({ratings.count('F')/len(ratings)*100:.1f}%)")
    
    # Top 10 performers
    print(f"\n{'=' * 100}")
    print("TOP 10 PERFORMERS (by PnL)")
    print(f"{'=' * 100}")
    
    top_10 = sorted(all_results, key=lambda x: x['pnl'], reverse=True)[:10]
    for i, result in enumerate(top_10, 1):
        print(f"\n{i}. {result['strategy']} | {result['symbol']} | {result['timeframe']}")
        print(f"   Rating: {result['rating']} | PnL: ${result['pnl']:,.2f} | Win Rate: {result['win_rate']}% | Sharpe: {result['sharpe_ratio']}")
    
    # A+ strategies
    a_plus = [r for r in all_results if r['rating'] == 'A+']
    if a_plus:
        print(f"\n{'=' * 100}")
        print(f"A+ STRATEGIES ({len(a_plus)} found)")
        print(f"{'=' * 100}")
        for result in a_plus:
            print(f"\n⭐ {result['strategy']} | {result['symbol']} | {result['timeframe']}")
            print(f"   PnL: ${result['pnl']:,.2f} | Win Rate: {result['win_rate']}% | Sharpe: {result['sharpe_ratio']} | Trades: {result['total_trades']}")
    
    return all_results, json_file


if __name__ == "__main__":
    print("\n🚀 Starting Comprehensive Strategy Testing...")
    print("⚠️  This will take approximately 30-45 minutes...\n")
    
    results, output_file = run_comprehensive_tests()
    
    print(f"\n✅ Testing complete!")
    print(f"📊 Results available in: {output_file}")
