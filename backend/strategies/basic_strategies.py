"""
Basic Single-Concept Strategies
Standard implementations of classic trading strategies
"""

from .base import BaseStrategy
import backtrader as bt

# 1. MACD TREND FOLLOWING
class MACDTrendFollowingStrategy(BaseStrategy):
    """
    Classic Trend Following using MACD
    Entry: MACD line crosses above Signal line
    Exit: MACD line crosses below Signal line
    """
    params = (
        ('macd_fast', 12),
        ('macd_slow', 26),
        ('macd_signal', 9),
        ('stop_loss', 0.03),
        ('take_profit', 0.08),
        ('adx_threshold', 25),  # Only trade in trending markets
        ('volume_multiplier', 1.5),  # Volume confirmation
    )

    def __init__(self):
        super().__init__()
        self.macd = bt.indicators.MACD(
            self.data.close,
            period_me1=self.params.macd_fast,
            period_me2=self.params.macd_slow,
            period_signal=self.params.macd_signal
        )
        # ADX for trend strength
        self.adx = bt.indicators.ADX(self.data, period=14)
        # Volume for confirmation
        self.volume_sma = bt.indicators.SMA(self.data.volume, period=20)

    def next(self):
        super().next()
        
        # Trend strength check
        strong_trend = self.adx > self.params.adx_threshold
        volume_confirmed = self.data.volume > self.volume_sma * self.params.volume_multiplier
        
        if not self.position:
            # Bullish Crossover (Long) - with ADX and volume
            if (self.macd.macd > self.macd.signal and 
                self.macd.macd[-1] <= self.macd.signal[-1] and 
                strong_trend and volume_confirmed):
                self.buy()
                
            # Bearish Crossover (Short) - with ADX and volume
            elif (self.macd.macd < self.macd.signal and 
                  self.macd.macd[-1] >= self.macd.signal[-1] and 
                  strong_trend and volume_confirmed):
                self.sell()
                
        else:
            # Early exit if histogram turns against position
            if self.position.size > 0:
                # Long: exit on bearish crossover OR histogram declining
                if (self.macd.macd < self.macd.signal and self.macd.macd[-1] >= self.macd.signal[-1]) or \
                   (self.macd.histo < self.macd.histo[-1] < self.macd.histo[-2]):
                    self.close()
            elif self.position.size < 0:
                # Short: exit on bullish crossover OR histogram rising
                if (self.macd.macd > self.macd.signal and self.macd.macd[-1] <= self.macd.signal[-1]) or \
                   (self.macd.histo > self.macd.histo[-1] > self.macd.histo[-2]):
                    self.close()


# 2. BOLLINGER BREAKOUT
class BollingerBreakoutStrategy(BaseStrategy):
    """
    Bollinger Band Squeeze Breakout
    Entry: Price breaks upper BB + Band Width expands
    Exit: Price reverts to moving average
    """
    params = (
        ('period', 20),
        ('devfactor', 2.0),
        ('stop_loss', 0.025),
        ('take_profit', 0.06),
        ('volume_multiplier', 1.8),  # Higher threshold for breakouts
        ('atr_period', 14),
    )

    def __init__(self):
        super().__init__()
        self.bb = bt.indicators.BollingerBands(
            self.data.close,
            period=self.params.period,
            devfactor=self.params.devfactor
        )
        # BandWidth = (Top - Bot) / Mid
        self.bandwidth = (self.bb.top - self.bb.bot) / self.bb.mid
        # ATR for expansion confirmation
        self.atr = bt.indicators.ATR(self.data, period=self.params.atr_period)
        # Volume for confirmation
        self.volume_sma = bt.indicators.SMA(self.data.volume, period=20)
        # Track previous breakout for retest confirmation
        self.prev_above_top = False
        self.prev_below_bot = False

    def next(self):
        super().next()
        
        if not self.position:
            # Breakout + Expansion logic
            breakout_up = self.data.close > self.bb.top
            breakout_down = self.data.close < self.bb.bot
            
            # ATR must be RISING (not just expanded)
            atr_rising = self.atr > self.atr[-1]
            expanding = self.bandwidth > self.bandwidth[-1]
            
            # Strong volume confirmation
            volume_confirmed = self.data.volume > self.volume_sma * self.params.volume_multiplier
            
            # Retest logic: wait for 2nd touch of BB after initial breakout
            sustained_breakout_up = breakout_up and self.prev_above_top
            sustained_breakout_down = breakout_down and self.prev_below_bot
            
            if sustained_breakout_up and expanding and atr_rising and volume_confirmed:
                self.buy()
            elif sustained_breakout_down and expanding and atr_rising and volume_confirmed:
                self.sell()
            
            # Track for retest confirmation
            self.prev_above_top = breakout_up
            self.prev_below_bot = breakout_down
                
        else:
            # Revert to mean exit
            if self.position.size > 0:
                if self.data.close <= self.bb.mid:
                    self.close()
            elif self.position.size < 0:
                if self.data.close >= self.bb.mid:
                    self.close()
