
import hmac
import hashlib
import json
import time
import requests
import pandas as pd

class CoinDCXClient:
    def __init__(self, api_key, secret_key):
        self.api_key = api_key
        self.secret_key = secret_key
        self.base_url = "https://api.coindcx.com"
        self.public_url = "https://public.coindcx.com"

    def _get_signature(self, body_str):
        return hmac.new(
            self.secret_key.encode(),
            body_str.encode(),
            hashlib.sha256
        ).hexdigest()

    def _request(self, method, endpoint, body=None):
        url = self.base_url + endpoint
        headers = {
            "Content-Type": "application/json",
            "X-AUTH-APIKEY": self.api_key
        }
        
        if body:
            # Use compact separators to match CoinDCX signature requirements
            body_str = json.dumps(body, separators=(',', ':'))
            headers["X-AUTH-SIGNATURE"] = self._get_signature(body_str)
            
            if method == "GET":
                # CoinDCX sometimes requires body in GET for authenticated endpoints
                response = requests.get(url, headers=headers, data=body_str)
            else:
                response = requests.post(url, headers=headers, data=body_str)
        else:
            response = requests.request(method, url, headers=headers)
            
        try:
            return response.json()
        except json.JSONDecodeError:
            print(f"❌ API Error: {response.status_code} - {response.text}")
            return {"error": response.text, "status": response.status_code}

    def fetch_ohlcv(self, symbol, timeframe='1h', limit=100):
        # Map symbol: BTC/USDT -> B-BTC_USDT
        pair = symbol.replace('/', '_')
        if not pair.startswith('B-'):
            pair = 'B-' + pair
            
        # Map timeframe to CoinDCX interval
        # CoinDCX: 1m, 5m, 15m, 30m, 1h, 2h, 4h, 6h, 8h, 1d, 3d, 1w, 1M
        interval_map = {
            '1m': '1m', '5m': '5m', '15m': '15m', '30m': '30m',
            '1h': '1h', '2h': '2h', '4h': '4h',
            '1d': '1d', '1w': '1w', '1M': '1M'
        }
        interval = interval_map.get(timeframe, '1h')
        
        url = f"{self.public_url}/market_data/candles?pair={pair}&interval={interval}&limit={limit}"
        response = requests.get(url)
        data = response.json()
        
        if isinstance(data, list):
            # CoinDCX returns latest first, reverse it for dataframe
            data.reverse()
            # Standardize to list of lists [timestamp, open, high, low, close, volume]
            ohlcv = []
            for candle in data:
                ohlcv.append([
                    candle['time'],
                    candle['open'],
                    candle['high'],
                    candle['low'],
                    candle['close'],
                    candle['volume']
                ])
            return ohlcv
        return []

    def fetch_balance(self):
        endpoint = "/exchange/v1/users/balances"
        body = {"timestamp": int(time.time() * 1000)}
        return self._request("POST", endpoint, body)

    def fetch_futures_balance(self):
        # Authenticated GET with body
        endpoint = "/exchange/v1/derivatives/futures/wallets"
        body = {"timestamp": int(time.time() * 1000)}
        return self._request("GET", endpoint, body)

    def create_order(self, symbol, type, side, amount, price=None, **kwargs):
        # Map symbol
        pair = symbol.replace('/', '') # CoinDCX Spot uses BTCINR format often, or BTC_INR
        # If it's a futures pair (usually has underscore or B-), let it be?
        
        # Actually, let's rely on the user/caller to pass a clean symbol or handle it better.
        # But for now, if 'INR' in symbol, it's likely Spot BTCINR.
        if 'INR' in symbol and 'USDT' not in symbol:
             pair = symbol.replace('/', '')
        else:
             # Default fallback behavior (preserving existing logic for others)
             pair = symbol.replace('/', '_')
             if not pair.startswith('B-'):
                 pair = 'B-' + pair
            
        endpoint = "/exchange/v1/orders/create"
        body = {
            "side": side, # 'buy' or 'sell'
            "order_type": type, # 'limit_order' or 'market_order'
            "market": pair,
            "total_quantity": amount,
            "timestamp": int(time.time() * 1000)
        }
        
        # Override market if provided in kwargs (e.g. I-BTC_INR)
        if kwargs.get('market'):
            body['market'] = kwargs.pop('market')
            
        # Add any extra params (e.g. leverage, product)
        if kwargs:
            body.update(kwargs)
            
        return self._request("POST", endpoint, body)


    def fetch_tickers(self):
        # Public endpoint for all tickers
        url = "https://api.coindcx.com/exchange/ticker"
        response = requests.get(url)
        return response.json()

    def create_futures_order(self, symbol, side, amount, leverage=1, order_type='market_order', price=None, **kwargs):
        """
        Create a futures order on CoinDCX
        
        Args:
            symbol: Trading pair (e.g., 'BTC/USDT')
            side: 'buy' or 'sell'
            amount: Quantity in base currency
            leverage: Leverage multiplier (1-10x typically)
            order_type: 'market_order' or 'limit_order'
            price: Required for limit orders
        """
        # Map symbol to CoinDCX format
        pair = symbol.replace('/', '_')
        # Only add B- if it's likely a USDT pair and doesn't have it
        if 'USDT' in pair and not pair.startswith('B-'):
            pair = 'B-' + pair
        # For INR pairs, we might need just 'BTCINR' or 'BTC_INR'
        if 'INR' in pair:
             pair = pair.replace('_', '') # Try compact format first? or keep _?
             # Let's try to trust the input symbol more if it doesn't match standard B- pattern
             
        endpoint = "/exchange/v1/derivatives/futures/orders/create"
        body = {
            "side": side,
            "order_type": order_type,
            "pair": pair,
            "total_quantity": amount,
            "leverage": leverage,
            "timestamp": int(time.time() * 1000)
        }
        
        # Override pair if provided in kwargs
        if kwargs.get('pair'):
            body['pair'] = kwargs.pop('pair')
        
        # Add any extra params (e.g. margin_mode)
        if kwargs:
            body.update(kwargs)
        
        # Add price for limit orders
        if order_type == 'limit_order':
            if price is None:
                raise ValueError("Price is required for limit orders")
            body["price"] = price
            body["time_in_force"] = "good_till_cancel"
        
        return self._request("POST", endpoint, body)
