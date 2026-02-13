
import os
import sys
import json
from dotenv import load_dotenv

# Add backend directory to sys path
sys.path.append(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend'))

from coindcx_client import CoinDCXClient

# Load env
load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env.local'))

def check_markets():
    api_key = os.getenv('COINDCX_API_KEY')
    secret_key = os.getenv('COINDCX_SECRET_KEY')

    client = CoinDCXClient(api_key, secret_key)
    
    print("Fetching tickers...")
    tickers = client.fetch_tickers()
    
    inr_futures = []
    usdt_futures = []
    
    if isinstance(tickers, list):
        for t in tickers:
            market = t.get('market', '')
            # CoinDCX often uses 'BTCINR' or 'BTC_INR'
            if 'INR' in market:
                inr_futures.append(market)
            if 'USDT' in market:
                usdt_futures.append(market)

    print(f"Found {len(inr_futures)} INR pairs and {len(usdt_futures)} USDT pairs.")
    print("Sample INR Pairs:", inr_futures[:10])
    
    # Check specifically for BTC/INR equivalent
    btc_inr = [m for m in inr_futures if 'BTC' in m]
    print("BTC-related INR Pairs:", btc_inr)

if __name__ == "__main__":
    check_markets()
