import ccxt
import time
from .base_adapter import ExchangeAdapter
try:
    from coindcx_client import CoinDCXClient
except ImportError:
    from ..coindcx_client import CoinDCXClient

class CoinDCXAdapter(ExchangeAdapter):
    """
    CoinDCX exchange adapter.
    Uses the specialized CoinDCXClient for Indian market specifics.
    """
    
    def __init__(self, api_key=None, api_secret=None, is_paper=True):
        super().__init__("coindcx", api_key, api_secret, is_paper)
        self.client = CoinDCXClient(api_key, api_secret) if api_key else None
        
        # ccxt.coindcx might not be available in all versions
        try:
            self.exchange = ccxt.coindcx({'enableRateLimit': True})
        except AttributeError:
            self.logger.warning("ccxt.coindcx not found. Using Binance as data proxy for backtesting.")
            self.exchange = ccxt.binance({'enableRateLimit': True})
            
        self.logger.info("Initialized CoinDCX Adapter")

    def fetch_ticker(self, symbol):
        try:
            # Standardize symbol for CoinDCX CCXT
            # CoinDCX symbols in CCXT are often in format 'BTC/USDT' or 'BTC/INR'
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
            # Fallback to public API if CCXT fails
            try:
                tickers = self.client.fetch_tickers()
                # CoinDCX public ticker returns a list
                for t in tickers:
                    if t.get('market') == symbol.replace('/', ''):
                        return {
                            'price': float(t['last_price']),
                            'change': float(t['change_24_hour']),
                            'timestamp': int(time.time() * 1000)
                        }
                return {'price': 0, 'change': 0}
            except:
                raise

    def fetch_ohlcv(self, symbol, timeframe, since=None, limit=100):
        try:
            return self.exchange.fetch_ohlcv(symbol, timeframe, since=since, limit=limit)
        except Exception as e:
            self.logger.error(f"Error fetching OHLCV for {symbol}: {e}")
            raise

    def create_order(self, symbol, side, order_type, amount, price=None, params={}):
        if not self.client:
            raise ValueError("API keys required for CoinDCX orders")
            
        try:
            type_map = {
                'market': 'market_order',
                'limit': 'limit_order'
            }
            
            # CoinDCX Spot vs Futures check
            if params.get('product') == 'futures' or 'B-' in symbol:
                return self.client.create_futures_order(
                    symbol=symbol,
                    side=side.lower(),
                    amount=amount,
                    leverage=params.get('leverage', 1),
                    order_type=type_map.get(order_type.lower(), 'market_order'),
                    price=price,
                    **params
                )
            else:
                return self.client.create_order(
                    symbol=symbol,
                    type=type_map.get(order_type.lower(), 'market_order'),
                    side=side.lower(),
                    amount=amount,
                    price=price,
                    **params
                )
        except Exception as e:
            self.logger.error(f"Error creating order for {symbol}: {e}")
            raise

    def fetch_balance(self):
        if not self.client:
            return {'free': {}, 'used': {}, 'total': {}}
        try:
            # Combine spot and futures balances
            spot = self.client.fetch_balance()
            # Standardize output for execution engine
            return spot
        except Exception as e:
            self.logger.error(f"Error fetching balance: {e}")
            raise

    def fetch_open_orders(self, symbol=None):
        # Implementation depends on CoinDCXClient supporting this
        return []

    def fetch_closed_orders(self, symbol=None, limit=20):
        return []

    def cancel_order(self, order_id, symbol=None):
        return {}

    def get_market_precision(self, symbol):
        # Defaults for CoinDCX if not in CCXT
        return {'price': 2, 'amount': 6}
