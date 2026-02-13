from .base import BaseStrategy
import backtrader as bt
from pydantic import BaseModel

class RSIStrategyParams(BaseModel):
    period: int
    overbought: int
    oversold: int
    stop_loss: float
    take_profit: float
    trailing_sl_perc: float = 0.01

class RSIStrategy(BaseStrategy):
    params = (
        ('period', 14),
        ('overbought', 70),
        ('oversold', 30),
        ('adx_threshold', 20),  # Avoid choppy markets
        ('volume_multiplier', 1.3),  # Volume confirmation for reversal
    )

    def __init__(self):
        super().__init__()
        self.rsi = bt.indicators.RSI_SMA(
            self.data.close, period=self.params.period
        )
        # ADX to filter out choppy markets
        self.adx = bt.indicators.ADX(self.data, period=14)
        # Volume for reversal confirmation
        self.volume_sma = bt.indicators.SMA(self.data.volume, period=20)

    def next(self):
        super().next()
        
        # Only trade when there's some trend (not pure chop)
        trend_present = self.adx > self.params.adx_threshold
        volume_spike = self.data.volume > self.volume_sma * self.params.volume_multiplier
        
        if not self.position:
            if self.rsi < self.params.oversold and trend_present and volume_spike:
                self.buy()
            elif self.rsi > self.params.overbought and trend_present and volume_spike:
                self.sell()
        else:
            # Smarter exits: wait for RSI to cross back into normal range
            if self.position.size > 0:
                # Long: exit when RSI crosses back above 40 (not just 70)
                if self.rsi[-1] < 40 and self.rsi > 40:
                    self.close()
            elif self.position.size < 0:
                # Short: exit when RSI crosses back below 60 (not just 30)
                if self.rsi[-1] > 60 and self.rsi < 60:
                    self.close()
