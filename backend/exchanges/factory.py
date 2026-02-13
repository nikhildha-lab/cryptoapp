from .binance_adapter import BinanceAdapter
from .bybit_adapter import BybitAdapter
from .okx_adapter import OKXAdapter
from .coindcx_adapter import CoinDCXAdapter
from .delta_adapter import DeltaAdapter

def get_exchange_adapter(exchange_id, credentials=None, is_paper=True):
    """
    Factory function to create the appropriate exchange adapter.
    """
    adapters = {
        'binance': BinanceAdapter,
        'bybit': BybitAdapter,
        'okx': OKXAdapter,
        'coindcx': CoinDCXAdapter,
        'delta': DeltaAdapter
    }
    
    AdapterClass = adapters.get(exchange_id.lower())
    
    if not AdapterClass:
        raise ValueError(f"Exchange '{exchange_id}' is not supported.")
    
    api_key = credentials.get('api_key') if credentials else None
    api_secret = credentials.get('api_secret') if credentials else None
    
    return AdapterClass(api_key=api_key, api_secret=api_secret, is_paper=is_paper)
