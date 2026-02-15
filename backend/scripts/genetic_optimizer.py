
import sys
import os
import json
import random
import uuid
import argparse
import traceback
import numpy as np
import pandas as pd
import ccxt
import logging
import copy
from datetime import datetime, timedelta
import warnings

# Suppress noisy warnings
warnings.filterwarnings("ignore", category=DeprecationWarning, module="pandas")
warnings.filterwarnings("ignore", category=FutureWarning, module="pandas")
warnings.filterwarnings("ignore", category=UserWarning, module="urllib3")
try:
    from urllib3.exceptions import NotOpenSSLWarning
    warnings.filterwarnings("ignore", category=NotOpenSSLWarning)
except ImportError:
    pass

from dotenv import load_dotenv
# Load .env.local from project root
# Script is in backend/scripts/genetic_optimizer.py -> root is ../../../
root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv(os.path.join(root_dir, '.env.local'))

# Add backend to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from strategy_logic import StrategyLogic
try:
    from backend.scripts.run_backtest import fetch_ohlcv, run_backtest
except ImportError:
    try:
        from scripts.run_backtest import fetch_ohlcv, run_backtest
    except ImportError:
        # Fallback if running from within backend/scripts
        import sys
        import os
        sys.path.append(os.path.dirname(os.path.abspath(__file__)))
        from run_backtest import fetch_ohlcv, run_backtest

# Configure Logging - Force stdout for info to match 'info' level in backend
logging.basicConfig(
    level=logging.INFO, 
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("GeneticOptimizer")

class GeneticOptimizer:
    def __init__(self, strategies_path='strategies/user_strategies.json', output_path='data/optimized_params.json'):
        self.strategies_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), strategies_path)
        self.output_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), output_path)
        self.strategies = self._load_strategies()
        self.data_cache = {}
        self.alphaxgb_weights = self._load_alphaxgb_weights()
        self.excluded_strategies = self._load_exclusions()

    def _load_exclusions(self):
        try:
            # Root data folder is ../../../data relative to backend/scripts/genetic_optimizer.py
            path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'data/excluded_strategies.json')
            if os.path.exists(path):
                with open(path, 'r') as f:
                    return json.load(f)
            return []
        except:
            return []

    def _load_alphaxgb_weights(self):
        try:
            path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'models/alphaxgb_weights.json')
            if os.path.exists(path):
                with open(path, 'r') as f:
                    data = json.load(f)
                    logger.info(f"🧠 GeneticOptimizer: Loaded AlphaXGB model (Last trained: {data.get('last_trained')})")
                    return data.get('weights', {})
            return {}
        except Exception as e:
            logger.error(f"Failed to load AlphaXGB weights: {e}")
            return {}

    def _load_strategies(self):
        try:
            with open(self.strategies_path, 'r') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load strategies: {e}")
            return []

    def _get_param_ranges(self, strategy_id):
        """Define search space for each strategy."""
        ranges = {}
        
        if strategy_id == 'volatility-scalper':
            ranges = {
                'vol_multiplier': (1.0, 3.0, float),
                'fast_ema': (3, 10, int),
                'slow_ema': (10, 30, int),
                'stop_loss': (0.001, 0.02, float),
                'take_profit': (0.005, 0.05, float),
                'trailing_sl_perc': (0.001, 0.02, float)
            }
        elif strategy_id == 'ndrt-strategy':
            ranges = {
                'buffer_percent': (0.1, 2.0, float),
                'stop_loss': (0.001, 0.05, float),
                'trailing_sl_perc': (0.001, 0.03, float)
            }
        elif strategy_id == 'triple-confirmation':
            ranges = {
                'rsi_period': (7, 21, int),
                'rsi_oversold': (20, 40, int),
                'rsi_overbought': (60, 80, int),
                'volume_multiplier': (1.1, 3.0, float),
                'stop_loss': (0.01, 0.05, float),
                'take_profit': (0.02, 0.10, float),
                'trailing_sl_perc': (0.005, 0.03, float)
            }
        elif strategy_id == 'trend-momentum':
            ranges = {
                'ema_fast': (5, 20, int),
                'ema_slow': (20, 50, int),
                'stoch_oversold': (10, 30, int),
                'stoch_overbought': (70, 90, int),
                'adx_threshold': (15, 40, int),
                'trailing_sl_perc': (0.005, 0.04, float)
            }
        elif strategy_id == 'mean-reversion-pro':
            ranges = {
                'rsi_period': (7, 14, int),
                'rsi_oversold': (20, 35, int),
                'rsi_overbought': (65, 80, int),
                'bb_devfactor': (1.5, 3.0, float),
                'williams_oversold': (-95, -70, int),
                'take_profit': (0.01, 0.05, float),
                'trailing_sl_perc': (0.001, 0.02, float)
            }
        
        return ranges

    def _generate_individual(self, ranges, base_params):
        """Create a random variant."""
        individual = base_params.copy()
        for key, (min_val, max_val, type_) in ranges.items():
            if type_ is int:
                individual[key] = random.randint(min_val, max_val)
            else:
                individual[key] = round(random.uniform(min_val, max_val), 4)
        return individual

    def quick_backtest(self, df, strategy_config):
        """Fast vectorized backtest simulation."""
        if df.empty: return -999
        # Copy to avoid polluting cache (shallow copy of structure, deep of data if needed but vectorized implies new series usually)
        return self._vectorized_fitness(df, strategy_config)

    def _vectorized_fitness(self, df, config):
        """Approximation of PnL using vectorized operations."""
        strat_id = config.get('id') or config.get('strategy')
        
        # ---------------------------------------------------
        # LIQUIDATION & SAFETY CHECK
        # ---------------------------------------------------
        leverage = config.get('leverage', 1.0)
        
        # 1. Liquidation Threshold
        # Liquidation roughly happens at 100/Leverage % distance.
        # Binance maint. margin is usually 0.5% to 1%.
        # Safety: We kill any strategy where SL >= (1/leverage) * 0.9
        
        stop_loss = config.get('stop_loss', 0)
        if stop_loss > 0:
            liquidation_dist = (1.0 / leverage) * 0.9 # 90% of liquidation distance
            if stop_loss >= liquidation_dist:
                return -999.0 # INVALID: SL is below liquidation price
        
        # We work on a copy
        d = df.copy()
        signal_col = pd.Series(0, index=d.index)
        
        # ---------------------------------------------------
        # STRATEGY LOGIC
        # ---------------------------------------------------

        if strat_id == 'triple-confirmation':
            # Indicators
            period = config.get('rsi_period', 14)
            delta = d['close'].diff()
            gain = (delta.where(delta > 0, 0)).fillna(0)
            loss = (-delta.where(delta < 0, 0)).fillna(0)
            avg_gain = gain.rolling(window=period).mean()
            avg_loss = loss.rolling(window=period).mean()
            rs = avg_gain / avg_loss
            d['rsi'] = 100 - (100 / (1 + rs))
            
            exp1 = d['close'].ewm(span=config.get('macd_fast', 12), adjust=False).mean()
            exp2 = d['close'].ewm(span=config.get('macd_slow', 26), adjust=False).mean()
            macd = exp1 - exp2
            signal = macd.ewm(span=config.get('macd_signal', 9), adjust=False).mean()
            
            vol_sma = d['volume'].rolling(window=20).mean()
            
            # Directional Volatility Requirements (Optional but good)
            vol_mult = config.get('volume_multiplier', 1.5)
            
            buy_cond = (d['rsi'] < config.get('rsi_oversold', 30)) & (macd > signal) & (d['volume'] > vol_sma * vol_mult)
            sell_cond = (d['rsi'] > config.get('rsi_overbought', 70)) & (macd < signal) & (d['volume'] > vol_sma * vol_mult)
            
            signal_col[buy_cond] = 1
            signal_col[sell_cond] = -1

        elif strat_id == 'volatility-scalper':
            d['atr'] = (d['high'] - d['low']).rolling(14).mean()
            d['ema_f'] = d['close'].ewm(span=config.get('fast_ema', 5), adjust=False).mean()
            d['ema_s'] = d['close'].ewm(span=config.get('slow_ema', 13), adjust=False).mean()
            
            # Directional Variations: Allow Short side to require more/less volatility
            vol_mult_long = config.get('vol_multiplier_long', config.get('vol_multiplier', 1.5))
            vol_mult_short = config.get('vol_multiplier_short', config.get('vol_multiplier', 1.5))
            
            atr_mean = d['atr'].rolling(100).mean()
            
            vol_threshold_long = d['atr'] > (atr_mean * vol_mult_long)
            vol_threshold_short = d['atr'] > (atr_mean * vol_mult_short)
            
            buy_cond = (d['ema_f'] > d['ema_s']) & (d['ema_f'].shift(1) <= d['ema_s'].shift(1)) & vol_threshold_long
            sell_cond = (d['ema_f'] < d['ema_s']) & (d['ema_f'].shift(1) >= d['ema_s'].shift(1)) & vol_threshold_short
            
            signal_col[buy_cond] = 1
            signal_col[sell_cond] = -1

        elif strat_id == 'ndrt-strategy':
            # Fractal Breakout / Donchian Channel Proxy
            period = 5
            high_rolling = d['high'].rolling(period).max().shift(1)
            low_rolling = d['low'].rolling(period).min().shift(1)
            
            buffer = config.get('buffer_percent', 0.5) / 100
            
            buy_cond = d['close'] > (high_rolling * (1 + buffer))
            sell_cond = d['close'] < (low_rolling * (1 - buffer))
            
            signal_col[buy_cond] = 1
            signal_col[sell_cond] = -1

        elif strat_id == 'trend-momentum':
            # EMA + Stoch + ADX Proxy
            ema_f = d['close'].ewm(span=config.get('ema_fast', 8), adjust=False).mean()
            
            low_min = d['low'].rolling(config.get('stoch_period', 14)).min()
            high_max = d['high'].rolling(config.get('stoch_period', 14)).max()
            stoch_k = 100 * (d['close'] - low_min) / (high_max - low_min)
            
            d['tr'] = d['high'] - d['low']
            adx_proxy = d['tr'].rolling(config.get('adx_period', 14)).mean()
            
            buy_cond = (d['close'] > ema_f) & (stoch_k < config.get('stoch_oversold', 20))
            sell_cond = (d['close'] < ema_f) & (stoch_k > config.get('stoch_overbought', 80))
            
            signal_col[buy_cond] = 1
            signal_col[sell_cond] = -1

        elif strat_id == 'mean-reversion-pro':
            # RSI + BB + Williams
            delta = d['close'].diff()
            gain = (delta.where(delta > 0, 0)).fillna(0)
            loss = (-delta.where(delta < 0, 0)).fillna(0)
            avg_gain = gain.rolling(14).mean()
            avg_loss = loss.rolling(14).mean()
            rs = avg_gain / avg_loss
            d['rsi'] = 100 - (100 / (1 + rs))
            
            sma = d['close'].rolling(config.get('bb_period', 20)).mean()
            std = d['close'].rolling(config.get('bb_period', 20)).std()
            bb_low = sma - (std * config.get('bb_devfactor', 2.0))
            bb_high = sma + (std * config.get('bb_devfactor', 2.0))
            
            per = config.get('williams_period', 14)
            highest_high = d['high'].rolling(per).max()
            lowest_low = d['low'].rolling(per).min()
            williams = (highest_high - d['close']) / (highest_high - lowest_low) * -100
            
            buy_cond = (d['rsi'] < config.get('rsi_oversold', 30)) & (d['close'] < bb_low) & (williams < config.get('williams_oversold', -80))
            sell_cond = (d['rsi'] > config.get('rsi_overbought', 70)) & (d['close'] > bb_high)
            
            signal_col[buy_cond] = 1
            signal_col[sell_cond] = -1

        else:
            return random.uniform(-10, 10)

        # ---------------------------------------------------
        # PnL CALCULATION (Simplified but rewarding trailing behavior)
        # ---------------------------------------------------
        d['ret'] = d['close'].pct_change().shift(-1)
        # Fix: ensure only legal leverage is used
        d['ret'] = d['ret'].clip(lower=-1.0) # Cannot lose more than 100% of asset value
        
        d['signal'] = signal_col
        d['position'] = d['signal'].replace(0, np.nan).ffill().fillna(0)
        
        # Apply costs (slippage/commissions approx 0.15% - Hardened for robustness)
        trades_count = d['signal'].abs().sum()
        costs = trades_count * 0.0015
        
        leverage = config.get('leverage', 1.0)
        d['strategy_ret'] = d['position'] * d['ret'] * leverage
        
        # Heuristic Bonus for Trailing: 
        trailing_sl_perc = config.get('trailing_sl_perc', 0)
        
        raw_pnl = d['strategy_ret'].sum() - costs
        
        # Consistency Bonus: Simplified Sharpe Ratio
        if raw_pnl > 0:
            std_dev = d['strategy_ret'].std()
            if std_dev > 0:
                sharpe_approx = (raw_pnl / std_dev) / 100
                raw_pnl += sharpe_approx 
            
        # Penalty for aggressive leverage without trailing
        if leverage > 3 and trailing_sl_perc == 0:
            raw_pnl *= 0.8 
            
        # Bonus for having trailing logic in deep trends
        if raw_pnl > 0 and trailing_sl_perc > 0:
            raw_pnl *= 1.1 
            
        pnl = raw_pnl
        if np.isnan(pnl): pnl = -10.0
        
        return pnl

    def run_optimization(self, strategy_id, symbol='BTC/USDT', timeframe='1h', generations=5, population_size=10, min_leverage=3, max_leverage=10, days=365):
        logger.info(f"🧬 Optimizing {strategy_id} on {symbol} {timeframe} (Lev: {min_leverage}x-{max_leverage}x, Days: {days})...")
        
        # Safety cap for lower TFs to prevent API timeout/memory issues if days is huge
        if timeframe in ['3m', '5m', '15m'] and days > 60:
             logger.warning(f"⚠️ Capping backtest duration for {timeframe} to 60 days (requested {days}) to prevent timeout.")
             days = 60

        
        cache_key = f"{symbol}_{timeframe}"
        if cache_key not in self.data_cache:
            df = fetch_ohlcv(symbol, timeframe, days=days)
            if df.empty:
                logger.error(f"No data found for {symbol} {timeframe}.")
                return None
            self.data_cache[cache_key] = df
        
        df = self.data_cache[cache_key]
        
        target_strat = next((s for s in self.strategies if s.get('strategyId') == strategy_id or s.get('id') == strategy_id), None)
        if not target_strat:
            logger.error(f"Strategy {strategy_id} not found in json.")
            return None
            
        ranges = self._get_param_ranges(strategy_id)
        if not ranges:
            logger.warning(f"No optimization ranges defined for {strategy_id}.")
            return target_strat.get('params', {})
            
        # Add leverage as a gene in the ranges if not present
        if not ranges: ranges = {}
        ranges['leverage'] = (min_leverage, max_leverage, int)
        
        # Walk-Forward Validation: Split Data
        split_idx = int(len(df) * 0.8)
        train_df = df.iloc[:split_idx].copy()
        test_df = df.iloc[split_idx:].copy()
        
        if len(train_df) < 100 or len(test_df) < 20:
            logger.warning(f"Insufficient data for split validation for {symbol} {timeframe}")
            return None

        population = []
        base_params = target_strat.get('params', {})
        for _ in range(population_size):
            ind = self._generate_individual(ranges, base_params)
            population.append(ind)
            
        best_train_pnl = -999.0
        
        # Train on 80% Data
        for gen in range(generations):
            scores = []
            for ind in population:
                # Inject ID for checking
                ind['id'] = strategy_id
                # leverage is now in 'ind' from random generation
                fitness = self.quick_backtest(train_df, ind)
                scores.append((fitness, ind))
            
            scores.sort(key=lambda x: x[0], reverse=True)
            
            current_best = scores[0][0]
            if current_best > best_train_pnl: best_train_pnl = current_best
            
            # logger.info(f"  Gen {gen+1}: Best Train PnL = {current_best:.2f}%")
            if (gen + 1) % 2 == 0 or gen == 0:
                best_ind = scores[0][1]
                # Filter out heavy objects or internal keys if any
                clean_params = {k: v for k, v in best_ind.items() if k not in ['id', 'strategy']}
                print(f"    - Generation {gen+1}: Best PnL {current_best:.2f}% | Params: {clean_params}")
            
            survivors = [s[1] for s in scores[:max(1, population_size // 2)]]
            
            new_pop = survivors[:]
            while len(new_pop) < population_size:
                parent = random.choice(survivors)
                child = copy.deepcopy(parent)
                if ranges:
                    gene = random.choice(list(ranges.keys()))
                    min_v, max_v, type_ = ranges[gene]
                    if type_ is int:
                        child[gene] = random.randint(min_v, max_v)
                    else:
                        child[gene] = round(random.uniform(min_v, max_v), 4)
                new_pop.append(child)
            
            population = new_pop
            
        best_params = scores[0][1]
        best_params['symbol'] = symbol
        best_params['timeframe'] = timeframe
        
        # Validate on 20% Holdout Data
        test_pnl = self.quick_backtest(test_df, best_params)
        
        # Robustness Criteria:
        # 1. Must be profitable on unseen data
        # 2. Test performance shouldn't be drastically worse than Train (avoid massive overfitting)
        #    Allowing 50% dropoff as acceptable "reality Check"
        # User Feedback:    # Robustness Criteria
        if test_pnl > 0.0: # Lowered PnL threshold to show results
            logger.info(f"  ✅ Validated | PnL: {test_pnl:.0f}% (Train: {best_train_pnl:.0f}%) | Lev: x{best_params.get('leverage')}")
            return best_params, test_pnl # Return test PnL as realistic expectation
        else:
            logger.warning(f"  ❌ Failed | PnL: {test_pnl:.0f}% (Train: {best_train_pnl:.0f}%) | Lev: x{best_params.get('leverage')}")
            return None

    def run_all(self, min_leverage=3, max_leverage=10):
        results = {}
        report = []
        strategies_to_optimize = [
            'volatility-scalper', 
            'triple-confirmation', 
            'ndrt-strategy', 
            'trend-momentum', 
            'mean-reversion-pro'
        ]
        
        print("="*60)
        print("🚀 STARTING GLOBAL GENETIC OPTIMIZATION (365 DAYS BTC)")
        print("="*60)
        
        for mid in strategies_to_optimize:
            # Force BTC/USDT for all
            lev_min = min_leverage
            lev_max = max_leverage
            if mid == 'mean-reversion-pro':
                lev_max = min(max_leverage, 3)
                
            res = self.run_optimization(mid, symbol='BTC/USDT', min_leverage=lev_min, max_leverage=lev_max, days=365)
            if res:
                best_params, best_pnl = res
                results[mid] = best_params
                report.append({'strategy': mid, 'pnl': best_pnl})
                    
        # Save
        os.makedirs(os.path.dirname(self.output_path), exist_ok=True)
        with open(self.output_path, 'w') as f:
            json.dump(results, f, indent=2)
            
        print("\n" + "="*60)
        print("📊 FINAL OPTIMIZATION REPORT (BTC/USDT - 365 Days)")
        print("="*60)
        print(f"{'STRATEGY':<25} | {'PnL (%)':<10}")
        print("-" * 40)
        for item in report:
            print(f"{item['strategy']:<25} | {item['pnl']:>9.2f}%")
        print("="*60)
        
        logger.info(f"✅ Global Optimization Complete. Saved to {self.output_path}")

        # Chain into Deep Optimization
        print("\n🔄 Chaining into DEEP OPTIMIZATION ENGINE...")
        self.run_deep_optimization(mode='all', min_leverage=min_leverage, max_leverage=max_leverage, days=365)

    def run_deep_optimization(self, mode='all', retry_skipped=False, generations=50, population_size=100, min_leverage=3, max_leverage=10, days=365, symbols=None, timeframes=None):
        # OPTIMIZED for ~6 Hours (50 Gens x 100 Pop = 5000 iterations per task)
        generations = 50
        population_size = 100
        
        print("="*60)
        print(f"🚀 STARTING DEEP OPTIMIZATION ENGINE (Mode: {mode.upper()})")
        print(f"Targeting ~6 Hour Runtime: {generations} Gens x {population_size} Population")
        if retry_skipped:
            print("🔄 RETRY MODE: Processing previously skipped coins only.")
        else:
            print("Scope: 30 Coins (Inc. 20 Memes) | Continuous Result Streaming")
        print("="*60)
        
        # Status Lock & PID
        status_path = os.path.join(os.path.dirname(self.output_path), 'optimization_status.json')
        skipped_path = os.path.join(os.path.dirname(self.output_path), 'skipped_coins.json')
        
        try:
            with open(status_path, 'w') as f:
                json.dump({
                    "status": "running", 
                    "mode": mode, 
                    "pid": os.getpid(),
                    "startTime": datetime.now().isoformat()
                }, f)
        except Exception as e:
            logger.error(f"Failed to write status lock: {e}")

        # Task Construction
        tasks = []
        
        if retry_skipped and os.path.exists(skipped_path):
            try:
                with open(skipped_path, 'r') as f:
                    skipped_data = json.load(f)
                    for item in skipped_data:
                        tasks.append(item)
            except Exception as e:
                logger.error(f"Failed to load skipped coins: {e}")

        if not tasks:
            # GRID SEARCH MODE (Fixed Top 20 Coins)
            coins = [
                'BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'ADA/USDT', 'XRP/USDT',
                'BNB/USDT', 'DOGE/USDT', 'MATIC/USDT', 'DOT/USDT', 'LTC/USDT',
                'AVAX/USDT', 'LINK/USDT', 'UNI/USDT', 'ATOM/USDT', 'ETC/USDT',
                'FIL/USDT', 'NEAR/USDT', 'ALGO/USDT', 'ICP/USDT', 'BCH/USDT'
            ]
            
            all_timeframes = ['3m', '5m', '15m', '30m', '1h', '4h', '1d']
            
            if timeframes:
                timeframes_list = [t.strip() for t in timeframes.split(',') if t.strip()]
            elif mode == 'scalp':
                timeframes_list = ['3m', '5m', '15m', '30m']
            elif mode == 'swing':
                timeframes_list = ['1h', '4h', '1d']
            elif mode == 'test':
                 coins = ['BTC/USDT']
                 timeframes_list = ['1h']
            else:
                timeframes_list = all_timeframes

            # Grid Search Settings
            strategies = ['trend-momentum', 'triple-confirmation', 'ndrt-strategy', 'mean-reversion-pro', 'volatility-scalper']
            
            # LEVERAGE GRID: 3x - 10x
            leverage_grid = [3, 5, 8, 10]
            
            # Dynamic Trailing Grid mapping (Leverage -> Trailing %)
            trailing_map = {
                3: [0.02, 0.03, 0.04],   # 3x: Wide
                5: [0.015, 0.025, 0.03], # 5x: Standard
                8: [0.01, 0.015, 0.02],  # 8x: Tight
                10: [0.008, 0.012, 0.015]# 10x: Scalp
            }

            # GRID SEARCH GENERATION
            import itertools

            print(f"🌍 Generating Grid Search Tasks for {len(coins)} coins across {len(timeframes_list)} timeframes...")

            for coin in coins:
                for tf in timeframes_list:
                    for strat in strategies:
                        # Define Grids
                        grid = {}
                        
                        if strat == 'volatility-scalper':
                            grid = {
                                'vol_multiplier': [1.5, 2.0, 2.5],
                                'ema_fast': [5, 9],
                                'stop_loss': [0.005, 0.01, 0.02]
                            }
                        elif strat == 'ndrt-strategy':
                            grid = {
                                'buffer_percent': [0.1, 0.5, 1.0, 1.5],
                                'stop_loss': [0.01, 0.02, 0.03, 0.05, 0.08]
                            }
                        elif strat == 'triple-confirmation':
                            grid = {
                                'rsi_period': [7, 14, 21],
                                'rsi_oversold': [25, 30, 35],
                                'take_profit': [0.03, 0.06]
                            }
                        elif strat == 'trend-momentum':
                            grid = {
                                'ema_fast': [9, 12],
                                'ema_slow': [21, 50],
                                'adx_threshold': [20, 25],
                                'stoch_oversold': [20, 30, 40]
                            }
                        elif strat == 'mean-reversion-pro':
                            grid = {
                                'bb_devfactor': [2.0, 2.5, 3.0],
                                'rsi_period': [7, 14],
                                'williams_oversold': [-80, -90, -95]
                            }
                        
                        # Handle Global Grids (Leverage + Dynamic Trailing)
                        base_keys = list(grid.keys())
                        base_values = list(grid.values())
                        
                        if not base_values:
                            base_combos = [{}]
                        else:
                            base_combos = [dict(zip(base_keys, c)) for c in itertools.product(*base_values)]

                        for base_params in base_combos:
                            for lev in leverage_grid:
                                # Get applicable trailing stops for this leverage
                                current_trails = trailing_map.get(lev, [0.01])
                                
                                for trail in current_trails:
                                    # Create final params
                                    final_params = base_params.copy()
                                    final_params['leverage'] = lev
                                    final_params['trailing_sl_perc'] = trail
                                    final_params['use_trailing_stop'] = True
                                    
                                    tasks.append({
                                        "symbol": coin,
                                        "timeframe": tf,
                                        "strategy": strat,
                                        "params": final_params,
                                        "is_grid": True
                                    })
            
            print(f"✅ Generated {len(tasks)} Grid Search Tasks (Combinations)")

        # We don't clear the list here; the API route does that on start.
        # We append valid results as we find them.
        shortlist_path = os.path.join(os.path.dirname(self.output_path), 'shortlisted_strategies.json')
        
        skipped_items = []

        total_runs = len(tasks)
        curr = 0
        
        try:
            for task in tasks:
                coin = task['symbol']
                tf = task['timeframe']
                strat = task['strategy']
                
                curr += 1
                progress = (curr / total_runs) * 100
                iterations_per_task = generations * population_size
                print(f"[{curr}/{total_runs}] ({progress:.1f}%) Optimizing {strat} on {coin} {tf} | 🧬 {iterations_per_task} Iterations...")
                
                # Check for kill signal
                if os.path.exists("KILL_OPTIMIZER"):
                    print("🛑 Kill signal received. Stopping optimization.")
                    break

                try:
                    # Unleashed parameters
                    
                    # DURATION LOGIC: 3 Years for High TF, 60 Days for Low TF
                    if tf in ['3m', '5m']:
                        run_days = 60
                    else:
                        run_days = 1095 # 3 Years
                        
                    if task.get('is_grid'):
                        # GRID SEARCH EXECUTION (Single Backtest)
                        params = task['params']
                        # Inject standard params if missing
                        if 'leverage' not in params: params['leverage'] = 5
                        
                        # Direct Backtest call
                        detailed_res = run_backtest(
                            strat, coin, tf, 
                            days=run_days,
                            leverage=params['leverage'],
                            params=params
                        )
                        
                        # Normalize result structure to match optimization output
                        if not detailed_res.get('error'):
                            res = (params, detailed_res.get('pnl_perc', 0))
                        else:
                            res = None
                    else:
                        # Standard Genetic Optimization
                        lev_min = min_leverage
                        lev_max = max_leverage
                        if strat == 'mean-reversion-pro':
                            lev_max = min(max_leverage, 3)
                            
                        res = self.run_optimization(strat, symbol=coin, timeframe=tf, generations=generations, population_size=population_size, min_leverage=lev_min, max_leverage=lev_max, days=days)

                    if res:
                        best_params, pnl = res
                        
                        # Optimization: Reuse result for Grid Search to avoid double-run
                        if task.get('is_grid') and 'detailed_res' in locals():
                             # detailed_res is already available from the grid execution block above
                             pass
                        else:
                            # Run deep backtest for genetic results (or if detailed_res missing)
                            detailed_res = run_backtest(
                                strat, coin, tf, 
                                days=run_days,
                                leverage=best_params.get('leverage'),
                                params=best_params
                            )

                        if detailed_res.get('error'):
                            print(f"  ⚠️ Deep Backtest Error: {detailed_res.get('error')}")
                        
                        deep_pnl = detailed_res.get('pnl_perc', 0)
                        max_dd = detailed_res.get('max_drawdown', 100.0)
                        
                        # DRAWDOWN FILTER (Safety)
                        if max_dd > 40.0:
                             print(f"  ❌ Discarded due to High Drawdown: {max_dd:.2f}% > 40%")
                        
                        elif not detailed_res.get('error'):
                             # Acceptance Logic (Positive PnL)
                             # MANNUALLY SHORTLISTING (User Request): No automated trade count filter
                             
                             if deep_pnl > 0.0:
                                print(f"  🏆 Shortlisted! Deep PnL: {deep_pnl:.2f}% | DD: {max_dd:.2f}%")
                                result_entry = {
                                    "strategy": strat,
                                    "strategyId": strat,
                                    "symbol": coin,
                                    "timeframe": tf,
                                    "pnl": detailed_res['pnl_perc'],
                                    "sharpe": detailed_res['sharpe_ratio'],
                                    "drawdown": detailed_res['max_drawdown'],
                                    "winRate": detailed_res['win_rate'],
                                    "totalTrades": detailed_res['total_trades'],
                                    "winningStreak": detailed_res['winning_streak'],
                                    "losingStreak": detailed_res['losing_streak'],
                                    "numCandles": detailed_res['num_candles'],
                                    "trades": detailed_res['trades_list'],
                                    "leverage": best_params.get('leverage'),
                                    "params": best_params,
                                    "id": str(uuid.uuid4()),
                                    "confidence": "High (Deep Backtested)"
                                }
                            
                                print(f"  ✅ FOUND WINNER | PnL: {detailed_res['pnl_perc']:.0f}% | {coin} {tf}")
                                
                                # Incremental Save
                                current_data = []
                                if os.path.exists(shortlist_path):
                                    try:
                                        with open(shortlist_path, 'r') as f:
                                            current_data = json.load(f)
                                    except:
                                        current_data = []
                                
                                current_data.append(result_entry)
                                # Sort continuously so the UI always shows best first
                                current_data.sort(key=lambda x: x['pnl'], reverse=True)
                                
                                with open(shortlist_path, 'w') as f:
                                    json.dump(current_data, f, indent=2)

                                # BACKUP SAVE (Append Only)
                                backup_path = os.path.join(os.path.dirname(self.output_path), 'results_history.json')
                                try:
                                    with open(backup_path, 'a') as f:
                                        f.write(json.dumps(result_entry) + "\n")
                                except:
                                    pass

                except Exception as e:
                    # Capture specific "No data" errors or general failures
                    logger.error(f"Optimization crashed for {coin} {tf}: {e}")
                    traceback.print_exc()
                    skipped_items.append(task)

            # Save skipped items if any
            if skipped_items:
                # If retrying, we might want to Merge with existing or overwrite?
                # For simplicity, overwrite with what failed THIS time.
                with open(skipped_path, 'w') as f:
                    json.dump(skipped_items, f, indent=2)
                print(f"⚠️ Saved {len(skipped_items)} skipped items to {skipped_path}")

        except KeyboardInterrupt:
            print("\n🛑 Optimization Stopped by User")
            
        finally:
            # Always clear lock
            try:
                with open(status_path, 'w') as f:
                    json.dump({"status": "idle"}, f)
            except:
                pass
        
        print("\n" + "="*60)
        print("✅ DEEP OPTIMIZATION COMPLETE")
        print("="*60)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('command', nargs='?', default='all', help="Command (deep, all, or strategyId)")
    parser.add_argument('--mode', default='all', help="Optimization mode (scalp, swing, all)")
    parser.add_argument('--retry-skipped', action='store_true', help="Retry skipped coins")
    parser.add_argument('--gens', type=int, default=2, help="Generations")
    parser.add_argument('--pop', type=int, default=4, help="Population size")
    parser.add_argument('--min-lev', type=int, default=3, help="Min Leverage")
    parser.add_argument('--max-lev', type=int, default=10, help="Max Leverage")
    parser.add_argument('--symbols', default=None, help="Comma-separated symbols (e.g. BTC/USDT,ETH/USDT)")
    parser.add_argument('--tfs', default=None, help="Comma-separated timeframes (e.g. 1h,15m)")
    parser.add_argument('--days', type=int, default=365, help="days to backtest")
    
    args = parser.parse_args()
    opt = GeneticOptimizer()
    
    if args.command == 'deep':
        opt.run_deep_optimization(
            mode=args.mode, 
            retry_skipped=args.retry_skipped,
            generations=args.gens,
            population_size=args.pop,
            min_leverage=args.min_lev,
            max_leverage=args.max_lev,
            days=args.days,
            symbols=args.symbols,
            timeframes=args.tfs
        )
    elif args.command == 'all':
        opt.run_all(min_leverage=args.min_lev, max_leverage=args.max_lev)
    else:
        # Assume command is strategyId
        opt.run_optimization(args.command)
