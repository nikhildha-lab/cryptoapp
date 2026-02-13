
import os
import sys
import json
from dotenv import load_dotenv

sys.path.append(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend'))
from coindcx_client import CoinDCXClient

load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env.local'))

def check_tickers():
    api_key = os.getenv('COINDCX_API_KEY')
    secret_key = os.getenv('COINDCX_SECRET_KEY')
    client = CoinDCXClient(api_key, secret_key)
    
    print("Fetching Tickers...")
    tickers = client.fetch_tickers()
    
    print("Found Tickers. Searching for BTC Futures...")
    found = []
    for t in tickers:
        m = t.get('market', '')
        if 'BTC' in m and ('_' in m or 'USDT' in m):
            found.append(t)
            
    print(f"Found {len(found)} BTC pairs.")
    for f in found[:10]:
        print(json.dumps(f, indent=2))

if __name__ == "__main__":
    check_tickers()
