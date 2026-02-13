
import pandas as pd
import numpy as np
import logging

# Configure Logging
logger = logging.getLogger("StrategyLogic")

class StrategyLogic:
    """
    Centralized logic store for all trading strategies.
    Uses Pandas for indicator calculation and signal generation.
    Ensures parity between Backtesting and Live Execution.
    """

    @staticmethod
    def get_signal(strategy_config, df):
        """
        Main dispatcher.
        Returns: 
            signal (BUY, SELL, HOLD), 
            metadata (dict with reason, indicators)
        """
        if df is None or df.empty:
            return "HOLD", {}

        strat_id = strategy_config.get('id', 'unknown')
        strat_type = strategy_config.get('type', 'TECHNICAL')
        
        # Dispatch based on ID or Type
        # We check specific IDs first for the advanced strategies
        
        # Normalize ID (Support "trend-momentum-1h-optimized" -> "trend-momentum")
        # Check 'strategy' key in params first (most reliable for optimizers)
        base_id = strategy_config.get('strategy', strat_id)
        
        # If still suffixed, try stripping
        if '-optimized' in base_id:
             # Basic heuristic: try to match known keys
             if 'ndrt' in base_id: base_id = 'ndrt-strategy'
             elif 'volatility' in base_id: base_id = 'volatility-scalper'
             elif 'triple' in base_id: base_id = 'triple-confirmation'
             elif 'trend' in base_id: base_id = 'trend-momentum'
             elif 'mean' in base_id: base_id = 'mean-reversion-pro'
        
        if base_id == 'ndrt-strategy':
            return StrategyLogic.ndrt_strategy(df, strategy_config)
            
        elif base_id == 'volatility-scalper':
            return StrategyLogic.volatility_scalper(df, strategy_config)
            
        elif base_id == 'triple-confirmation':
            return StrategyLogic.triple_confirmation(df, strategy_config)
            
        elif base_id == 'trend-momentum':
            return StrategyLogic.trend_momentum(df, strategy_config)
            
        elif base_id == 'mean-reversion-pro':
            return StrategyLogic.mean_reversion_pro(df, strategy_config)
            
        # Fallback to generic types
        if strat_type == 'MACD':
            return StrategyLogic.macd_simple(df, strategy_config)
        elif strat_type == 'AI_AGENT':
            # AI logic is handled by the caller (engine) usually, but we can return neutral here
            return "HOLD", {"reason": "AI Strategy handled externally"}
        else:
            return StrategyLogic.rsi_simple(df, strategy_config)


    # =========================================
    # HELPER: Indicator Calculations
    # =========================================
    @staticmethod
    def calculate_indicators(df):
        """
        Enrich dataframe with common indicators if not already present.
        """
        # RSI
        if 'rsi' not in df.columns:
            delta = df['close'].diff()
            gain = (delta.where(delta > 0, 0)).fillna(0)
            loss = (-delta.where(delta < 0, 0)).fillna(0)
            avg_gain = gain.rolling(window=14).mean()
            avg_loss = loss.rolling(window=14).mean()
            rs = avg_gain / avg_loss
            df['rsi'] = 100 - (100 / (1 + rs))

        # MACD
        if 'macd' not in df.columns:
            exp12 = df['close'].ewm(span=12, adjust=False).mean()
            exp26 = df['close'].ewm(span=26, adjust=False).mean()
            df['macd'] = exp12 - exp26
            df['signal'] = df['macd'].ewm(span=9, adjust=False).mean()
            df['hist'] = df['macd'] - df['signal']

        # EMAs
        if 'ema_fast' not in df.columns:
            df['ema_fast'] = df['close'].ewm(span=9, adjust=False).mean()
        if 'ema_slow' not in df.columns:
            df['ema_slow'] = df['close'].ewm(span=21, adjust=False).mean()

        # Bollinger Bands (20, 2)
        if 'bb_upper' not in df.columns:
            sma20 = df['close'].rolling(window=20).mean()
            std20 = df['close'].rolling(window=20).std()
            df['bb_upper'] = sma20 + (std20 * 2)
            df['bb_lower'] = sma20 - (std20 * 2)

        # ATR (14)
        if 'atr' not in df.columns:
            high_low = df['high'] - df['low']
            high_close = np.abs(df['high'] - df['close'].shift())
            low_close = np.abs(df['low'] - df['close'].shift())
            ranges = pd.concat([high_low, high_close, low_close], axis=1)
            true_range = np.max(ranges, axis=1)
            df['atr'] = true_range.rolling(14).mean()

        # Volume SMA
        if 'vol_sma' not in df.columns:
            df['vol_sma'] = df['volume'].rolling(window=20).mean()

        # --- NEW ADVANCED INDICATORS (Phase 11) ---
        
        # 1. EMAs (21, 50, 200)
        for period in [21, 50, 200]:
            col = f'ema_{period}'
            if col not in df.columns:
                df[col] = df['close'].ewm(span=period, adjust=False).mean()

        # 2. VWAP (Rolling 24h approximation assuming 1h/15m candles? Or just rolling window?)
        # True VWAP resets daily. We'll use a Rolling VWAP (e.g., 20 periods) for short-term trend
        # or Cumulative VWAP since start of dataframe if short.
        # Let's use Rolling 24-period VWAP for responsiveness on 1h charts.
        if 'vwap' not in df.columns:
            v_price = df['volume'] * (df['high'] + df['low'] + df['close']) / 3
            df['vwap'] = v_price.rolling(24).sum() / df['volume'].rolling(24).sum()

        # 3. Order Flow Proxy: On-Balance Volume (OBV)
        if 'obv' not in df.columns:
            df['obv'] = (np.sign(df['close'].diff()) * df['volume']).fillna(0).cumsum()

        # 4. ADX (Average Directional Index)
        if 'adx' not in df.columns:
            # True Range
            high_low = df['high'] - df['low']
            high_close = abs(df['high'] - df['close'].shift())
            low_close = abs(df['low'] - df['close'].shift())
            tr = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
            
            # Directional Movement
            up_move = df['high'] - df['high'].shift()
            down_move = df['low'].shift() - df['low']
            
            plus_dm = np.where((up_move > down_move) & (up_move > 0), up_move, 0)
            minus_dm = np.where((down_move > up_move) & (down_move > 0), down_move, 0)
            
            # Smoothed (Wilders approx using EWM)
            alpha = 1/14
            tr_s = tr.ewm(alpha=alpha, adjust=False).mean()
            plus_di = 100 * (pd.Series(plus_dm).ewm(alpha=alpha, adjust=False).mean() / tr_s)
            minus_di = 100 * (pd.Series(minus_dm).ewm(alpha=alpha, adjust=False).mean() / tr_s)
            
            dx = 100 * abs(plus_di - minus_di) / (plus_di + minus_di)
            df['adx'] = dx.ewm(alpha=alpha, adjust=False).mean()

        return df

    # =========================================
    # 1. RSI Simple
    # =========================================
    @staticmethod
    def rsi_simple(df, config):
        df = StrategyLogic.calculate_indicators(df)
        last = df.iloc[-1]
        
        rsi = last['rsi']
        oversold = config.get('oversold', 30)
        overbought = config.get('overbought', 70)
        
        signal = "HOLD"
        reason = f"RSI Neutral ({rsi:.2f})"
        
        if rsi < oversold:
            signal = "BUY"
            reason = f"RSI Oversold ({rsi:.2f} < {oversold})"
        elif rsi > overbought:
            signal = "SELL"
            reason = f"RSI Overbought ({rsi:.2f} > {overbought})"
            
        return signal, {
            "rsi": round(rsi, 2),
            "reason": reason
        }

    # =========================================
    # 2. MACD Simple
    # =========================================
    @staticmethod
    def macd_simple(df, config):
        df = StrategyLogic.calculate_indicators(df)
        last = df.iloc[-1]
        
        hist = last['hist']
        signal = "HOLD"
        reason = f"MACD Neutral ({hist:.4f})"
        
        if hist > 0:
            signal = "BUY"
            reason = "MACD Bullish Crossover"
        elif hist < 0:
            signal = "SELL"
            reason = "MACD Bearish Crossover"
            
        return signal, {
            "macd_hist": round(hist, 4),
            "reason": reason
        }

    # =========================================
    # 3. NDRT Strategy (Fractal Breakout)
    # =========================================
    @staticmethod
    def ndrt_strategy(df, config):
        df = StrategyLogic.calculate_indicators(df)
        
        # Need at least 5 candles for fractal
        if len(df) < 5: return "HOLD", {}
        
        # REGIME FILTER: ADX > 25 (Trending)
        adx = df['adx'].iloc[-1]
        if adx < 25:
            return "HOLD", {"reason": f"Market Choppy (ADX {adx:.1f} < 25)"}

        
        # Simple Fractal: High[i-2] is highest of i-4...i
        # We need to find the LAST valid top/bottom fractal index
        
        # Logic approximation for vectorization:
        # Find local maxima/minima in rolling window 5
        # Center is at index 2 (middle)
        
        # Using shift to simulate looking at past fractals
        # A top fractal at index i means High[i] > High[i-1] and High[i] > High[i+1]
        # Since we are live, we look at completed candles.
        
        # Let's simple find the most recent fractal in the last 10 candles
        last_top = None
        last_bottom = None
        
        # Loop backwards from -2 (since -1 is current partial/just closed)
        for i in range(len(df)-2, len(df)-20, -1):
            if i < 2: break
            
            # Fractal Top
            if df['high'].iloc[i] > df['high'].iloc[i-1] and df['high'].iloc[i] > df['high'].iloc[i+1]:
                if last_top is None: last_top = df['high'].iloc[i]
                
            # Fractal Bottom
            if df['low'].iloc[i] < df['low'].iloc[i-1] and df['low'].iloc[i] < df['low'].iloc[i+1]:
                if last_bottom is None: last_bottom = df['low'].iloc[i]
                
            if last_top and last_bottom: break
            
        current_close = df['close'].iloc[-1]
        atr = df['atr'].iloc[-1]
        ema_50 = df['ema_50'].iloc[-1]
        
        # Breakout Buffer: 20% of ATR to confirm valid move
        buffer = atr * 0.2
        
        signal = "HOLD"
        reason = "No Breakout"
        
        meta = {}
        if last_top: meta['last_fractal_top'] = last_top
        if last_bottom: meta['last_fractal_bot'] = last_bottom
        
        # BUY: Breakout UP + Buffer + Above EMA 50 (Macro Trend)
        if last_top and current_close > (last_top + buffer) and current_close > ema_50:
            signal = "BUY"
            reason = f"Fractal Breakout Up ({current_close:.2f} > {last_top:.2f} + {buffer:.2f}) | Trend Bullish"
        
        # SELL: Breakout DOWN + Buffer + Below EMA 50 (Macro Trend)
        elif last_bottom and current_close < (last_bottom - buffer) and current_close < ema_50:
            signal = "SELL"
            reason = f"Fractal Breakout Down ({current_close:.2f} < {last_bottom:.2f} - {buffer:.2f}) | Trend Bearish"
            
        meta['reason'] = reason
        return signal, meta

    # =========================================
    # 4. Volatility Scalper
    # =========================================
    @staticmethod
    def volatility_scalper(df, config):
        df = StrategyLogic.calculate_indicators(df)
        
        # Params
        fast_period = config.get('fast_ema', 5)
        slow_period = config.get('slow_ema', 13)
        vol_mult = config.get('vol_multiplier', 1.5)
        
        # Custom Indicators for this strat
        df['ema_f'] = df['close'].ewm(span=fast_period, adjust=False).mean()
        df['ema_s'] = df['close'].ewm(span=slow_period, adjust=False).mean()
        
        last = df.iloc[-1]
        
        # Volatility Check (ATR normalized)
        # We need BTC volatility for comparison ideally, but if single symbol, we compare to own SMA?
        # The original strat compares Target Vol vs BTC Vol.
        # Limitation: execution_engine only passes ONE df.
        # Workaround: Use absolute volatility threshold or relative to own history.
        # Let's use: Current Vol > 1.5x Avg Vol
        
        vol_threshold = last['atr'] > (df['atr'].mean() * 1.0) # Simplified if no BTC Data
        # If we had BTC data passed in kwargs, we'd use it.
        
        crossover = last['ema_f'] > last['ema_s']
        crossunder = last['ema_f'] < last['ema_s']
        
        signal = "HOLD"
        reason = "Low Volatility or No Cross"
        
        if vol_threshold:
            if crossover:
                signal = "BUY"
                reason = "EMA Cross Up + High Vol"
            elif crossunder:
                signal = "SELL"
                reason = "EMA Cross Down + High Vol"
        else:
            reason = "Volatility too low for scalp"
            
        return signal, {
            "volatility": round(last['atr'], 4),
            "ema_fast": round(last['ema_f'], 2),
            "ema_slow": round(last['ema_s'], 2),
            "reason": reason
        }

    # =========================================
    # 5. Triple Confirmation
    # =========================================
    @staticmethod
    def triple_confirmation(df, config):
        df = StrategyLogic.calculate_indicators(df)
        last = df.iloc[-1]
        
        # 1. RSI
        rsi_bull = last['rsi'] < config.get('rsi_oversold', 30)
        rsi_bear = last['rsi'] > config.get('rsi_overbought', 70)
        
        # 2. MACD
        macd_bull = last['macd'] > last['signal']
        macd_bear = last['macd'] < last['signal']
        
        # 3. Volume
        vol_spike = last['volume'] > (last['vol_sma'] * config.get('volume_multiplier', 1.5))
        
        # REGIME FILTER: ADX > 20
        adx_trend = last['adx'] > 20

        
        signal = "HOLD"
        reason = "Conditions not met"
        
        # Checks
        if rsi_bull and macd_bull and vol_spike and adx_trend:
            signal = "BUY"
            reason = "TRIPLE CONFIRM: RSI + MACD + VOL + TRND"
        elif rsi_bear and macd_bear and vol_spike and adx_trend:
            signal = "SELL"
            reason = "TRIPLE CONFIRM: RSI + MACD + VOL + TRND"
        elif not adx_trend:
             reason = f"Trend too weak (ADX {last['adx']:.1f})"

            
        return signal, {
            "rsi": round(last['rsi'], 2),
            "macd": round(last['macd'], 4),
            "vol_ratio": round(last['volume']/last['vol_sma'], 2) if last['vol_sma'] else 0,
            "reason": reason
        }

    # =========================================
    # 6. Trend Momentum
    # =========================================
    @staticmethod
    def trend_momentum(df, config):
        df = StrategyLogic.calculate_indicators(df)
        
        # Additional: Stochastic, ADX
        # ADX Calculation (Simplified)
        if 'adx' not in df.columns:
             # Very rough approx for ADX without full ta-lib
             df['adx'] = df['atr'].rolling(14).mean() / df['close'] * 1000 # Dummy logic for now if lib missing
             # Proper ADX is complex to code from scratch in 2 mins.
             # We will use ATR trend as proxy: ATR Rising = Trend Strength?
             # Let's use simple EMA slope.
             pass
        
        last = df.iloc[-1]
        
        # Logic: Price > EMA + Stoch Oversold + ADX (Simulated)
        price_above_ema = last['close'] > last['ema_fast']
        price_below_ema = last['close'] < last['ema_fast']
        
        # Stoch (Simulated with RSI for now to avoid complexity blowup)
        # Using RSI as proxy for Stoch to ensure robustness without errors
        stoch_oversold = last['rsi'] < 30
        stoch_overbought = last['rsi'] > 70
        
        signal = "HOLD"
        reason = "Trend Weak"
        
        if price_above_ema and stoch_oversold and last['adx'] > 20:
            signal = "BUY"
            reason = "Trend Pullback (EMA + Osc)"
        elif price_below_ema and stoch_overbought and last['adx'] > 20:
            signal = "SELL"
            reason = "Trend Pullback (EMA + Osc)"
            
        return signal, {"reason": reason}

    # =========================================
    # 7. Mean Reversion Pro
    # =========================================
    @staticmethod
    def mean_reversion_pro(df, config):
        df = StrategyLogic.calculate_indicators(df)
        last = df.iloc[-1]
        
        # RSI < 30 + Price < Lower BB
        rsi_oversold = last['rsi'] < config.get('rsi_oversold', 30)
        rsi_overbought = last['rsi'] > config.get('rsi_overbought', 70)
        
        bb_low_hit = last['close'] <= last['bb_lower']
        bb_high_hit = last['close'] >= last['bb_upper']
        
        signal = "HOLD"
        reason = "No Extreme"
        
        if rsi_oversold and bb_low_hit:
            signal = "BUY"
            reason = "Double Extreme (RSI + BB Bot)"
        elif rsi_overbought and bb_high_hit:
            signal = "SELL"
            reason = "Double Extreme (RSI + BB Top)"
            
        return signal, {
            "rsi": round(last['rsi'], 2),
            "bb_lower": round(last['bb_lower'], 2),
            "reason": reason
        }
