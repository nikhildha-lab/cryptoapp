from abc import ABC, abstractmethod
import logging

class ExchangeAdapter(ABC):
    """
    Abstract base class for exchange adapters.
    Ensures a consistent interface for all supported crypto exchanges.
    """
    
    def __init__(self, exchange_id, api_key=None, api_secret=None, is_paper=True):
        self.exchange_id = exchange_id
        self.api_key = api_key
        self.api_secret = api_secret
        self.is_paper = is_paper
        self.exchange = None
        self.logger = logging.getLogger(f"ExchangeAdapter.{exchange_id}")

    @abstractmethod
    def fetch_ticker(self, symbol):
        """Fetch current price and 24h change for a symbol"""
        pass

    @abstractmethod
    def fetch_ohlcv(self, symbol, timeframe, since=None, limit=100):
        """Fetch historical candlestick data"""
        pass

    @abstractmethod
    def create_order(self, symbol, side, order_type, amount, price=None, params={}):
        """Place an order (Market or Limit)"""
        pass

    @abstractmethod
    def fetch_balance(self):
        """Fetch account balance details"""
        pass

    @abstractmethod
    def fetch_open_orders(self, symbol=None):
        """Fetch active orders"""
        pass

    @abstractmethod
    def fetch_closed_orders(self, symbol=None, limit=20):
        """Fetch recently filled/cancelled orders"""
        pass

    @abstractmethod
    def cancel_order(self, order_id, symbol=None):
        """Cancel an active order"""
        pass

    @abstractmethod
    def get_market_precision(self, symbol):
        """Get price and amount precision for a symbol"""
        pass
