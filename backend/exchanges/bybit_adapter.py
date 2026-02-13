import ccxt
from .base_adapter import ExchangeAdapter

class BybitAdapter(ExchangeAdapter):
    """
    Bybit exchange adapter using CCXT.
    """
    
    def __init__(self, api_key=None, api_secret=None, is_paper=True):
        super().__init__("bybit", api_key, api_secret, is_paper)
        
        options = {
            'apiKey': api_key,
            'secret': api_secret,
            'enableRateLimit': True,
        }
        
        self.exchange = ccxt.bybit(options)
        
        if is_paper and api_key and api_secret:
            self.exchange.set_sandbox_mode(True)
            self.logger.info("Initialized Bybit in SANDBOX mode")
        else:
            self.logger.info("Initialized Bybit in LIVE mode (Simulation may apply if no keys)")

    def fetch_ticker(self, symbol):
        try:
            ticker = self.exchange.fetch_ticker(symbol)
            return {
                'price': ticker['last'],
                'change': ticker['percentage'],
                'high': ticker['high'],
                'low': ticker['low'],
                'volume': ticker['baseVolume'],
                'timestamp': ticker['timestamp']
            }
        except Exception as e:
            self.logger.error(f"Error fetching ticker for {symbol}: {e}")
            raise

    def fetch_ohlcv(self, symbol, timeframe, since=None, limit=100):
        try:
            return self.exchange.fetch_ohlcv(symbol, timeframe, since=since, limit=limit)
        except Exception as e:
            self.logger.error(f"Error fetching OHLCV for {symbol}: {e}")
            raise

    def create_order(self, symbol, side, order_type, amount, price=None, params={}):
        try:
            if order_type.lower() == 'market':
                return self.exchange.create_market_order(symbol, side, amount, params)
            else:
                return self.exchange.create_limit_order(symbol, side, amount, price, params)
        except Exception as e:
            self.logger.error(f"Error creating {order_type} {side} order for {symbol}: {e}")
            raise

    def fetch_balance(self):
        try:
            return self.exchange.fetch_balance()
        except Exception as e:
            self.logger.error(f"Error fetching balance: {e}")
            raise

    def fetch_open_orders(self, symbol=None):
        try:
            return self.exchange.fetch_open_orders(symbol)
        except Exception as e:
            self.logger.error(f"Error fetching open orders: {e}")
            raise

    def fetch_closed_orders(self, symbol=None, limit=20):
        try:
            return self.exchange.fetch_closed_orders(symbol, limit=limit)
        except Exception as e:
            self.logger.error(f"Error fetching closed orders: {e}")
            raise

    def cancel_order(self, order_id, symbol=None):
        try:
            return self.exchange.cancel_order(order_id, symbol)
        except Exception as e:
            self.logger.error(f"Error cancelling order {order_id}: {e}")
            raise

    def get_market_precision(self, symbol):
        try:
            markets = self.exchange.load_markets()
            if symbol in markets:
                market = markets[symbol]
                return {
                    'price': market['precision']['price'],
                    'amount': market['precision']['amount']
                }
            return {'price': 8, 'amount': 8}
        except Exception as e:
            self.logger.error(f"Error loading price precision for {symbol}: {e}")
            return {'price': 8, 'amount': 8}
