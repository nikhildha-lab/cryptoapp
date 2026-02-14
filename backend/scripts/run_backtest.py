"""
Unified Backtest Runner for UI
Routes to correct strategy class based on strategy ID
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import backtrader as bt
import pandas as pd
import ccxt
import json
from typing import Dict, Any

# Import all strategy classes
from strategies.rsi import RSIStrategy
from strategies.NDRTStrategy import NDRTStrategy
from strategies.VolatilityScalper import VolatilityScalper
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

# Strategy ID to Class mapping
STRATEGY_MAP = {
    # New Standard strategies
    'ndrt-strategy': NDRTStrategy,
    'volatility-scalper': VolatilityScalper,
    'triple-confirmation': TripleConfirmationStrategy,
    'trend-momentum': TrendMomentumStrategy,
    'mean-reversion-pro': MeanReversionProStrategy,
    
    # Optimized Combos
    'triple-confirmation-optimized': TripleConfirmationStrategy,
    'trend-momentum-optimized': TrendMomentumStrategy,
    'volatility-breakout-optimized': VolatilityBreakoutStrategy,
    'mean-reversion-pro-optimized': MeanReversionProStrategy,
    'momentum-surge-optimized': MomentumSurgeStrategy,
    'smart-scalper-optimized': SmartScalperStrategy,
    'trend-rider-optimized': TrendRiderStrategy,
    'reversal-hunter-optimized': ReversalHunterStrategy,
    
    # Default to RSI for other strategies
    'default': RSIStrategy
}

def load_dynamic_strategies():
    """Load strategies from backend/strategies/*.py"""
    strategies_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'strategies')
    if not os.path.exists(strategies_dir):
        return

    sys.path.append(strategies_dir)
    
    for filename in os.listdir(strategies_dir):
        if filename.endswith('.py') and not filename.startswith('__'):
            module_name = filename[:-3]
            try:
                import importlib.util
                spec = importlib.util.spec_from_file_location(module_name, os.path.join(strategies_dir, filename))
                if spec and spec.loader:
                    module = importlib.util.module_from_spec(spec)
                    spec.loader.exec_module(module)
                    
                    # Inspect module for Strategy classes
                    for attr_name in dir(module):
                        attr = getattr(module, attr_name)
                        if isinstance(attr, type) and issubclass(attr, bt.Strategy) and attr is not bt.Strategy:
                            # Use the class name or a specific ID if defined
                            # For generated strategies, we usually use the filename as ID base
                            strategy_id = module_name.replace('_', '-').lower()
                            STRATEGY_MAP[strategy_id] = attr
                            # Also map the exact class name
                            STRATEGY_MAP[attr.__name__] = attr
            except Exception as e:
                print(f"Failed to load strategy {filename}: {e}", file=sys.stderr)

# Load dynamic strategies on startup
load_dynamic_strategies()


def fetch_ohlcv(symbol: str, timeframe: str, days: int = 365) -> pd.DataFrame:
    """Fetch OHLCV data from Binance with batch fetching support for long periods"""
    try:
        exchange = ccxt.binance({
            'enableRateLimit': True,
        })
        
        # Calculate since timestamp
        now = exchange.milliseconds()
        duration_ms = days * 24 * 60 * 60 * 1000
        since = now - duration_ms
        
        all_ohlcv = []
        limit = 1000
        
        while since < now:
            ohlcv = exchange.fetch_ohlcv(symbol, timeframe, since=since, limit=limit)
            if not ohlcv:
                break
            all_ohlcv.extend(ohlcv)
            # Move since to the last timestamp + 1ms to avoid overlap
            since = ohlcv[-1][0] + 1
            
            # Safety break if we have enough data or hit a limit
            if len(all_ohlcv) > 20000: # Practical limit for backtrader performance
                break
                
        if not all_ohlcv:
            return pd.DataFrame()
            
        df = pd.DataFrame(all_ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
        df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
        df.set_index('timestamp', inplace=True)
        # Drop duplicates just in case
        df = df[~df.index.duplicated(keep='first')]
        return df.sort_index()
    except Exception as e:
        error_msg = str(e).lower()
        # Handle Binance Geo-Restriction (HTTP 451)
        if '451' in error_msg or 'restricted location' in error_msg:
            print(f"⚠️ Binance restricted in this region. Falling back to Bybit for {symbol}...", file=sys.stderr)
            try:
                # Bybit fallback
                fallback_exchange = ccxt.bybit({'enableRateLimit': True})
                # Bybit uses different symbol format for some pairs, but CCXT handles most
                # We try one more time with Bybit
                ohlcv = fallback_exchange.fetch_ohlcv(symbol, timeframe, limit=1000)
                if ohlcv:
                    df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
                    df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
                    df.set_index('timestamp', inplace=True)
                    return df.sort_index()
            except Exception as fallback_e:
                print(f"❌ Fallback to Bybit also failed: {fallback_e}", file=sys.stderr)
        
        print(f"Error fetching {symbol} {timeframe}: {e}", file=sys.stderr)
        return pd.DataFrame()


def run_backtest(strategy_id: str, symbol: str, timeframe: str, days: int = 365, leverage: int = 1, initial_capital: float = 10000.0, params: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Run backtest for specified strategy
    """
    
    # Get strategy class
    strategy_class = STRATEGY_MAP.get(strategy_id, STRATEGY_MAP['default'])
    
    # Fetch data
    df = fetch_ohlcv(symbol, timeframe, days=days)
    if df.empty:
        return {
            'error': f'Failed to fetch data for {symbol} {timeframe}',
            'pnl': 0,
            'pnl_perc': 0,
            'win_rate': 0,
            'total_trades': 0,
            'sharpe_ratio': 0,
            'max_drawdown': 0
        }
    
    # Initialize Cerebro
    cerebro = bt.Cerebro()
    
    # Add strategy with params if provided
    current_params = params.copy() if params else {}
    current_params['leverage'] = leverage
    cerebro.addstrategy(strategy_class, **current_params)
    
    # Add data
    data = bt.feeds.PandasData(dataname=df)
    cerebro.adddata(data)
    
    # Check if strategy needs BTC reference (Convention: strategy class has 'REQUIRES_BTC' = True)
    if getattr(strategy_class, 'REQUIRES_BTC', False) and symbol != 'BTC/USDT':
        print(f"Fetching BTC/USDT reference data for {strategy_id}...")
        btc_df = fetch_ohlcv('BTC/USDT', timeframe, days=days)
        if not btc_df.empty:
            btc_data = bt.feeds.PandasData(dataname=btc_df, name='BTC')
            cerebro.adddata(btc_data)
        else:
            print("Warning: Could not fetch BTC reference data", file=sys.stderr)
    
    # Set initial capital
    cerebro.broker.setcash(initial_capital)
    
    # Add commission (0.1% = 0.001) and leverage
    cerebro.broker.setcommission(commission=0.001, leverage=leverage)
    
    # Add sizer (Use 95% of available buying power)
    # percents=95 * leverage ensures we use the buying power multiplier
    cerebro.addsizer(bt.sizers.PercentSizer, percents=95 * leverage)
    
    # Add analyzers
    cerebro.addanalyzer(bt.analyzers.SharpeRatio, _name='sharpe')
    cerebro.addanalyzer(bt.analyzers.DrawDown, _name='drawdown')
    cerebro.addanalyzer(bt.analyzers.TradeAnalyzer, _name='trades')
    
    try:
        # Run backtest
        results = cerebro.run()
        strat = results[0]
        
        # Calculate metrics
        final_value = cerebro.broker.getvalue()
        pnl = final_value - initial_capital
        pnl_perc = round((pnl / initial_capital) * 100, 2)
        
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
            'pnl_perc': pnl_perc,
            'sharpe_ratio': sharpe,
            'max_drawdown': max_drawdown,
            'win_rate': win_rate,
            'total_trades': total_trades,
            'won_trades': won_trades,
            'final_value': round(final_value, 2),
            'initial_capital': initial_capital,
            'leverage': leverage,
            'symbol': symbol,
            'timeframe': timeframe,
            'strategy': strategy_id
        }
        
    except Exception as e:
        print(f"Backtest error: {e}", file=sys.stderr)
        return {
            'error': str(e),
            'pnl': 0,
            'win_rate': 0,
            'total_trades': 0,
            'sharpe_ratio': 0,
            'max_drawdown': 0
        }


if __name__ == "__main__":
    # CLI interface for testing
    if len(sys.argv) < 4:
        print("Usage: python run_backtest.py <strategy_id> <symbol> <timeframe> [days]")
        print("Example: python run_backtest.py triple-confirmation-optimized BTC/USDT 1h 365")
        sys.exit(1)
    
    strategy_id = sys.argv[1]
    symbol = sys.argv[2]
    timeframe = sys.argv[3]
    leverage = int(sys.argv[4]) if len(sys.argv) > 4 else 1
    days = int(sys.argv[5]) if len(sys.argv) > 5 else 365
    initial_capital = float(sys.argv[6]) if len(sys.argv) > 6 else 10000.0
    
    result = run_backtest(strategy_id, symbol, timeframe, days=days, leverage=leverage, initial_capital=initial_capital)
    print(json.dumps(result, indent=2))
