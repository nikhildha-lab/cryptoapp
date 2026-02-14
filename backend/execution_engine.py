
import os
import sys
import time
import json
import ccxt
import pandas as pd
from datetime import datetime, timedelta
import uuid
from exchanges.factory import get_exchange_adapter
from notifiers import NotificationHub
from dotenv import load_dotenv
from ai_agent import AIAgent

# Load environment variables
load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env.local'))

# Configuration
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')
STRATEGIES_FILE = os.path.join(DATA_DIR, 'active_strategies.json')
LOGS_FILE = os.path.join(DATA_DIR, 'audit_logs.json')
TRADES_FILE = os.path.join(DATA_DIR, 'trade_history.json')
HEARTBEAT_FILE = os.path.join(DATA_DIR, 'engine_heartbeat.json')
OPTIMIZED_PARAMS_FILE = os.path.join(DATA_DIR, 'optimized_params.json')
FEED_HEALTH_FILE = os.path.join(DATA_DIR, 'feed_health.json')

# Ensure data directory exists
os.makedirs(DATA_DIR, exist_ok=True)

class ExecutionEngine:
    def __init__(self):
        self.strategies = []
        self.cooldowns = {} # Track cooldowns per strategy instance
        self.adapters = {} # Cache for exchange adapters
        self.feed_health = {} # Track latency and staleness per feed
        
        # Initialize default public adapter (Binance) for general data
        self.default_exchange = get_exchange_adapter('binance', is_paper=True)
        self.log("System", "Default Binance Adapter Initialized for public data", "success")
        
        # Initialize Notifiers (Multi-Channel Hub)
        self.notifier = NotificationHub()
        active_notifiers = [type(n).__name__ for n in self.notifier.notifiers]
        if active_notifiers:
            self.log("System", f"Notifications Enabled: {', '.join(active_notifiers)}", "success")
        else:
            self.log("System", "No notifiers configured (Check .env.local)", "warning")
        
        # Initialize AI Agent
        self.ai_agent = AIAgent()
        self.last_ml_training = datetime.now() - timedelta(hours=2) # Force training on start
        
        self.log("System", "Execution Engine Initialized (Multi-Exchange Mode)")

    def get_adapter(self, exchange_id, is_paper=True):
        """Get or create a cached exchange adapter with credentials from env"""
        exchange_id = exchange_id.lower()
        adapter_key = f"{exchange_id}_{'paper' if is_paper else 'live'}"
        
        if adapter_key in self.adapters:
            return self.adapters[adapter_key]
            
        # Load credentials from environment
        env_prefix = exchange_id.upper()
        api_key = os.getenv(f'{env_prefix}_API_KEY')
        api_secret = os.getenv(f'{env_prefix}_API_SECRET')
        
        # Fallback for CoinDCX old naming convention
        if exchange_id == 'coindcx' and not api_secret:
            api_secret = os.getenv('COINDCX_SECRET_KEY')
            
        credentials = {
            'api_key': api_key,
            'api_secret': api_secret
        }
        
        try:
            adapter = get_exchange_adapter(exchange_id, credentials, is_paper)
            self.adapters[adapter_key] = adapter
            self.log("System", f"Initialized {exchange_id.upper()} adapter ({'Paper' if is_paper else 'Live'})", "success")
            return adapter
        except Exception as e:
            self.log("System", f"Failed to initialize {exchange_id} adapter: {e}. Using default Binance.", "error")
            return self.default_exchange

    def update_heartbeat(self):
        try:
            with open(HEARTBEAT_FILE, 'w') as f:
                json.dump({"last_beat": datetime.now().isoformat()}, f)
        except Exception as e:
            print(f"Failed to update heartbeat: {e}")

    def log_trade(self, strategy_id, symbol, side, price, pnl_perc=None, reason=None, leverage=5, timeframe=None, status="FILLED", unrealized_pnl=None, entry_price=None, capital=None, signals=None, exchange=None, instance_id=None):
        trade_entry = {
            "id": str(uuid.uuid4()),
            "timestamp": datetime.now().isoformat(),
            "strategyId": strategy_id,
            "instanceId": instance_id or strategy_id,
            "symbol": symbol,
            "side": side,
            "price": price,
            "pnl": pnl_perc,
            "reason": reason,
            "leverage": leverage,
            "timeframe": timeframe,
            "status": status,
            "unrealizedPnL": unrealized_pnl,
            "entryPrice": entry_price,
            "capital": capital,
            "signals": signals,
            "exchange": exchange
        }
        
        try:
            trades = []
            if os.path.exists(TRADES_FILE):
                with open(TRADES_FILE, 'r') as f:
                    try:
                        trades = json.load(f)
                    except:
                        trades = []
            
            trades.insert(0, trade_entry)
            trades = trades[:1000] # Maintain history limit
            
            with open(TRADES_FILE, 'w') as f:
                json.dump(trades, f, indent=2)
        except Exception as e:
            self.log("System", f"Failed to record trade in history: {e}", "error")
    
    def log(self, source, message, level="info"):
        entry = {
            "id": str(uuid.uuid4()),
            "timestamp": datetime.now().isoformat(),
            "level": level,
            "source": source,
            "message": message
        }
        
        try:
            logs = []
            if os.path.exists(LOGS_FILE):
                with open(LOGS_FILE, 'r') as f:
                    try:
                        logs = json.load(f)
                    except:
                        logs = []
            
            logs.insert(0, entry)
            logs = logs[:50]
            
            with open(LOGS_FILE, 'w') as f:
                json.dump(logs, f, indent=2)
                
            print(f"[{level.upper()}] {source}: {message}")
        except Exception as e:
            print(f"Failed to write log: {e}")

    def load_strategies(self):
        try:
            # 1. Load Optimization Overrides
            optimized = {}
            if os.path.exists(OPTIMIZED_PARAMS_FILE):
                with open(OPTIMIZED_PARAMS_FILE, 'r') as f:
                    optimized = json.load(f)
            
            # 2. Load Active Strategies
            if os.path.exists(STRATEGIES_FILE):
                with open(STRATEGIES_FILE, 'r') as f:
                    self.strategies = json.load(f)
                    # Apply Overrides
                    for strategy in self.strategies:
                        sid = strategy.get('strategyId')
                        # Check if we have optimization for this ID
                        if sid in optimized:
                            # Merge optimized params
                            # We update keys, but preserve things like 'status', 'capital' if params didn't have them
                            # Optimization output is generally just the params dict
                            # We should be careful.
                            opt_params = optimized[sid]
                            strategy.update(opt_params)
                            # Ensure strategyId wasn't overwritten by 'strategy' key if they differ (rare)
                        strategy['strategyId'] = sid 
                        
                        # --- PARAMETER MIGRATION ---
                        # Convert old parameter names to new standardized ones
                        if 'params' in strategy:
                             p = strategy['params']
                             if 'trailing_stop_percent' in p and 'trailing_sl_perc' not in p:
                                  p['trailing_sl_perc'] = p['trailing_stop_percent']
                             if 'stop_loss_percent' in p and 'stop_loss' not in p:
                                  p['stop_loss'] = p['stop_loss_percent']
                        
                        # Direct strategy-level migration
                        if 'trailing_stop_percent' in strategy and 'trailing_sl_perc' not in strategy:
                             strategy['trailing_sl_perc'] = strategy['trailing_stop_percent']
                        if 'stop_loss_percent' in strategy and 'stop_loss' not in strategy:
                             strategy['stop_loss'] = strategy['stop_loss_percent']
                             
                        
                        # Ensure basic state fields exist for the API
                        if 'pnl' not in strategy: strategy['pnl'] = 0
                        if 'pnlPerc' not in strategy: strategy['pnlPerc'] = 0
                        if 'unrealizedPnL' not in strategy: strategy['unrealizedPnL'] = 0
                        if 'unrealizedPnLPerc' not in strategy: strategy['unrealizedPnLPerc'] = 0
                        if 'trades' not in strategy: strategy['trades'] = 0
                        if 'wins' not in strategy: strategy['wins'] = 0
                        if 'winRate' not in strategy: strategy['winRate'] = 0
            else:
                self.strategies = []
        except Exception as e:
            self.log("System", f"Failed to load strategies: {str(e)}", "error")

    def save_strategies(self):
        try:
            # Atomic-ish Save: Read latest, update active, write back
            current_on_disk = []
            if os.path.exists(STRATEGIES_FILE):
                try:
                    with open(STRATEGIES_FILE, 'r') as f:
                        current_on_disk = json.load(f)
                except:
                    current_on_disk = []
            
            # Map valid strategies by ID
            disk_map = {s['id']: s for s in current_on_disk if 'id' in s}
            
            # Update disk map with our in-memory changes
            for strat in self.strategies:
                if 'id' in strat:
                    # We only update keys that the engine controls
                    # Preserving any other keys or new entries
                    disk_map[strat['id']] = strat
            
            # Convert back to list
            final_list = list(disk_map.values())
            
            with open(STRATEGIES_FILE, 'w') as f:
                json.dump(final_list, f, indent=2)
        except Exception as e:
            self.log("System", f"Failed to save strategies: {str(e)}", "error")

    def fetch_data(self, symbol, timeframe, limit=100, exchange_id=None):
        target_exchange = exchange_id or 'binance'
        start_time = time.time()
        attempts = 3
        for i in range(attempts):
            try:
                adapter = self.get_adapter(target_exchange)
                ohlcv = adapter.fetch_ohlcv(symbol, timeframe, limit=limit)
                latency_ms = int((time.time() - start_time) * 1000)
                
                if ohlcv:
                    df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
                    
                    # Update Feed Health
                    self.update_feed_health(target_exchange, symbol, timeframe, latency_ms, df)
                    
                    if not pd.api.types.is_datetime64_any_dtype(df['timestamp']):
                        df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
                    return df
                return None
            except Exception as e:
                err_msg = str(e)
                if i < attempts - 1:
                    time.sleep(1) # Wait 1s and retry
                    continue
                self.log("Exchange", f"Failed to fetch data for {symbol} on {target_exchange} after {attempts} attempts: {err_msg}", "warning")
                return None

    def update_feed_health(self, exchange_id, symbol, timeframe, latency, df):
        try:
            now = datetime.now()
            last_candle_time = df['timestamp'].iloc[-1]
            
            # Convert to datetime if it's not (though it should be by now)
            if not isinstance(last_candle_time, datetime):
                if isinstance(last_candle_time, (int, float)):
                    last_candle_time = pd.to_datetime(last_candle_time, unit='ms')
                else:
                    last_candle_time = pd.to_datetime(last_candle_time)
            
            # Calculate staleness
            staleness = (now - last_candle_time).total_seconds()
            
            # Determine threshold: 2x timeframe or 5 mins, whichever is greater
            tf_seconds = 60
            if 'm' in timeframe: tf_seconds = int(timeframe.replace('m', '')) * 60
            elif 'h' in timeframe: tf_seconds = int(timeframe.replace('h', '')) * 3600
            elif 'd' in timeframe: tf_seconds = int(timeframe.replace('d', '')) * 86400
            
            is_stale = staleness > max(tf_seconds * 1.5, 300) # 1.5x TF or 5m
            
            feed_key = f"{exchange_id}|{symbol}|{timeframe}"
            self.feed_health[feed_key] = {
                "exchange": exchange_id,
                "symbol": symbol,
                "timeframe": timeframe,
                "latency_ms": latency,
                "last_update": now.isoformat(),
                "last_candle": last_candle_time.isoformat(),
                "staleness_sec": int(staleness),
                "status": "healthy" if not is_stale and latency < 2000 else "degraded" if latency < 5000 else "unstable",
                "is_stale": is_stale
            }
            
            if is_stale:
                self.log("System", f"⚠️ DATA FEED STALE: {feed_key} is {int(staleness)}s behind!", "warning")
            elif latency > 2000:
                self.log("System", f"🐢 HIGH LATENCY: {feed_key} took {latency}ms", "warning")
                
        except Exception as e:
            print(f"Error updating feed health: {e}")

    def is_feed_safe(self, exchange_id, symbol, timeframe):
        """Check if the feed is stable enough for a NEW entry."""
        feed_key = f"{exchange_id}|{symbol}|{timeframe}"
        health = self.feed_health.get(feed_key)
        
        if not health:
            return True # Assume safe if no data yet (first run)
            
        if health.get('is_stale'):
            self.log("Safety", f"Feed for {feed_key} is STALE ({health['staleness_sec']}s). Safety Interlock ACTIVE.", "warning")
            return False
            
        if health.get('latency_ms', 0) > 5000:
            self.log("Safety", f"Feed for {feed_key} has CRITICAL LATENCY ({health['latency_ms']}ms). Safety Interlock ACTIVE.", "warning")
            return False
            
        if health.get('status') == 'unstable':
            self.log("Safety", f"Feed for {feed_key} is UNSTABLE. Safety Interlock ACTIVE.", "warning")
            return False
            
        return True

    def save_feed_health(self):
        try:
            with open(FEED_HEALTH_FILE, 'w') as f:
                json.dump({
                    "timestamp": datetime.now().isoformat(),
                    "feeds": self.feed_health
                }, f, indent=2)
        except Exception as e:
            print(f"Failed to save feed health: {e}")

    def calculate_indicators(self, df):
        if df is None or len(df) < 14: return df
        window = 14
        delta = df['close'].diff()
        gain = (delta.where(delta > 0, 0)).fillna(0)
        loss = (-delta.where(delta < 0, 0)).fillna(0)
        avg_gain = gain.rolling(window=window).mean()
        avg_loss = loss.rolling(window=window).mean()
        rs = avg_gain / avg_loss
        df['rsi'] = 100 - (100 / (1 + rs))
        return df

    def execute_strategy(self, strategy, symbol, df):
        if df is None or df.empty: return
        
        sid = strategy.get('id')
        status = strategy.get('status', 'active')
        current_pos = strategy.get('position')
        
        # --- PAUSE HANDLING ---
        if status == 'paused':
            if current_pos:
                # Emergency Exit: Position open but strategy paused
                self.log("Strategy", f"⚠️ EMERGENCY EXIT: {sid} ({symbol}) paused with open {current_pos}. Closing immediately...", "warning")
                # Trigger exit logic by setting signal to opposite of position
                price = df['close'].iloc[-1]
                entry_price = strategy.get('entry_price', price)
                capital = float(strategy.get('capital', 1000))
                leverage = strategy.get('leverage', 1)
                
                # Calculate final PnL for logging
                if current_pos == 'long':
                    final_pnl_perc = ((price - entry_price) / entry_price) * 100
                    signal = 'SELL'
                else:
                    final_pnl_perc = ((entry_price - price) / entry_price) * 100
                    signal = 'BUY'
                
                # Execute exit (bypass normal signal logic)
                self.execute_trade_exit(strategy, symbol, signal, price, "Strategy Paused", final_pnl_perc)
                return
            else:
                # Idle when paused
                return

        # Unique identification
        sid = strategy.get('instanceName') or strategy['strategyId']
        
        # Check Cooldown
        if sid in self.cooldowns:
            if datetime.now() < self.cooldowns[sid]:
                return # Skip execution during cooldown
            else:
                del self.cooldowns[sid] # Cooldown expired


        last_row = df.iloc[-1]
        price = float(last_row['close'])
        
        signal = None
        reason_desc = None
        current_signals = {}
        
        strategy_type = strategy.get('type', 'TECHNICAL')
        
        if 'position' not in strategy: strategy['position'] = None
        current_pos = strategy['position']
        leverage = int(strategy.get('leverage', 5))
        exchange_id = strategy.get('exchange', 'binance').lower()
        is_paper = strategy.get('mode', 'paper') != 'live'

        if strategy_type == 'AI_AGENT':
            ai_decision = self.ai_agent.analyze_market(symbol, strategy.get('timeframe', '1h'), df)
            signal = ai_decision.get('action') 
            reason_desc = f"AI: {ai_decision.get('reason')} (Conf: {ai_decision.get('confidence')}%)"
            if ai_decision.get('confidence', 0) < 75: signal = 'HOLD'
            current_signals = {"ai_confidence": ai_decision.get('confidence')}
        else:
            # UNIFIED STRATEGY LOGIC CALL
            from strategy_logic import StrategyLogic
            signal, meta = StrategyLogic.get_signal(strategy, df)
            reason_desc = meta.get('reason', 'Technical Signal')
            current_signals = meta
            
        # Logging for visibility
        if signal:
            self.log("Strategy", f"{sid} Checked: {signal} | {reason_desc}", "info")
        
        # Unique identification for logs
        sid = strategy.get('instanceName') or strategy['strategyId']
        timeframe = strategy.get('timeframe')
        exchange_id = strategy.get('exchange', 'binance')
        is_paper = strategy.get('is_paper', True)

        # SLIPPAGE BUFFER: Adjust price based on latency to prevent slippage losses
        feed_key = f"{exchange_id}|{symbol}|{timeframe}"
        health = self.feed_health.get(feed_key, {})
        latency_ms = health.get('latency_ms', 0)
        
        # Base slippage 0.1% for every 1s of latency
        slippage_mult = (latency_ms / 1000) * 0.001 
        
        # Adjusted price for risk calculation and simulated entry
        # If signal is BUY, we assume price moved UP during latency. 
        # If signal is SELL, we assume price moved DOWN during latency.
        exec_price = price
        if latency_ms > 500: # Only apply above 500ms
            if signal == 'BUY':
                exec_price = price * (1 + slippage_mult)
            elif signal == 'SELL':
                exec_price = price * (1 - slippage_mult)
            
            if abs(exec_price - price) / price > 0.0001:
                self.log("Safety", f"Applied {slippage_mult*100:.3f}% latency slippage to {sid}. Price: {price} -> {exec_price:.4f}", "info")

        # PnL Calculation (Using adjusted price for realism)
        if current_pos:
            entry_price = strategy.get('entry_price', price)
            capital = float(strategy.get('capital', 1000))
            if current_pos == 'long':
                pnl_perc = ((price - entry_price) / entry_price) * 100
            else: # short
                pnl_perc = ((entry_price - price) / entry_price) * 100
            
            # LIVE STATE UPDATE
            strategy['unrealizedPnL'] = (capital * (pnl_perc/100)) * leverage
            strategy['unrealizedPnLPerc'] = pnl_perc
            
            # --- ADVANCED EXIT LOGIC (SL/TP) ---
            # If current_sl/tp are not set, initialize them
            if 'current_sl' not in strategy or strategy['current_sl'] is None:
                sl_perc = float(strategy.get('params', {}).get('stop_loss', 0.02))
                if current_pos == 'long':
                    strategy['current_sl'] = entry_price * (1 - sl_perc)
                else:
                    strategy['current_sl'] = entry_price * (1 + sl_perc)
            
            if 'current_tp' not in strategy or strategy['current_tp'] is None:
                tp_perc = float(strategy.get('params', {}).get('take_profit', 0.05))
                if current_pos == 'long':
                    strategy['current_tp'] = entry_price * (1 + tp_perc)
                else:
                    strategy['current_tp'] = entry_price * (1 - tp_perc)

            # --- UNIVERSAL TRAILING SL FALLBACK ---
            # If no trailing_sl_perc is in params, we apply a safety 2% trailing loop if trade is > 3% in profit
            trailing_sl_perc = float(strategy.get('params', {}).get('trailing_sl_perc', 0))
            if trailing_sl_perc == 0:
                 # Default safety: 1% Trailing if trade is 3% in profit
                 if pnl_perc >= 3.0:
                      trailing_sl_perc = 0.01 
                      self.log("Strategy", f"{sid}: Enabling Global Safety Trailing SL (1%) at 3% profit.", "info")

            if 'highest_price' not in strategy: strategy['highest_price'] = entry_price
            if 'lowest_price' not in strategy: strategy['lowest_price'] = entry_price

            # Update Extremes
            if current_pos == 'long' and price > strategy['highest_price']:
                strategy['highest_price'] = price
                # Trailing SL update (using local trailing_sl_perc with fallback)
                if trailing_sl_perc > 0:
                    new_sl = price * (1 - trailing_sl_perc)
                    if new_sl > strategy['current_sl']:
                        strategy['current_sl'] = new_sl
                        self.log("Strategy", f"{sid} moved Trailing SL up to {new_sl:.2f}", "info")
            
            elif current_pos == 'short' and price < strategy['lowest_price']:
                strategy['lowest_price'] = price
                # Trailing SL update (short)
                if trailing_sl_perc > 0:
                    new_sl = price * (1 + trailing_sl_perc)
                    if new_sl < strategy['current_sl']:
                        strategy['current_sl'] = new_sl
                        self.log("Strategy", f"{sid} moved Trailing SL down to {new_sl:.2f}", "info")

            # Check Automated Exits
            if current_pos == 'long':
                if price <= strategy['current_sl']:
                    signal = 'SELL'
                    reason_desc = f"Stop Loss Hit @ {strategy['current_sl']:.2f}"
                elif price >= strategy['current_tp']:
                    tp_extension = float(strategy.get('params', {}).get('tp_extension_factor', 0))
                    if tp_extension > 0:
                        # Extend!
                        strategy['current_sl'] = strategy['current_tp'] # Lock in profit
                        strategy['current_tp'] *= (1 + tp_extension)
                        strategy['tp_count'] = strategy.get('tp_count', 0) + 1
                        self.log("Strategy", f"{sid} TP extension! New TP: {strategy['current_tp']:.2f}, SL: {strategy['current_sl']:.2f}", "success")
                        signal = 'HOLD' # Don't exit yet
                    else:
                        signal = 'SELL'
                        reason_desc = f"Take Profit Hit @ {strategy['current_tp']:.2f}"
            
            elif current_pos == 'short':
                if price >= strategy['current_sl']:
                    signal = 'BUY'
                    reason_desc = f"Stop Loss Hit @ {strategy['current_sl']:.2f}"
                elif price <= strategy['current_tp']:
                    tp_extension = float(strategy.get('params', {}).get('tp_extension_factor', 0))
                    if tp_extension > 0:
                        strategy['current_sl'] = strategy['current_tp'] # Lock in profit
                        strategy['current_tp'] *= (1 - tp_extension)
                        strategy['tp_count'] = strategy.get('tp_count', 0) + 1
                        self.log("Strategy", f"{sid} TP extension (Short)! New TP: {strategy['current_tp']:.2f}, SL: {strategy['current_sl']:.2f}", "success")
                        signal = 'HOLD'
                    else:
                        signal = 'BUY'
                        reason_desc = f"Take Profit Hit @ {strategy['current_tp']:.2f}"

            strategy['unrealizedPnL'] = (capital * (pnl_perc / 100)) * leverage
            strategy['unrealizedPnLPerc'] = pnl_perc * leverage
        else:
            strategy['unrealizedPnL'] = 0
            strategy['unrealizedPnLPerc'] = 0
            # Reset advanced exit state for next trade
            strategy['current_sl'] = None
            strategy['current_tp'] = None
            strategy['tp_count'] = 0
            strategy['highest_price'] = 0
            strategy['lowest_price'] = 0

        # EXECUTION
        order_success = False
        order_id = None
        
        # SAFETY INTERLOCK: Block new entries if feed is degraded
        if signal in ['BUY', 'SELL'] and current_pos is None:
            if not self.is_feed_safe(exchange_id, symbol, strategy.get('timeframe')):
                self.log("Safety", f"BLOCKED entry signal for {sid} due to feed health protection.", "warning")
                signal = 'HOLD' # Downgrade to HOLD to prevent entry
        
        # 1. LONG ENTRY
        if signal == 'BUY' and current_pos is None:
            self.log("Execution", f"Attempting {exchange_id.upper()} BUY (LONG) for {sid}...", "info")
            try:
                if is_paper:
                    order_id = f"PAPER-BUY-{str(uuid.uuid4())[:8]}"
                    order_success = True
                else:
                    adapter = self.get_adapter(exchange_id, is_paper=False)
                    amount = (float(strategy.get('capital', 1000)) * leverage) / price
                    res = adapter.create_order(symbol, 'buy', 'market', amount, params={'leverage': leverage})
                    order_id = res.get('id', 'LIVE-ORDER')
                    order_success = True
                
                if order_success:
                    strategy['position'] = 'long'
                    strategy['entry_price'] = exec_price
                    self.log("Strategy", f"{sid} entered LONG at {exec_price:.4f} (Market: {price})", "success")
                    self.log_trade(strategy['strategyId'], symbol, "BUY", exec_price, reason=reason_desc, leverage=leverage, timeframe=strategy.get('timeframe'), entry_price=exec_price, capital=strategy.get('capital'), signals=current_signals, exchange=exchange_id, instance_id=sid)
            except Exception as e:
                self.log("Execution", f"Order failed on {exchange_id}: {e}", "error")

        # 2. SHORT ENTRY
        elif signal == 'SELL' and current_pos is None:
            self.log("Execution", f"Attempting {exchange_id.upper()} SELL (SHORT) for {sid}...", "info")
            try:
                if is_paper:
                    order_id = f"PAPER-SELL-{str(uuid.uuid4())[:8]}"
                    order_success = True
                else:
                    adapter = self.get_adapter(exchange_id, is_paper=False)
                    amount = (float(strategy.get('capital', 1000)) * leverage) / price
                    res = adapter.create_order(symbol, 'sell', 'market', amount, params={'leverage': leverage})
                    order_id = res.get('id', 'LIVE-ORDER')
                    order_success = True
                
                if order_success:
                    strategy['position'] = 'short'
                    strategy['entry_price'] = exec_price
                    self.log("Strategy", f"{sid} entered SHORT at {exec_price:.4f} (Market: {price})", "success")
                    self.log_trade(strategy['strategyId'], symbol, "SELL", exec_price, reason=reason_desc, leverage=leverage, timeframe=strategy.get('timeframe'), entry_price=exec_price, capital=strategy.get('capital'), signals=current_signals, exchange=exchange_id, instance_id=sid)
            except Exception as e:
                self.log("Execution", f"Order failed on {exchange_id}: {e}", "error")

        # 3. LONG EXIT
        elif signal == 'SELL' and current_pos == 'long':
            self.log("Execution", f"Closing {exchange_id.upper()} LONG for {sid}...", "info")
            try:
                if is_paper:
                    order_success = True
                else:
                    adapter = self.get_adapter(exchange_id, is_paper=False)
                    amount = (float(strategy.get('capital', 1000)) * leverage) / strategy.get('entry_price', price)
                    adapter.create_order(symbol, 'sell', 'market', amount)
                    order_success = True
                
                if order_success:
                    entry_price = strategy.get('entry_price', price)
                    final_pnl_perc = ((exec_price - entry_price) / entry_price) * 100
                    self.execute_trade_exit(strategy, symbol, 'SELL', exec_price, reason_desc, final_pnl_perc)
            except Exception as e:
                self.log("Execution", f"Exit failed on {exchange_id}: {e}", "error")

        # 4. SHORT EXIT
        elif signal == 'BUY' and current_pos == 'short':
            self.log("Execution", f"Closing {exchange_id.upper()} SHORT for {sid}...", "info")
            try:
                if is_paper:
                    order_success = True
                else:
                    adapter = self.get_adapter(exchange_id, is_paper=False)
                    amount = (float(strategy.get('capital', 1000)) * leverage) / strategy.get('entry_price', price)
                    adapter.create_order(symbol, 'buy', 'market', amount)
                    order_success = True
                
                if order_success:
                    entry_price = strategy.get('entry_price', price)
                    final_pnl_perc = ((entry_price - exec_price) / entry_price) * 100
                    self.execute_trade_exit(strategy, symbol, 'BUY', exec_price, reason_desc, final_pnl_perc)
            except Exception as e:
                self.log("Execution", f"Exit failed on {exchange_id}: {e}", "error")

        # self.save_strategies() # Removed: Done at end of loop to prevent thrashing

    def execute_trade_exit(self, strategy, symbol, side, price, reason, pnl_perc):
        sid = strategy.get('id')
        leverage = strategy.get('leverage', 1)
        entry_price = strategy.get('entry_price', price)
        capital = float(strategy.get('capital', 1000))
        exchange_id = strategy.get('exchange', 'binance').lower()

        try:
            # 1. Update State
            realized_pnl = (capital * (pnl_perc / 100)) * leverage
            strategy['trades'] = (strategy.get('trades', 0) or 0) + 1
            strategy['pnl'] = (strategy.get('pnl', 0) or 0) + realized_pnl
            strategy['pnlPerc'] = (strategy.get('pnlPerc', 0) or 0) + (pnl_perc * leverage)
            strategy['wins'] = (strategy.get('wins', 0) or 0) + (1 if pnl_perc > 0 else 0)
            strategy['winRate'] = round((strategy['wins'] / strategy['trades']) * 100, 2)
            strategy['position'] = None
            strategy['unrealizedPnL'] = 0
            strategy['unrealizedPnLPerc'] = 0
            strategy['current_sl'] = None
            strategy['current_tp'] = None
            strategy['tp_count'] = 0
            strategy['highest_price'] = 0
            strategy['lowest_price'] = 0

            # 2. Log Trade
            self.log("Strategy", f"{sid} closed {symbol} at {price} ({reason})", "success")
            self.log_trade(
                strategy['strategyId'], symbol, side, price, 
                pnl_perc=pnl_perc * leverage, reason=reason, 
                leverage=leverage, timeframe=strategy.get('timeframe'), 
                entry_price=entry_price, capital=capital, 
                exchange=exchange_id, instance_id=sid
            )

            # 3. Cooldown on Loss
            if pnl_perc < 0:
                self.cooldowns[sid] = datetime.now() + timedelta(minutes=15)
                self.log("Strategy", f"{sid} entering 15m cooldown after loss.", "warning")

        except Exception as e:
            self.log("Execution", f"Exit execution failed for {sid}: {e}", "error")

    def fetch_and_save_balance(self):
        try:
            total_output = {
                "timestamp": datetime.now().isoformat(),
                "exchanges": {},
                "total_value_usdt": 0.0,
                "source": "multi-exchange"
            }
            
            exchanges_to_fetch = set(s.get('exchange', 'binance').lower() for s in self.strategies if s.get('mode') == 'live')
            if os.getenv('COINDCX_API_KEY'): exchanges_to_fetch.add('coindcx')

            for ex_id in exchanges_to_fetch:
                # Retry Logic for Balance
                for attempt in range(2): # Reduced retries
                    try:
                        self.log("System", f"Fetching balance for {ex_id}...", "info")
                        adapter = self.get_adapter(ex_id, is_paper=False)
                        # Skip if adapter is just the default fallback for private requests
                        if ex_id != 'binance' and adapter == self.default_exchange:
                             continue
                             
                        bal = adapter.fetch_balance()
                        if bal and 'total' in bal:
                            ex_total = bal.get('total', {})
                            filtered_bal = {k: v for k, v in ex_total.items() if v > 0}
                            total_output["exchanges"][ex_id] = {
                                "assets": filtered_bal,
                                "usdt_value": filtered_bal.get('USDT', 0) 
                            }
                            total_output["total_value_usdt"] += filtered_bal.get('USDT', 0)
                        break # Success, exit retry loop
                    except Exception as e:
                        if attempt == 1: # Fixed logical bug here too: attempt is 0, 1
                            self.log("System", f"Failed to fetch balance for {ex_id} after retries: {e}", "warning")
                        else:
                            time.sleep(1) # Wait 1s before retry

            BALANCE_FILE = os.path.join(DATA_DIR, 'balance.json')
            with open(BALANCE_FILE, 'w') as f:
                json.dump(total_output, f, indent=2)
        except Exception as e:
            self.log("System", f"Balance update failed: {e}", "error")

    def reconcile_open_positions(self):
        """Startup routine: Check all active positions against current mark price for SL breaches."""
        self.log("System", "Starting Startup Reconciliation for open positions...", "info")
        self.load_strategies()
        
        reconciled_count = 0
        for strategy in self.strategies:
            if strategy.get('status') == 'active' and strategy.get('position'):
                symbol = strategy.get('symbol', 'BTC/USDT')
                if '/' not in symbol: symbol += '/USDT'
                
                # Fetch current price
                df = self.fetch_data(symbol, strategy.get('timeframe', '1m'), limit=5)
                if df is not None and not df.empty:
                    last_price = float(df['close'].iloc[-1])
                    
                    # Manual SL/TP check (bypass next() logic for speed)
                    entry_price = strategy.get('entry_price', last_price)
                    current_sl = strategy.get('current_sl')
                    current_pos = strategy.get('position')
                    
                    # If SL wasn't set, it will be set in the first loop of execute_strategy, 
                    # but for reconciliation we look at the 'stop_loss' param as safety.
                    if current_sl is None:
                        sl_perc = float(strategy.get('params', {}).get('stop_loss', 0.02))
                        if current_pos == 'long':
                            current_sl = entry_price * (1 - sl_perc)
                        else:
                            current_sl = entry_price * (1 + sl_perc)

                    # Trigger Exit if price is beyond SL
                    triggered = False
                    if current_pos == 'long' and last_price <= current_sl:
                        triggered = True
                        reason = f"RECONCILE: Priority SL Exit (Price {last_price:.2f} <= SL {current_sl:.2f})"
                        side = 'SELL'
                    elif current_pos == 'short' and last_price >= current_sl:
                        triggered = True
                        reason = f"RECONCILE: Priority SL Exit (Price {last_price:.2f} >= SL {current_sl:.2f})"
                        side = 'BUY'
                    
                    if triggered:
                        self.log("System", f"⚠️ REPAIRING TRADE: {strategy.get('id')} ({symbol}) breached SL while offline. Closing...", "warning")
                        # Recalculate PnL for logging
                        if current_pos == 'long':
                            pnl_perc = ((last_price - entry_price) / entry_price) * 100
                        else:
                            pnl_perc = ((entry_price - last_price) / entry_price) * 100
                        
                        self.execute_trade_exit(strategy, symbol, side, last_price, reason, pnl_perc)
                        reconciled_count += 1
        
        if reconciled_count > 0:
            self.log("System", f"Reconciliation complete. Repaired {reconciled_count} trades.", "success")
            self.save_strategies()
        else:
            self.log("System", "Reconciliation complete. No bad trades found.", "info")

    def run(self):
        self.log("System", "Engine Loop Starting. Performing initial reconciliation...", "info")
        # --- RECONCILIATION ON STARTUP ---
        try:
            self.reconcile_open_positions()
        except Exception as e:
            self.log("System", f"Startup Reconciliation Error: {e}", "error")
            
        while True:
            try:
                self.update_heartbeat()
                
                # 1. Load Strategies
                self.load_strategies()
                
                # 2. Update Balance (Non-blocking failure)
                try:
                    self.fetch_and_save_balance()
                except Exception as e:
                    self.log("System", f"Balance update failed: {e}", "error")

                # --- 2b. AlphaXGB Hourly Retraining ---
                if datetime.now() - self.last_ml_training > timedelta(hours=1):
                    self.log("System", "🧠 AlphaXGB: Scheduled hourly re-training starting...", "info")
                    try:
                        training_script = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'scripts/train_alphaxgb.py')
                        audit_script = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'scripts/model_efficiency_audit.py')
                        
                        os.system(f'python3 "{training_script}"')
                        os.system(f'python3 "{audit_script}"')
                        
                        self.last_ml_training = datetime.now()
                        self.log("System", "✅ AlphaXGB: Re-training and Efficiency Audit complete.", "success")
                    except Exception as e:
                        self.log("System", f"❌ AlphaXGB training/audit failed: {e}", "error")
            
                active_count = 0
                processed_symbols = {} 

                for strategy in self.strategies:
                    if strategy.get('status') != 'active': continue
                    active_count += 1
                    
                    ex_id = strategy.get('exchange', 'binance').lower()
                    symbol = strategy.get('symbol') or strategy.get('coin') or 'BTC/USDT'
                    if '/' not in symbol: symbol += '/USDT'
                    timeframe = strategy.get('timeframe', '1m')
                    
                    cache_key = (ex_id, symbol, timeframe)
                    if cache_key not in processed_symbols:
                        self.log("System", f"Fetching {timeframe} data for {symbol} on {ex_id}...", "info")
                        processed_symbols[cache_key] = self.fetch_data(symbol, timeframe, exchange_id=ex_id)
                    
                    df = processed_symbols[cache_key]
                    if df is not None:
                        df = self.calculate_indicators(df)
                        self.execute_strategy(strategy, symbol, df)
                
                if active_count == 0:
                    self.log("System", "No active strategies found. Waiting...", "warning")

            except Exception as e:
                self.log("System", f"Critical Error in Engine Loop: {e}", "error")
                time.sleep(5) # RECOVERY SLEEP to prevent rapid retry loops on persistent errors (e.g. Disk Full)
            
            # Save state once per loop iteration
            try:
                self.save_strategies()
                self.save_feed_health()
            except Exception as e:
                self.log("System", f"State save failed: {e}", "error")
            
            time.sleep(2) # ACCELERATED POLLING (User Approved)

if __name__ == "__main__":
    engine = ExecutionEngine()
    engine.run()
