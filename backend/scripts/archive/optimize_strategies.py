"""
Strategy Optimization Script
Systematically tests combo strategies with different parameters
to find the best performing combinations
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import backtrader as bt
import pandas as pd
import ccxt
from datetime import datetime
import json
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


def fetch_ohlcv(symbol, timeframe, limit=500):
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
        print(f"Error fetching data: {e}")
        return pd.DataFrame()


def run_backtest(strategy_class, symbol, timeframe, params=None):
    """Run a single backtest with given parameters"""
    cerebro = bt.Cerebro()
    
    # Add strategy with params if provided
    if params:
        cerebro.addstrategy(strategy_class, **params)
    else:
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
        
        return {
            'pnl': round(pnl, 2),
            'sharpe_ratio': sharpe,
            'max_drawdown': max_drawdown,
            'win_rate': win_rate,
            'total_trades': total_trades,
            'won_trades': won_trades,
            'final_value': round(final_value, 2)
        }
    except Exception as e:
        print(f"Backtest error: {e}")
        return None


def optimize_strategies():
    """Run systematic optimization on all combo strategies"""
    
    # Define test matrix
    strategies = [
        ('Triple Confirmation', TripleConfirmationStrategy),
        ('Trend Momentum', TrendMomentumStrategy),
        ('Volatility Breakout', VolatilityBreakoutStrategy),
        ('Mean Reversion Pro', MeanReversionProStrategy),
        ('Momentum Surge', MomentumSurgeStrategy),
        ('Smart Scalper', SmartScalperStrategy),
        ('Trend Rider', TrendRiderStrategy),
        ('Reversal Hunter', ReversalHunterStrategy),
    ]
    
    symbols = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT']
    timeframes = ['15m', '1h', '4h']
    
    results = []
    
    print("=" * 80)
    print("STRATEGY OPTIMIZATION - SYSTEMATIC BACKTESTING")
    print("=" * 80)
    print(f"Testing {len(strategies)} strategies across {len(symbols)} symbols and {len(timeframes)} timeframes")
    print(f"Total tests: {len(strategies) * len(symbols) * len(timeframes)}")
    print("=" * 80)
    print()
    
    test_count = 0
    
    for strategy_name, strategy_class in strategies:
        print(f"\n{'=' * 80}")
        print(f"TESTING: {strategy_name}")
        print(f"{'=' * 80}")
        
        for symbol in symbols:
            for timeframe in timeframes:
                test_count += 1
                print(f"\n[{test_count}] {strategy_name} | {symbol} | {timeframe}")
                print("-" * 60)
                
                result = run_backtest(strategy_class, symbol, timeframe)
                
                if result:
                    result.update({
                        'strategy': strategy_name,
                        'symbol': symbol,
                        'timeframe': timeframe
                    })
                    results.append(result)
                    
                    # Print results
                    print(f"  PnL: ${result['pnl']:,.2f}")
                    print(f"  Win Rate: {result['win_rate']}%")
                    print(f"  Sharpe: {result['sharpe_ratio']}")
                    print(f"  Max DD: {result['max_drawdown']}%")
                    print(f"  Trades: {result['total_trades']}")
                    
                    # Highlight winners
                    if result['win_rate'] >= 45 and result['sharpe_ratio'] >= 1.0 and result['pnl'] >= 5000:
                        print(f"  ⭐ WINNER! Meets all criteria")
                else:
                    print(f"  ❌ Failed to run backtest")
    
    # Save results
    df_results = pd.DataFrame(results)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    output_file = f'optimization_results_{timestamp}.csv'
    df_results.to_csv(output_file, index=False)
    
    print(f"\n{'=' * 80}")
    print("OPTIMIZATION COMPLETE")
    print(f"{'=' * 80}")
    print(f"Results saved to: {output_file}")
    print(f"Total tests run: {len(results)}")
    
    # Find top performers
    print(f"\n{'=' * 80}")
    print("TOP 10 PERFORMERS (by PnL)")
    print(f"{'=' * 80}")
    
    top_10 = df_results.nlargest(10, 'pnl')
    for idx, row in top_10.iterrows():
        print(f"\n{row['strategy']} | {row['symbol']} | {row['timeframe']}")
        print(f"  PnL: ${row['pnl']:,.2f} | Win Rate: {row['win_rate']}% | Sharpe: {row['sharpe_ratio']} | Trades: {row['total_trades']}")
    
    # Find high win-rate strategies
    print(f"\n{'=' * 80}")
    print("HIGH WIN-RATE STRATEGIES (>50%)")
    print(f"{'=' * 80}")
    
    high_wr = df_results[df_results['win_rate'] >= 50].sort_values('win_rate', ascending=False)
    for idx, row in high_wr.iterrows():
        print(f"\n{row['strategy']} | {row['symbol']} | {row['timeframe']}")
        print(f"  Win Rate: {row['win_rate']}% | PnL: ${row['pnl']:,.2f} | Sharpe: {row['sharpe_ratio']} | Trades: {row['total_trades']}")
    
    # Find best Sharpe ratios
    print(f"\n{'=' * 80}")
    print("BEST SHARPE RATIOS (>1.0)")
    print(f"{'=' * 80}")
    
    high_sharpe = df_results[df_results['sharpe_ratio'] >= 1.0].sort_values('sharpe_ratio', ascending=False)
    for idx, row in high_sharpe.iterrows():
        print(f"\n{row['strategy']} | {row['symbol']} | {row['timeframe']}")
        print(f"  Sharpe: {row['sharpe_ratio']} | PnL: ${row['pnl']:,.2f} | Win Rate: {row['win_rate']}% | Trades: {row['total_trades']}")
    
    # Find strategies meeting all criteria
    print(f"\n{'=' * 80}")
    print("⭐ WINNERS - MEETING ALL CRITERIA")
    print("(Win Rate >= 45%, Sharpe >= 1.0, PnL >= $5,000)")
    print(f"{'=' * 80}")
    
    winners = df_results[
        (df_results['win_rate'] >= 45) &
        (df_results['sharpe_ratio'] >= 1.0) &
        (df_results['pnl'] >= 5000)
    ].sort_values('pnl', ascending=False)
    
    if len(winners) > 0:
        for idx, row in winners.iterrows():
            print(f"\n⭐ {row['strategy']} | {row['symbol']} | {row['timeframe']}")
            print(f"  PnL: ${row['pnl']:,.2f}")
            print(f"  Win Rate: {row['win_rate']}%")
            print(f"  Sharpe: {row['sharpe_ratio']}")
            print(f"  Max DD: {row['max_drawdown']}%")
            print(f"  Trades: {row['total_trades']}")
        
        # Save winners to JSON for easy UI integration
        winners_json = winners.to_dict('records')
        with open(f'winning_strategies_{timestamp}.json', 'w') as f:
            json.dump(winners_json, f, indent=2)
        print(f"\n✅ Winning strategies saved to: winning_strategies_{timestamp}.json")
    else:
        print("\n❌ No strategies met all criteria. Consider adjusting thresholds or parameters.")
    
    return df_results


if __name__ == "__main__":
    print("\n🚀 Starting Strategy Optimization...")
    print("This will take several minutes...\n")
    
    results = optimize_strategies()
    
    print("\n✅ Optimization complete!")
    print(f"📊 Analyzed {len(results)} strategy combinations")
