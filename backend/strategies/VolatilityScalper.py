from strategies.base import BaseStrategy
import backtrader as bt

class VolatilityScalper(BaseStrategy):
    """
    Scalping strategy that trades only when the target coin's volatility 
    is significantly higher than BTC's volatility (Relative Volatility Index).
    
    Logic:
    1. Calculate ATR (Vol) for Target and BTC.
    2. If Target_ATR_Ratio > BTC_ATR_Ratio * Multiplier, market is "Hot".
    3. In "Hot" market, use tight EMA crossovers for scalping.
    """
    
    params = (
        ('ltr_period', 14),
        ('vol_multiplier', 1.5),
        ('fast_ema', 5),
        ('slow_ema', 13),
        ('take_profit', 0.015), # 1.5%
        ('stop_loss', 0.005),   # 0.5%
        ('use_trailing_stop', True),
        ('trailing_sl_perc', 0.005), # 0.5% default trailing
        ('min_volatility_ratio', 0.8),  # Min volatility vs BTC (too low = ranging)
        ('max_volatility_ratio', 5.0),  # Max volatility vs BTC (too high = unstable)
    )
    
    # Flag for the runner to load BTC data
    REQUIRES_BTC = True

    def __init__(self):
        super().__init__()
        # Data feeds
        self.target = self.datas[0]
        self.btc = self.datas[1] if len(self.datas) > 1 else None
        
        # Indicators
        self.target_atr = bt.indicators.ATR(self.target, period=self.params.ltr_period)
        self.target_ema_fast = bt.indicators.EMA(self.target, period=self.params.fast_ema)
        self.target_ema_slow = bt.indicators.EMA(self.target, period=self.params.slow_ema)
        
        if self.btc is not None:
            self.btc_atr = bt.indicators.ATR(self.btc, period=self.params.ltr_period)
            
        self.crossover = bt.indicators.CrossOver(self.target_ema_fast, self.target_ema_slow)

    def next(self):
        super().next()
        
        if not self.position:
            # Volatility Check with min/max bounds
            is_volatile = True
            if self.btc is not None:
                # Normalized ATR (ATR / Price) to compare volatility across different price scales
                target_norm_vol = self.target_atr[0] / self.target.close[0]
                btc_norm_vol = self.btc_atr[0] / self.btc.close[0]
                
                # Avoid division by zero
                if btc_norm_vol > 0:
                    vol_ratio = target_norm_vol / btc_norm_vol
                    
                    # Condition: Volatility must be within optimal range
                    if vol_ratio < self.params.min_volatility_ratio:
                        is_volatile = False  # Too low = ranging market
                    elif vol_ratio > self.params.max_volatility_ratio:
                        is_volatile = False  # Too high = unstable/news event
                    elif vol_ratio < self.params.vol_multiplier:
                        is_volatile = False  # Below minimum threshold
            
            # Entry Logic: Fast crosses above Slow AND Optimal Volatility (LONG)
            if self.crossover > 0 and is_volatile:
                self.buy()
                
            # Entry Logic: Fast crosses below Slow AND Optimal Volatility (SHORT)
            elif self.crossover < 0 and is_volatile:
                self.sell()
                
        else:
            # Technical Exits
            if self.position.size > 0:
                # Long Exit: Crossunder
                if self.crossover < 0:
                    self.close()
            elif self.position.size < 0:
                # Short Exit: Crossover
                if self.crossover > 0:
                    self.close()
