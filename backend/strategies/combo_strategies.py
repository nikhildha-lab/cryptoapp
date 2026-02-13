"""
Advanced Multi-Indicator Combo Strategies
Optimized through systematic backtesting
"""

from .base import BaseStrategy
import backtrader as bt
from pydantic import BaseModel


class ComboStrategyParams(BaseModel):
    """Base parameters for combo strategies"""
    stop_loss: float = 0.02
    take_profit: float = 0.05
    trailing_sl_perc: float = 0.01


# 1. TRIPLE CONFIRMATION - RSI + MACD + Volume
class TripleConfirmationStrategy(BaseStrategy):
    """
    High-probability strategy combining RSI, MACD, and Volume confirmation
    Entry: RSI oversold + MACD bullish cross + Volume spike
    Exit: RSI overbought OR MACD bearish cross
    """
    params = (
        ('rsi_period', 14),
        ('rsi_oversold', 30),
        ('rsi_overbought', 70),
        ('macd_fast', 12),
        ('macd_slow', 26),
        ('macd_signal', 9),
        ('volume_multiplier', 2.0),
        ('stop_loss', 0.02),
        ('take_profit', 0.05),
    )

    def __init__(self):
        super().__init__()
        self.rsi = bt.indicators.RSI(self.data.close, period=self.params.rsi_period)
        self.macd = bt.indicators.MACD(
            self.data.close,
            period_me1=self.params.macd_fast,
            period_me2=self.params.macd_slow,
            period_signal=self.params.macd_signal
        )
        self.volume_sma = bt.indicators.SMA(self.data.volume, period=20)
        
    def next(self):
        # Risk management is handled by BaseStrategy.next() which calls self.manage_risk()
        super().next()
        
        if not self.position:
            # Triple confirmation checks
            rsi_oversold = self.rsi < self.params.rsi_oversold
            rsi_overbought = self.rsi > self.params.rsi_overbought
            
            macd_bullish = self.macd.macd > self.macd.signal
            macd_bearish = self.macd.macd < self.macd.signal
            
            # Enhanced volume filters
            volume_spike = self.data.volume > self.volume_sma * self.params.volume_multiplier
            # Liquidity filter: avoid low volume periods
            sufficient_liquidity = self.data.volume > self.volume_sma * 0.8
            
            # LONG Entry - with liquidity filter
            if rsi_oversold and macd_bullish and volume_spike and sufficient_liquidity:
                self.buy()
                
            # SHORT Entry - with liquidity filter
            elif rsi_overbought and macd_bearish and volume_spike and sufficient_liquidity:
                self.sell()

        else:
            # Exit conditions (Reverse logic or just standard exits)
            # Note: Risk management handles TP/SL/Trailing
            
            # Additional Technical Exit for Long
            if self.position.size > 0:
                if self.rsi > self.params.rsi_overbought or self.macd.macd < self.macd.signal:
                    self.close()
            
            # Additional Technical Exit for Short
            elif self.position.size < 0:
                if self.rsi < self.params.rsi_oversold or self.macd.macd > self.macd.signal:
                    self.close()
    
    def _check_stops(self):
        if self.position.size > 0:
            price = self.data.close[0]
            cost = self.position.price
            if price >= cost * (1 + self.params.take_profit):
                self.close()
            elif price <= cost * (1 - self.params.stop_loss):
                self.close()


# 2. TREND + MOMENTUM - EMA + Stochastic + ADX
class TrendMomentumStrategy(BaseStrategy):
    """
    Trend-following with momentum confirmation
    Entry: Price above EMA cloud + Stochastic oversold cross + ADX > 25
    Exit: Price below EMA OR Stochastic overbought
    """
    params = (
        ('ema_fast', 8),
        ('ema_slow', 21),
        ('stoch_period', 14),
        ('stoch_oversold', 20),
        ('stoch_overbought', 80),
        ('adx_period', 14),
        ('adx_threshold', 25),
        ('stop_loss', 0.025),
        ('take_profit', 0.06),
    )

    def __init__(self):
        super().__init__()
        self.ema_fast = bt.indicators.EMA(self.data.close, period=self.params.ema_fast)
        self.ema_slow = bt.indicators.EMA(self.data.close, period=self.params.ema_slow)
        self.stoch = bt.indicators.Stochastic(self.data, period=self.params.stoch_period)
        self.adx = bt.indicators.ADX(self.data, period=self.params.adx_period)
        
    def next(self):
        super().next()
        
        if not self.position:
            # Trend + Momentum checks
            price_above_ema = self.data.close > self.ema_fast > self.ema_slow
            price_below_ema = self.data.close < self.ema_fast < self.ema_slow
            
            stoch_oversold_cross = self.stoch.percK[-1] < self.params.stoch_oversold and self.stoch.percK > self.stoch.percD
            stoch_overbought_cross = self.stoch.percK[-1] > self.params.stoch_overbought and self.stoch.percK < self.stoch.percD
            
            strong_trend = self.adx > self.params.adx_threshold
            
            # LONG Entry
            if price_above_ema and stoch_oversold_cross and strong_trend:
                self.buy()
                
            # SHORT Entry
            elif price_below_ema and stoch_overbought_cross and strong_trend:
                self.sell()

        else:
            # Enhanced exits with ADX weakening
            weak_trend = self.adx < 20  # Trend is weakening
            
            if self.position.size > 0:
                # Long Exit
                if self.data.close < self.ema_fast or self.stoch.percK > self.params.stoch_overbought or weak_trend:
                    self.close()
            elif self.position.size < 0:
                # Short Exit
                if self.data.close > self.ema_fast or self.stoch.percK < self.params.stoch_oversold or weak_trend:
                    self.close()
    
    def _check_stops(self):
        if self.position.size > 0:
            price = self.data.close[0]
            cost = self.position.price
            if price >= cost * (1 + self.params.take_profit):
                self.close()
            elif price <= cost * (1 - self.params.stop_loss):
                self.close()


# 3. VOLATILITY BREAKOUT - Bollinger + ATR + Volume
class VolatilityBreakoutStrategy(BaseStrategy):
    """
    Breakout strategy with volatility confirmation
    Entry: Price breaks upper Bollinger + ATR expanding + Volume spike
    Exit: Price touches middle Bollinger OR ATR contracting
    """
    params = (
        ('bb_period', 20),
        ('bb_devfactor', 2.0),
        ('atr_period', 14),
        ('atr_multiplier', 1.5),
        ('volume_multiplier', 2.0),
        ('stop_loss', 0.025),
        ('take_profit', 0.06),
    )

    def __init__(self):
        super().__init__()
        self.bb = bt.indicators.BollingerBands(
            self.data.close,
            period=self.params.bb_period,
            devfactor=self.params.bb_devfactor
        )
        self.atr = bt.indicators.ATR(self.data, period=self.params.atr_period)
        self.atr_sma = bt.indicators.SMA(self.atr, period=20)
        self.volume_sma = bt.indicators.SMA(self.data.volume, period=20)
        
    def next(self):
        super().next()
        
        if not self.position:
            # Breakout checks
            price_breaks_upper = self.data.close > self.bb.top
            price_breaks_lower = self.data.close < self.bb.bot
            
            atr_expanding = self.atr > self.atr_sma * self.params.atr_multiplier
            volume_spike = self.data.volume > self.volume_sma * self.params.volume_multiplier
            
            # LONG Entry
            if price_breaks_upper and atr_expanding and volume_spike:
                self.buy()
                
            # SHORT Entry
            elif price_breaks_lower and atr_expanding and volume_spike:
                self.sell()

        else:
            # Technical Exits
            price_at_mid = (self.data.close <= self.bb.mid) if self.position.size > 0 else (self.data.close >= self.bb.mid)
            atr_contracting = self.atr < self.atr_sma
            
            if price_at_mid or atr_contracting:
                self.close()
    
    def _check_stops(self):
        if self.position.size > 0:
            price = self.data.close[0]
            cost = self.position.price
            if price >= cost * (1 + self.params.take_profit):
                self.close()
            elif price <= cost * (1 - self.params.stop_loss):
                self.close()


# 4. MEAN REVERSION PRO - RSI + Bollinger + Williams %R
class MeanReversionProStrategy(BaseStrategy):
    """
    Advanced mean reversion with triple oscillator confirmation
    Entry: RSI < 30 + Price at lower BB + Williams %R < -80
    Exit: RSI > 70 OR Price at upper BB
    """
    params = (
        ('rsi_period', 14),
        ('rsi_oversold', 30),
        ('rsi_overbought', 70),
        ('bb_period', 20),
        ('bb_devfactor', 2.0),
        ('williams_period', 14),
        ('williams_oversold', -80),
        ('stop_loss', 0.02),
        ('take_profit', 0.05),
    )

    def __init__(self):
        super().__init__()
        self.rsi = bt.indicators.RSI(self.data.close, period=self.params.rsi_period)
        self.bb = bt.indicators.BollingerBands(
            self.data.close,
            period=self.params.bb_period,
            devfactor=self.params.bb_devfactor
        )
        self.williams = bt.indicators.WilliamsR(self.data, period=self.params.williams_period)
        
    def next(self):
        super().next()
        
        if not self.position:
            # Mean Reversion Checks
            rsi_oversold = self.rsi < self.params.rsi_oversold
            rsi_overbought = self.rsi > self.params.rsi_overbought
            
            at_lower_bb = self.data.close <= self.bb.bot
            at_upper_bb = self.data.close >= self.bb.top
            
            williams_oversold = self.williams < self.params.williams_oversold
            williams_overbought = self.williams > -20 # Williams%R is normally 0 to -100. > -20 is Overbought.
            
            # LONG Entry
            if rsi_oversold and at_lower_bb and williams_oversold:
                self.buy()
                
            # SHORT Entry
            elif rsi_overbought and at_upper_bb and williams_overbought:
                self.sell()

        else:
            # Technical Exits
            if self.position.size > 0:
                if self.rsi > self.params.rsi_overbought or self.data.close >= self.bb.top:
                    self.close()
            elif self.position.size < 0:
                if self.rsi < self.params.rsi_oversold or self.data.close <= self.bb.bot:
                    self.close()
    
    def _check_stops(self):
        if self.position.size > 0:
            price = self.data.close[0]
            cost = self.position.price
            if price >= cost * (1 + self.params.take_profit):
                self.close()
            elif price <= cost * (1 - self.params.stop_loss):
                self.close()


# 5. MOMENTUM SURGE - MACD + Stochastic + Volume
class MomentumSurgeStrategy(BaseStrategy):
    """
    Momentum-based strategy with dual oscillator confirmation
    Entry: MACD histogram increasing + Stochastic bullish cross + Volume spike
    Exit: MACD histogram decreasing OR Stochastic bearish cross
    """
    params = (
        ('macd_fast', 12),
        ('macd_slow', 26),
        ('macd_signal', 9),
        ('stoch_period', 14),
        ('volume_multiplier', 2.0),
        ('stop_loss', 0.02),
        ('take_profit', 0.05),
    )

    def __init__(self):
        super().__init__()
        self.macd = bt.indicators.MACD(
            self.data.close,
            period_me1=self.params.macd_fast,
            period_me2=self.params.macd_slow,
            period_signal=self.params.macd_signal
        )
        self.stoch = bt.indicators.Stochastic(self.data, period=self.params.stoch_period)
        self.volume_sma = bt.indicators.SMA(self.data.volume, period=20)
        
    def next(self):
        super().next()
        
        if not self.position:
            # Momentum checks
            macd_hist_increasing = self.macd.histo > self.macd.histo[-1] > 0
            macd_hist_decreasing = self.macd.histo < self.macd.histo[-1] < 0
            
            stoch_bullish_cross = self.stoch.percK > self.stoch.percD and self.stoch.percK[-1] <= self.stoch.percD[-1]
            stoch_bearish_cross = self.stoch.percK < self.stoch.percD and self.stoch.percK[-1] >= self.stoch.percD[-1]
            
            volume_spike = self.data.volume > self.volume_sma * self.params.volume_multiplier
            
            # LONG Entry
            if macd_hist_increasing and stoch_bullish_cross and volume_spike:
                self.buy()
                
            # SHORT Entry
            elif macd_hist_decreasing and stoch_bearish_cross and volume_spike:
                self.sell()

        else:
            # Technical Exits
            if self.position.size > 0:
                if self.macd.histo < self.macd.histo[-1] or (self.stoch.percK < self.stoch.percD):
                    self.close()
            elif self.position.size < 0:
                if self.macd.histo > self.macd.histo[-1] or (self.stoch.percK > self.stoch.percD):
                    self.close()
    
    def _check_stops(self):
        if self.position.size > 0:
            price = self.data.close[0]
            cost = self.position.price
            if price >= cost * (1 + self.params.take_profit):
                self.close()
            elif price <= cost * (1 - self.params.stop_loss):
                self.close()


# 6. SMART SCALPER - Fast EMA + RSI + Volume
class SmartScalperStrategy(BaseStrategy):
    """
    Quick scalping strategy with tight stops
    Entry: Price crosses above 5 EMA + RSI crosses 30 + Volume spike
    Exit: RSI > 70 OR 0.5% profit OR 0.3% loss
    """
    params = (
        ('ema_fast', 5),
        ('ema_slow', 13),
        ('rsi_period', 7),
        ('rsi_oversold', 30),
        ('rsi_overbought', 70),
        ('volume_multiplier', 1.5),
        ('stop_loss', 0.003),  # 0.3%
        ('take_profit', 0.008),  # 0.8%
    )

    def __init__(self):
        super().__init__()
        self.ema_fast = bt.indicators.EMA(self.data.close, period=self.params.ema_fast)
        self.ema_slow = bt.indicators.EMA(self.data.close, period=self.params.ema_slow)
        self.rsi = bt.indicators.RSI(self.data.close, period=self.params.rsi_period)
        self.volume_sma = bt.indicators.SMA(self.data.volume, period=20)
        
    def next(self):
        super().next()
        
        if not self.position:
            # Scalp checks
            ema_cross_up = self.data.close > self.ema_fast and self.ema_fast > self.ema_slow
            ema_cross_down = self.data.close < self.ema_fast and self.ema_fast < self.ema_slow
            
            rsi_cross_up = self.rsi[-1] < self.params.rsi_oversold and self.rsi > self.params.rsi_oversold
            rsi_cross_down = self.rsi[-1] > self.params.rsi_overbought and self.rsi < self.params.rsi_overbought
            
            volume_spike = self.data.volume > self.volume_sma * self.params.volume_multiplier
            
            # LONG Entry
            if ema_cross_up and rsi_cross_up and volume_spike:
                self.buy()
                
            # SHORT Entry
            elif ema_cross_down and rsi_cross_down and volume_spike:
                self.sell()

        else:
            # Technical Exits
            if self.position.size > 0:
                if self.rsi > self.params.rsi_overbought:
                    self.close()
            elif self.position.size < 0:
                if self.rsi < self.params.rsi_oversold:
                    self.close()
    
    def _check_stops(self):
        if self.position.size > 0:
            price = self.data.close[0]
            cost = self.position.price
            if price >= cost * (1 + self.params.take_profit):
                self.close()
            elif price <= cost * (1 - self.params.stop_loss):
                self.close()


# 7. TREND RIDER - Supertrend + ADX + EMA Cloud
class TrendRiderStrategy(BaseStrategy):
    """
    Strong trend-following strategy
    Entry: Supertrend bullish + ADX > 30 + Price above EMA cloud
    Exit: Supertrend bearish OR ADX < 20
    """
    params = (
        ('atr_period', 10),
        ('atr_multiplier', 3.0),
        ('adx_period', 14),
        ('adx_entry', 30),
        ('adx_exit', 20),
        ('ema_fast', 21),
        ('ema_slow', 55),
        ('stop_loss', 0.025),
        ('take_profit', 0.07),
    )

    def __init__(self):
        self.atr = bt.indicators.ATR(self.data, period=self.params.atr_period)
        self.adx = bt.indicators.ADX(self.data, period=self.params.adx_period)
        self.ema_fast = bt.indicators.EMA(self.data.close, period=self.params.ema_fast)
        self.ema_slow = bt.indicators.EMA(self.data.close, period=self.params.ema_slow)
        
        # Simple Supertrend calculation
        hl2 = (self.data.high + self.data.low) / 2
        self.basic_ub = hl2 + (self.params.atr_multiplier * self.atr)
        self.basic_lb = hl2 - (self.params.atr_multiplier * self.atr)
        
    def next(self):
        super().next()
        
        if not self.position:
            # Trend checks
            price_above_cloud = self.data.close > self.ema_fast > self.ema_slow
            price_below_cloud = self.data.close < self.ema_fast < self.ema_slow
            
            strong_adx = self.adx > self.params.adx_entry
            
            # Supertrend Logic (Basic approximation)
            price_above_lb = self.data.close > self.basic_lb
            price_below_ub = self.data.close < self.basic_ub
            
            # LONG Entry
            if price_above_cloud and strong_adx and price_above_lb:
                self.buy()
                
            # SHORT Entry
            elif price_below_cloud and strong_adx and price_below_ub:
                self.sell()

        else:
            # Technical Exits
            weak_adx = self.adx < self.params.adx_exit
            
            if self.position.size > 0:
                if weak_adx or self.data.close < self.basic_lb:
                    self.close()
            elif self.position.size < 0:
                if weak_adx or self.data.close > self.basic_ub:
                    self.close()
    
    def _check_stops(self):
        if self.position.size > 0:
            price = self.data.close[0]
            cost = self.position.price
            if price >= cost * (1 + self.params.take_profit):
                self.close()
            elif price <= cost * (1 - self.params.stop_loss):
                self.close()


# 8. REVERSAL HUNTER - RSI + MACD + Support/Resistance
class ReversalHunterStrategy(BaseStrategy):
    """
    Reversal strategy at key levels
    Entry: RSI divergence + MACD histogram reversal + Price at support
    Exit: RSI > 65 OR MACD bearish
    """
    params = (
        ('rsi_period', 14),
        ('rsi_oversold', 35),
        ('rsi_overbought', 65),
        ('macd_fast', 12),
        ('macd_slow', 26),
        ('macd_signal', 9),
        ('lookback', 20),
        ('stop_loss', 0.02),
        ('take_profit', 0.05),
    )

    def __init__(self):
        self.rsi = bt.indicators.RSI(self.data.close, period=self.params.rsi_period)
        self.macd = bt.indicators.MACD(
            self.data.close,
            period_me1=self.params.macd_fast,
            period_me2=self.params.macd_slow,
            period_signal=self.params.macd_signal
        )
        self.support = bt.indicators.Lowest(self.data.low, period=self.params.lookback)
        
    def next(self):
        super().next()
        
        if not self.position:
            # Reversal checks
            rsi_oversold = self.rsi < self.params.rsi_oversold
            rsi_overbought = self.rsi > self.params.rsi_overbought
            
            macd_hist_reversal_up = self.macd.histo > self.macd.histo[-1] and self.macd.histo[-1] < 0
            macd_hist_reversal_down = self.macd.histo < self.macd.histo[-1] and self.macd.histo[-1] > 0
            
            near_support = self.data.close <= self.support * 1.01
            # Assuming resistance is high of lookback for short
            resistance = bt.indicators.Highest(self.data.high, period=self.params.lookback)
            near_resistance = self.data.close >= resistance * 0.99
            
            # LONG Entry
            if rsi_oversold and macd_hist_reversal_up and near_support:
                self.buy()
                
            # SHORT Entry
            elif rsi_overbought and macd_hist_reversal_down and near_resistance:
                self.sell()

        else:
            # Technical Exits
            if self.position.size > 0:
                if self.rsi > self.params.rsi_overbought or self.macd.macd < self.macd.signal:
                    self.close()
            elif self.position.size < 0:
                if self.rsi < self.params.rsi_oversold or self.macd.macd > self.macd.signal:
                    self.close()
    
    def _check_stops(self):
        if self.position.size > 0:
            price = self.data.close[0]
            cost = self.position.price
            if price >= cost * (1 + self.params.take_profit):
                self.close()
            elif price <= cost * (1 - self.params.stop_loss):
                self.close()
