from strategies.base import BaseStrategy
import backtrader as bt

class NDRTStrategy(BaseStrategy):
    """
    NDRT_STA_V6 Trend Following Strategy
    Converted from Pine Script with Enhancements.
    
    Logic:
    - Identifies Tops/Bottoms based on 3-candle fractal (Lower-Higher-Lower).
    - Create Buffer Zones (+/- %) around these Tops/Bottoms.
    - Long on Top Buffer Breach.
    - Short on Bottom Buffer Breach.
    - Stop and Reverse (SAR) logic.
    - Dynamic Buffer & Stop Loss based on Timeframe.
    - Trailing Stop functionality.
    """
    
    params = (
        ('buffer_percent', None), # None = Auto-detect based on timeframe
        ('stop_loss', None), # None = Auto-detect based on timeframe
        ('use_trailing_stop', True),
        ('trailing_sl_perc', None), # None = Auto-detect
        ('adx_threshold', 25),
        ('atr_period', 14),
        ('ema_trend_period', 50),
    )

    def __init__(self):
        self.last_top_close = None
        self.last_bottom_close = None
        self.last_top_index = -10
        self.last_bottom_index = -10
        
        self.order = None
        
        # Trailing Stop State
        self.lowest_low = float('inf')
        
        # Indicators
        self.adx = bt.indicators.ADX(period=14)
        self.atr = bt.indicators.ATR(period=self.params.atr_period)
        self.ema_trend = bt.indicators.EMA(period=self.params.ema_trend_period)

        # DEFAULT PARAMETERS LOGIC
        # If params are None, set defaults based on timeframe
        self.eff_buffer = self.params.buffer_percent
        self.eff_sl = self.params.stop_loss
        self.eff_trail = self.params.trailing_sl_perc

        # Determine if timeframe is <= 4 hours (240 mins)
        # self.data._compression is usually the multiplier (e.g. 1, 5, 15, 60)
        # self.data._timeframe is the unit (Minutes=1, Days=2, etc)
        
        is_low_tf = False
        if self.data._timeframe == bt.TimeFrame.Minutes:
            total_mins = self.data._compression
            if total_mins <= 240:
                is_low_tf = True
        elif self.data._timeframe < bt.TimeFrame.Days: # Seconds, Microseconds
             is_low_tf = True
             
        # Apply Defaults
        if self.eff_buffer is None:
            self.eff_buffer = 0.005 if is_low_tf else 1.0 # 0.005% or 1%
            
        if self.eff_sl is None:
             # User said: "hard SL can be trailed 0.25% FOR 4 AND BELOW... REST IT CAN BE 2%"
            self.eff_sl = 0.25 if is_low_tf else 2.0
            
        if self.eff_trail is None:
            self.eff_trail = 0.25 if is_low_tf else 2.0

    def next(self):
        # We need at least 3 bars to detect pattern
        if len(self) < 3:
            return

        c0 = self.data.close[0]
        c1 = self.data.close[-1]
        c2 = self.data.close[-2]
        high0 = self.data.high[0]
        low0 = self.data.low[0]
        current_idx = len(self)

        # --- Fractal Identification ---
        is_top = (c1 > c2 and c1 > c0)
        is_bottom = (c1 < c2 and c1 < c0)

        if is_top and (self.last_top_index == -10 or (current_idx - self.last_top_index >= 2)):
            self.last_top_close = c1
            self.last_top_index = current_idx - 1
            
        if is_bottom and (self.last_bottom_index == -10 or (current_idx - self.last_bottom_index >= 2)):
            self.last_bottom_close = c1
            self.last_bottom_index = current_idx - 1

        # --- Calculate Buffers ---
        if self.last_top_close is None or self.last_bottom_close is None:
            return

        # Convert Percent to Multiplier
        buffer_mult = self.eff_buffer / 100.0
        stop_mult = self.eff_sl / 100.0
        trail_mult = self.eff_trail / 100.0

        # Hardened Buffer: Use whichever is higher (Fixed % or % of ATR)
        # Standardizing on 20% of ATR as the minimum displacement
        atr_buffer = self.atr[0] * 0.2
        fixed_buffer = self.last_top_close * buffer_mult
        eff_buffer_val = max(fixed_buffer, atr_buffer)

        top_buffer_val = self.last_top_close + eff_buffer_val
        bottom_buffer_val = self.last_bottom_close - eff_buffer_val

        # --- Detect Breaches with Trend Confirmation ---
        # REGIME FILTER: ADX > 25
        is_trending = self.adx[0] > self.params.adx_threshold
        
        # TREND FILTER: EMA 50
        is_bullish = c0 > self.ema_trend[0]
        is_bearish = c0 < self.ema_trend[0]

        top_breached = is_trending and is_bullish and (high0 >= top_buffer_val) and (current_idx - self.last_top_index >= 2)
        bottom_breached = is_trending and is_bearish and (low0 <= bottom_buffer_val) and (current_idx - self.last_bottom_index >= 2)
        
        # --- Trading Logic ---
        pos_size = self.position.size
        # avg_price = self.position.price # For fixed SL

        # Entries
        if pos_size == 0:
            if top_breached:
                self.buy() # Open Long
                self.highest_high = high0 # Init trailing
            elif bottom_breached:
                self.sell() # Open Short
                self.lowest_low = low0 # Init trailing
                
        elif pos_size > 0: # LONG
            # Track Highest High for Trailing Stop
            if high0 > self.highest_high:
                self.highest_high = high0
                
            # Trailing Stop Calculation
            trail_stop_price = self.highest_high * (1 - trail_mult)
            
            # SAR Logic (Reverse on Bottom Breach)
            if bottom_breached:
                self.close()
                self.sell()
                self.lowest_low = low0
            
            # Stop Loss (Trailing or Fixed Buffer logic from Pine)
            # Pine logic: else if (longStopLoss > bottomBufferValue and low <= longStopLoss)
            # We use our improved Trailing Logic OR the original logic?
            # User said "hard SL can be trailed". Let's priority Trailing.
            elif self.params.use_trailing_stop and (low0 <= trail_stop_price):
                self.close() # Trailing SL Hit
                
            # Original Pine Fixed SL logic check (fallback if trail not hit? OR just replace?)
            # "longStopLoss > bottomBufferValue" check is specific to avoiding premature SL if buffer is wide.
            # Let's stick to the requested Trailing SL as primary exit if not SAR.

        elif pos_size < 0: # SHORT
            # Track Lowest Low
            if low0 < self.lowest_low:
                self.lowest_low = low0
                
            trail_stop_price = self.lowest_low * (1 + trail_mult)

            if top_breached:
                self.close()
                self.buy()
                self.highest_high = high0
                
            elif self.params.use_trailing_stop and (high0 >= trail_stop_price):
                self.close() # Trailing SL Hit
