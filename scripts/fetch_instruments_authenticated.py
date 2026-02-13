
import os
import sys
import time
import json
from dotenv import load_dotenv

sys.path.append(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend'))
from coindcx_client import CoinDCXClient

load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env.local'))

def fetch_instruments():
    api_key = os.getenv('COINDCX_API_KEY')
    secret_key = os.getenv('COINDCX_SECRET_KEY')
    client = CoinDCXClient(api_key, secret_key)
    
    print("🔍 Fetching Active Instruments (Authenticated)...")
    
    # Try POST first as it's common for CoinDCX auth data
    endpoint = "/exchange/v1/derivatives/futures/data/active_instruments"
    body = {"timestamp": int(time.time() * 1000)}
    
    try:
        res = client._request("POST", endpoint, body)
        # Check if it looks like a list
        if isinstance(res, list):
             print(f"✅ Found {len(res)} instruments.")
             # Print first few
             for i in res[:5]:
                 print(json.dumps(i, indent=2))
                 
             # Check for BTC pairs
             print("\n--- BTC PAIRS ---")
             for i in res:
                 if 'BTC' in str(i):
                     print(json.dumps(i, indent=2))
        else:
             print(f"Response: {res}")
             
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    fetch_instruments()
