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

class TradeList(bt.Analyzer):
    def get_analysis(self):
        return self.trades

    def __init__(self):
        self.trades = []
        self.cum_pnl = 0.0

    def notify_trade(self, trade):
        if trade.isclosed:
            # 1. Determine Size & Direction
            size = trade.size
            # Fallback if size is 0 (common in closed trades if not accessed via history)
            if size == 0 and len(trade.history) > 0:
                 size = trade.history[0].event.size

            is_long = size > 0
            abs_size = abs(size)
            
            # 2. Prices
            entry_price = trade.price
            # Use gross PnL for price extraction to be precise on price action
            # Pnl = (Exit - Entry) * Size
            if abs_size > 0:
                price_diff_gross = trade.pnl / abs_size
                if is_long:
                    exit_price = entry_price + price_diff_gross
                else:
                    exit_price = entry_price - price_diff_gross
            else:
                exit_price = entry_price # Fallback

            # 3. Strategy Params (SL/TP)
            sl_price = 0.0
            tp_price = 0.0
            sl_dist = 0.0
            tp_dist = 0.0
            
            # Attempt to retrieve params from the strategy object
            try:
                # self.strategy is available in Analyzers
                params = self.strategy.params
                sl_perc = getattr(params, 'stop_loss', 0)
                tp_perc = getattr(params, 'take_profit', 0)
                
                if sl_perc > 0:
                    sl_dist = entry_price * sl_perc
                    sl_price = (entry_price - sl_dist) if is_long else (entry_price + sl_dist)
                    
                if tp_perc > 0:
                    tp_dist = entry_price * tp_perc
                    tp_price = (entry_price + tp_dist) if is_long else (entry_price - tp_dist)
            except:
                pass

            # 4. Risk / Reward
            risk_reward = 0.0
            if sl_dist > 0:
                risk_reward = tp_dist / sl_dist if tp_dist > 0 else 0

            # 5. Capital & Metrics
            capital = entry_price * abs_size
            
            # 6. Cumulative PnL
            self.cum_pnl += trade.pnlcomm

            self.trades.append({
                'entry_time': bt.num2date(trade.dtopen).isoformat(), # ISO format includes YYYY-MM-DD
                'exit_time': bt.num2date(trade.dtclose).isoformat(),
                'pnl': round(trade.pnlcomm, 2),
                'pnl_perc': round((trade.pnlcomm / capital * 100), 2) if capital != 0 else 0, # PnL % on Margin/Capital
                'cumulative_pnl': round(self.cum_pnl, 2),
                'entry_price': round(entry_price, 4),
                'exit_price': round(exit_price, 4),
                'size': round(abs_size, 6),
                'capital': round(capital, 2),
                'target': round(tp_price, 4),
                'stop_loss': round(sl_price, 4),
                'risk_reward': round(risk_reward, 2),
                'type': 'Long' if is_long else 'Short'
            })

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
    """Fetch OHLCV data from Binance Only"""
    ex_id = 'binance'
    try:
        exchange = getattr(ccxt, ex_id)({'enableRateLimit': True})
        
        # Calculate since timestamp
        now = exchange.milliseconds()
        duration_ms = days * 24 * 60 * 60 * 1000
        since = now - duration_ms
        
        all_ohlcv = []
        limit = 1000
        
        print(f"📡 Attempting to fetch {symbol} {timeframe} from {ex_id.upper()}...")
        
        while since < now:
            ohlcv = exchange.fetch_ohlcv(symbol, timeframe, since=since, limit=limit)
            if not ohlcv:
                break
            all_ohlcv.extend(ohlcv)
            since = ohlcv[-1][0] + 1
            if len(all_ohlcv) > 20000:
                break
                
        if not all_ohlcv:
            print(f"⚠️ {ex_id.upper()} returned no data for {symbol}.")
            return pd.DataFrame()

        df = pd.DataFrame(all_ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
        df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
        df.set_index('timestamp', inplace=True)
        return df
            
    except Exception as e:
        print(f"❌ {ex_id.upper()} fetch failed: {e}", file=sys.stderr)
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
    
    # Sanitize metadata to prevent Backtrader TypeError (colliding with positional args)
    for key in ['id', 'strategy', 'symbol', 'timeframe']:
        current_params.pop(key, None)
        
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
    cerebro.addanalyzer(TradeList, _name='tradelist')
    
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
            
            winning_streak = trade_analysis.get('streak', {}).get('won', {}).get('longest', 0)
            losing_streak = trade_analysis.get('streak', {}).get('lost', {}).get('longest', 0)
        except:
            total_trades = 0
            won_trades = 0
            win_rate = 0.0
            winning_streak = 0
            losing_streak = 0
            
        tradelist = strat.analyzers.tradelist.get_analysis()
        
        return {
            'pnl': round(pnl, 2),
            'pnl_perc': pnl_perc,
            'sharpe_ratio': sharpe,
            'max_drawdown': max_drawdown,
            'win_rate': win_rate,
            'total_trades': total_trades,
            'won_trades': won_trades,
            'winning_streak': winning_streak,
            'losing_streak': losing_streak,
            'num_candles': len(df),
            'trades_list': tradelist,
            'final_value': round(final_value, 2),
            'initial_capital': initial_capital,
            'leverage': leverage,
            'symbol': symbol,
            'timeframe': timeframe,
            'strategy': strategy_id,
            'params': current_params
        }
        
    except Exception as e:
        import traceback
        traceback.print_exc()
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
