import backtrader as bt

class BaseStrategy(bt.Strategy):
    """
    Base strategy class with common functionality like logging and order management.
    """
    params = (
        ('stop_loss', 0.02),
        ('take_profit', 0.05),
        ('use_trailing_stop', True),
        ('trailing_sl_perc', 0.015),  # 1.5% trailing stop
        ('risk_per_trade', 0.01),  # 1% risk per trade
        ('leverage', 1),
    )

    def __init__(self):
        super().__init__()
        self.highest_high = 0
        self.lowest_low = float('inf')
        self.entry_price = 0

    def log(self, txt, dt=None):
        """ Logging function for this strategy"""
        dt = dt or self.datas[0].datetime.date(0)
        # print(f'{dt.isoformat()}, {txt}') # Reduced verbosity for backtests

    def notify_order(self, order):
        if order.status in [order.Submitted, order.Accepted]:
            return

        if order.status in [order.Completed]:
            if order.isbuy():
                self.log(
                    f'BUY EXECUTED, Price: {order.executed.price:.2f}, Cost: {order.executed.value:.2f}, Comm: {order.executed.comm:.2f}'
                )
                if self.position.size > 0: # Long Entry
                    self.entry_price = order.executed.price
                    self.highest_high = order.executed.price
                elif self.position.size == 0: # Short Exit
                    pass

            elif order.issell():
                self.log(
                    f'SELL EXECUTED, Price: {order.executed.price:.2f}, Cost: {order.executed.value:.2f}, Comm: {order.executed.comm:.2f}'
                )
                if self.position.size < 0: # Short Entry
                    self.entry_price = order.executed.price
                    self.lowest_low = order.executed.price
                elif self.position.size == 0: # Long Exit
                    pass

        elif order.status in [order.Canceled, order.Margin, order.Rejected]:
            self.log('Order Canceled/Margin/Rejected')

        self.order = None

    def notify_trade(self, trade):
        if not trade.isclosed:
            return
        self.log(f'OPERATION PROFIT, GROSS {trade.pnl:.2f}, NET {trade.pnlcomm:.2f}')

    def calculate_position_size(self, stop_loss_price):
        """
        Calculate position size based on risk per trade
        """
        cash = self.broker.get_cash()
        risk_amount = cash * self.params.risk_per_trade
        
        current_price = self.data.close[0]
        # Avoid division by zero
        price_diff = abs(current_price - stop_loss_price)
        if price_diff == 0:
            return 0
            
        size = risk_amount / price_diff
        
        # Cap size at available cash (basic check, leverage handled by broker)
        max_afford = (cash * self.params.leverage) / current_price
        return min(size, max_afford)

    def manage_risk(self):
        """
        Universal Risk Management: Stop Loss, Take Profit, Trailing Stop
        Supports both LONG and SHORT positions.
        """
        if not self.position:
            return

        current_price = self.data.close[0]
        pos_size = self.position.size

        # LONG POSITION MANAGEMENT
        if pos_size > 0:
            # 1. Update Highest High for Trailing Stop
            if current_price > self.highest_high:
                self.highest_high = current_price
            
            # 2. Check Trailing Stop
            if self.params.use_trailing_stop:
                trail_stop_price = self.highest_high * (1 - self.params.trailing_sl_perc)
                
                # BREAK-EVEN LOGIC:
                # If price has moved favorably by at least the trailing amount, ensure we lock in Entry
                break_even_trigger = self.entry_price * (1 + self.params.trailing_sl_perc)
                if self.highest_high >= break_even_trigger:
                    # Ensure limit is at least Entry Price (plus tiny buffer for fees if desired, using entry for now)
                    if trail_stop_price < self.entry_price:
                        trail_stop_price = self.entry_price
                
                if current_price <= trail_stop_price:
                    self.log(f'TRAILING STOP HIT (Long): Price {current_price:.2f} <= Limit {trail_stop_price:.2f}')
                    self.close()
                    return

            # 3. Check Fixed Stop Loss
            stop_price = self.entry_price * (1 - self.params.stop_loss)
            if current_price <= stop_price:
                 self.log(f'STOP LOSS HIT (Long): Price {current_price:.2f} <= Limit {stop_price:.2f}')
                 self.close()
                 return

            # 4. Check Take Profit
            tp_price = self.entry_price * (1 + self.params.take_profit)
            if current_price >= tp_price:
                self.log(f'TAKE PROFIT HIT (Long): Price {current_price:.2f} >= Limit {tp_price:.2f}')
                self.close()
                return

        # SHORT POSITION MANAGEMENT
        elif pos_size < 0:
            # 1. Update Lowest Low for Trailing Stop
            if current_price < self.lowest_low:
                self.lowest_low = current_price

            # 2. Check Trailing Stop
            if self.params.use_trailing_stop:
                trail_stop_price = self.lowest_low * (1 + self.params.trailing_sl_perc)
                
                # BREAK-EVEN LOGIC:
                break_even_trigger = self.entry_price * (1 - self.params.trailing_sl_perc)
                if self.lowest_low <= break_even_trigger:
                     if trail_stop_price > self.entry_price:
                         trail_stop_price = self.entry_price

                if current_price >= trail_stop_price:
                    self.log(f'TRAILING STOP HIT (Short): Price {current_price:.2f} >= Limit {trail_stop_price:.2f}')
                    self.close()
                    return

            # 3. Check Fixed Stop Loss
            stop_price = self.entry_price * (1 + self.params.stop_loss)
            if current_price >= stop_price:
                self.log(f'STOP LOSS HIT (Short): Price {current_price:.2f} >= Limit {stop_price:.2f}')
                self.close()
                return

            # 4. Check Take Profit
            tp_price = self.entry_price * (1 - self.params.take_profit)
            if current_price <= tp_price:
                self.log(f'TAKE PROFIT HIT (Short): Price {current_price:.2f} <= Limit {tp_price:.2f}')
                self.close()
                return

    def next(self):
        # Always run risk management
        self.manage_risk()
        
        # Liquidation check
        if self.broker.getvalue() <= 0:
            self.log('LIQUIDATION DETECTED: Equity hit zero')
            self.env.runstop()
