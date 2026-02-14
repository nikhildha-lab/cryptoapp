from .binance_adapter import BinanceAdapter
from .bybit_adapter import BybitAdapter
from .okx_adapter import OKXAdapter
from .coindcx_adapter import CoinDCXAdapter
from .delta_adapter import DeltaAdapter
from .generic_adapter import GenericCCXTAdapter

def get_exchange_adapter(exchange_id, credentials=None, is_paper=True):
    """
    Factory function to create the appropriate exchange adapter.
    """
    exchange_id = exchange_id.lower()
    adapters = {
        'binance': BinanceAdapter,
        'bybit': BybitAdapter,
        'okx': OKXAdapter,
        'coindcx': CoinDCXAdapter,
        'delta': DeltaAdapter,
        # Fallback exchanges using generic adapter
        'kraken': GenericCCXTAdapter,
        'gateio': GenericCCXTAdapter,
        'kucoin': GenericCCXTAdapter,
        'bitget': GenericCCXTAdapter
    }
    
    AdapterClass = adapters.get(exchange_id)
    
    if not AdapterClass:
        raise ValueError(f"Exchange '{exchange_id}' is not supported.")
    
    api_key = credentials.get('api_key') if credentials else None
    api_secret = credentials.get('api_secret') if credentials else None
    
    # GenericCCXTAdapter needs the exchange_id as first argument
    if AdapterClass == GenericCCXTAdapter:
        return AdapterClass(exchange_id, api_key=api_key, api_secret=api_secret, is_paper=is_paper)
    
    return AdapterClass(api_key=api_key, api_secret=api_secret, is_paper=is_paper)
