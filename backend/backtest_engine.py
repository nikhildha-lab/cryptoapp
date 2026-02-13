
import os
import sys
import json
import time
import pandas as pd
import numpy as np
import ccxt
from datetime import datetime
import logging
# Add backend to path for AI Agent import
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
try:
    from ai_agent import AIAgent
except ImportError:
    AIAgent = None

try:
    from exchanges.factory import get_exchange_adapter
except ImportError:
    # Handle if running from different path or structure
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    from exchanges.factory import get_exchange_adapter

# Setup Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger("BacktestEngine")

class BacktestEngine:
    def __init__(self, initial_capital=1000.0, maker_fee=0.001, taker_fee=0.001, exchange_id='binance'):
        self.initial_capital = initial_capital
        self.maker_fee = maker_fee
        self.taker_fee = taker_fee
        self.exchange_id = exchange_id
        
        # Load exchange adapter for historical data
        self.adapter = get_exchange_adapter(exchange_id, is_paper=True)
        
        # State
        self.balance = initial_capital
        self.position = None # { 'type': 'long'|'short', 'entry_price': float, 'amount': float }
        self.trades = []
        self.equity_curve = []
        
        # Init AI Agent if needed
        # Force Backtest Mode for Engine
        os.environ['AI_BACKTEST_MODE'] = 'true'
        self.ai_agent = AIAgent() if AIAgent else None
        
    def fetch_historical_data(self, symbol, timeframe, start_date, end_date):
        """
        Fetches historical OHLCV data using the selected exchange adapter
        """
        logger.info(f"Fetching historical data for {symbol} ({timeframe}) from {self.exchange_id.upper()} ({start_date} to {end_date})...")
        
        since = self.adapter.exchange.parse8601(f"{start_date}T00:00:00Z")
        end_ts = self.adapter.exchange.parse8601(f"{end_date}T23:59:59Z")
        
        all_ohlcv = []
        while since < end_ts:
            try:
                ohlcv = self.adapter.fetch_ohlcv(symbol, timeframe, since=since, limit=1000)
                if not ohlcv:
                    break
                
                since = ohlcv[-1][0] + 1 # Next timestamp
                all_ohlcv.extend(ohlcv)
                
                # Check if we passed end_date
                if since > end_ts:
                    break
                    
                time.sleep(0.05) # Rate limit respect
            except Exception as e:
                logger.error(f"Error fetching data from {self.exchange_id}: {e}")
                break
                
        if not all_ohlcv:
            return None
            
        df = pd.DataFrame(all_ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
        df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
        
        # Filter by date range strictly
        mask = (df['timestamp'] >= start_date) & (df['timestamp'] <= end_date)
        df = df.loc[mask]
        
        logger.info(f"Loaded {len(df)} candles.")
        return df

    def calculate_indicators(self, df):
        """
        Calculates standard indicators (RSI, MAXD, etc.) used by strategies.
        Same logic as ExecutionEngine to ensure consistency.
        """
        # RSI
        window = 14
        delta = df['close'].diff()
        gain = (delta.where(delta > 0, 0)).fillna(0)
        loss = (-delta.where(delta < 0, 0)).fillna(0)
        
        avg_gain = gain.rolling(window=window).mean()
        avg_loss = loss.rolling(window=window).mean()
        
        rs = avg_gain / avg_loss
        df['rsi'] = 100 - (100 / (1 + rs))
        
        # MACD (Simple version)
        exp12 = df['close'].ewm(span=12, adjust=False).mean()
        exp26 = df['close'].ewm(span=26, adjust=False).mean()
        df['macd'] = exp12 - exp26
        df['signal'] = df['macd'].ewm(span=9, adjust=False).mean()
        
        return df

    def run(self, strategy_config, start_date, end_date):
        """
        Runs the backtest simulation.
        """
        symbol = strategy_config.get('symbol', 'BTC/USDT')
        timeframe = strategy_config.get('timeframe', '1h')
        
        # 1. Load Data
        df = self.fetch_historical_data(symbol, timeframe, start_date, end_date)
        if df is None or df.empty:
            logger.error("No data found for backtest.")
            return None
            
        # 2. Add Indicators (PRE-COMPUTE for Speed)
        from strategy_logic import StrategyLogic
        df = StrategyLogic.calculate_indicators(df)
        
        # 3. Simulate Loop
        logger.info("Starting Simulation...")
        
        for i, row in df.iterrows():
            # Get data slice up to current row (to simulate real-time)
            # Optimization: Pass full DF but only look at index i for vectorization?
            # For strict simulation of logic that might look back, we pass 'row' and maybe 'prev_row'
            
            # Access current values
            price = row['close']
            timestamp = row['timestamp']
            
            # CALL UNIFIED STRATEGY LOGIC
            # IMPORTANT: We need to pass a "View" of the DF up to this point for things that check lookback (like Fractals)
            # AND we need to pass the 'row' for simple checks.
            # StrategyLogic.get_signal(config, df) normally takes full DF and looks at ILOC[-1].
            # So, for backtesting, we ideally pass 'df.iloc[:i+1]'
            
            # performance note: df.iloc[:i+1] in a loop is expensive.
            # However, for 30 days of hourly data (720 rows), it is acceptable.
            
            current_slice = df.iloc[:i+1]
            
            # CRITICAL: Check SL/TP *before* signal processing using Candle High/Low
            if self.position:
                sl_hit, tp_hit = self._check_sl_tp(row, strategy_config)
                if sl_hit or tp_hit:
                    # If position closed by SL/TP, we shouldn't process new signals this bar typically,
                    # or we treat it as closed.
                    continue
            
            # ROUTING: AI Agent vs Standard
            
            # ROUTING: AI Agent vs Standard
            if strategy_config.get('type') == 'AI_AGENT':
                signal = self._get_signal(strategy_config, row, full_df=df)
            else:
                signal, meta = StrategyLogic.get_signal(strategy_config, current_slice)
                
            # --- EXECUTION LOGIC ---
            self._process_signal(signal, price, timestamp, strategy_config)
            
            # Track Equity
            current_equity = self.balance
            if self.position:
                # Mark to Market
                if self.position['type'] == 'long':
                    val = self.position['amount'] * price
                    current_equity = self.balance + val
                
            self.equity_curve.append({
                'timestamp': timestamp,
                'equity': current_equity
            })
            
        return self._generate_report()

    def _process_signal(self, signal, price, timestamp, config):
        leverage = config.get('leverage', 5)
        
        # ENTRY: BUY (LONG)
        if signal == "BUY":
            if self.position is None:
                # Open Long
                # effective_balance = self.balance * leverage
                amount = ((self.balance * 0.99) * leverage) / price 
                cost = amount * price
                fee = cost * self.taker_fee
                
                self.balance -= fee # Deduct fee from cash (simplified)
                # Actually, in spot/futures, balance logic differs. 
                # Simplified: We convert Cash to Asset.
                self.balance -= cost 
                
                self.position = {
                    'type': 'long',
                    'entry_price': price,
                    'amount': amount,
                    'entry_time': timestamp,
                    'highest_price': price,
                    'current_sl': price * (1 - config.get('stop_loss', 0.02)),
                    'current_tp': price * (1 + config.get('take_profit', 0.05)),
                    'tp_count': 0
                }
                self._log_trade("BUY", price, amount, timestamp, "ENTRY")
                
            elif self.position['type'] == 'short':
                # Close Short (Cover) + Open Long? Or just close?
                # For simplicity: Close Short if signal is BUY (exit short)
                self._close_position(price, timestamp)


        # ENTRY/EXIT: SELL
        elif signal == "SELL":
            if self.position and self.position['type'] == 'long':
                # Close Long
                self._close_position(price, timestamp)
            
            elif self.position is None:
                # Open Short? (If strategy supports it)
                pass # For now, simple Spot/Long-only logic for MVP

    def _close_position(self, price, timestamp, reason="EXIT"):
        if not self.position: return
        
        amount = self.position['amount']
        entry_price = self.position['entry_price']
        
        revenue = amount * price
        fee = revenue * self.taker_fee
        
        self.balance += (revenue - fee)
        
        pnl = revenue - (amount * entry_price) 
        pnl_perc = (pnl / (amount * entry_price)) * 100
        
        self._log_trade("SELL", price, amount, timestamp, reason, pnl=pnl, pnl_perc=pnl_perc)
        self.position = None

    def _check_sl_tp(self, row, config):
        """
        Checks if current candle High/Low hit SL or TP.
        Supports Trailing SL and Dynamic Target Scaling.
        Returns (sl_hit, tp_hit) booleans.
        """
        if not self.position: return False, False
        
        pos_type = self.position['type']
        timestamp = row['timestamp']
        
        # --- TRAILING STOP LOGIC ---
        trailing_sl_perc = config.get('trailing_sl_perc', 0)
        
        if pos_type == 'long':
            # Update Highest Price
            if row['high'] > self.position['highest_price']:
                self.position['highest_price'] = row['high']
                # If trailing is enabled, move SL up
                if trailing_sl_perc > 0:
                    new_sl = self.position['highest_price'] * (1 - trailing_sl_perc)
                    if new_sl > self.position['current_sl']:
                        self.position['current_sl'] = new_sl

            # Check SL
            if row['low'] <= self.position['current_sl']:
                self._close_position(self.position['current_sl'], timestamp, reason="TRAILING_STOP" if trailing_sl_perc > 0 else "STOP_LOSS")
                return True, False

            # Check TP (Dynamic Scaling)
            if row['high'] >= self.position['current_tp']:
                tp_extension = config.get('tp_extension_factor', 0)
                
                if tp_extension > 0:
                    # Move SL to old TP (lock in profit)
                    self.position['current_sl'] = self.position['current_tp']
                    # Extend TP
                    self.position['current_tp'] *= (1 + tp_extension)
                    self.position['tp_count'] += 1
                    # We don't close yet!
                    return False, False
                else:
                    self._close_position(self.position['current_tp'], timestamp, reason="TAKE_PROFIT")
                    return False, True
                    
        return False, False

    def _log_trade(self, side, price, amount, timestamp, type, pnl=0, pnl_perc=0):
        self.trades.append({
            'timestamp': timestamp,
            'side': side,
            'price': float(price),
            'amount': float(amount),
            'type': type,
            'pnl': float(pnl),
            'pnl_perc': float(pnl_perc),
            'balance_after': float(self.balance)
        })

    def _generate_report(self):
        df_trades = pd.DataFrame(self.trades)
        equity_series = pd.DataFrame(self.equity_curve)
        
        total_return = 0
        win_rate = 0
        max_drawdown = 0
        sharpe = 0
        
        if not df_trades.empty:
            # ROI
            final_equity = self.equity_curve[-1]['equity'] if self.equity_curve else self.balance
            total_return = ((final_equity - self.initial_capital) / self.initial_capital) * 100
            
            # Win Rate (Only count Exits)
            exits = df_trades[df_trades['side'] == 'SELL']
            if not exits.empty:
                wins = exits[exits['pnl'] > 0]
                win_rate = (len(wins) / len(exits)) * 100
                
            # Drawdown
            equity_series['peak'] = equity_series['equity'].cummax()
            equity_series['drawdown'] = (equity_series['equity'] - equity_series['peak']) / equity_series['peak']
            max_drawdown = equity_series['drawdown'].min() * 100
            
        report = {
            "initial_capital": self.initial_capital,
            "final_equity": self.equity_curve[-1]['equity'] if self.equity_curve else self.balance,
            "total_return_perc": round(total_return, 2),
            "total_trades": len(df_trades[df_trades['side'] == 'SELL']) if not df_trades.empty else 0,
            "win_rate": round(win_rate, 2),
            "max_drawdown": round(max_drawdown, 2),
            "trades": self.trades
        }
        return report

    def _get_signal(self, strategy, row, full_df=None):
        """
        Determines signal based on strategy type.
        """
        signal = "HOLD"
        
        strat_type = strategy.get('type', 'TECHNICAL')
        
        # 1. AI AGENT
        if strat_type == 'AI_AGENT':
            if self.ai_agent and full_df is not None:
                # We need to pass a slice of DF up to current timestamp for realistic simulation
                # Finding the index of current row
                idx = row.name
                # Slice: Get last 20 rows ending at idx
                # Assuming integer index; if datetime index, need different logic.
                # reset_index() was not called, so let's assume default range index from fetch_data?
                # Actually fetch_data returns result of pd.DataFrame() which has RangeIndex.
                
                # Safety check
                if isinstance(idx, int) and idx >= 5:
                    slice_df = full_df.iloc[idx-5:idx+1]
                else:
                    return "HOLD"

                # Call AI Agent (Mock or Real)
                # Note: Real AI calls in a backtest loop (30 days * 24h = 720 calls) will be slow and costly!
                # Ideally we mock or cache this. For now, we trust the agent's internal provider setting.
                
                ai_decision = self.ai_agent.analyze_market(strategy.get('symbol'), strategy.get('timeframe'), slice_df)
                signal = ai_decision.get('action')
                
                # Confidence check
                if ai_decision.get('confidence', 0) < strategy.get('min_confidence', 75):
                    signal = "HOLD"
                    
        # 2. MACD
        elif strat_type == 'MACD':
             macd = row.get('macd')
             sig_line = row.get('signal')
             
             if pd.notna(macd) and pd.notna(sig_line):
                 # Histogram
                 hist = macd - sig_line
                 
                 # Basic Trend Following:
                 # If MACD > Signal (Hist > 0) -> BUY
                 # If MACD < Signal (Hist < 0) -> SELL
                 if hist > 0:
                     signal = "BUY"
                 elif hist < 0:
                     signal = "SELL"
                 
        # 3. RSI (Default)
        else:
             rsi = row.get('rsi')
             oversold = strategy.get('oversold', 30)
             overbought = strategy.get('overbought', 70)
             
             if pd.notna(rsi):
                 if rsi < oversold:
                     signal = "BUY"
                 elif rsi > overbought:
                     signal = "SELL"
                     
        return signal

