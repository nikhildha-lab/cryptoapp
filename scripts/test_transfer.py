
import os
import sys
import time
import json
from dotenv import load_dotenv

# Add backend to sys path
sys.path.append(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend'))
from coindcx_client import CoinDCXClient

load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env.local'))

def run_transfer_test():
    api_key = os.getenv('COINDCX_API_KEY')
    secret_key = os.getenv('COINDCX_SECRET_KEY')
    client = CoinDCXClient(api_key, secret_key)
    
    print("🔍 Checking Futures Balance...")
    futures_bal = client.fetch_futures_balance()
    futures_inr = 0.0
    if isinstance(futures_bal, list):
        for wallet in futures_bal:
            if wallet['currency_short_name'] == 'INR':
                futures_inr = float(wallet['balance'])
    print(f"   Futures INR: {futures_inr}")
    
    if futures_inr < 1:
        print("❌ Not enough INR in Futures to test transfer.")
        return

    print("\n🚀 Attempting Transfer: Futures -> Spot (1 INR)")
    
    # Endpoint
    endpoint = "/exchange/v1/wallets/transfer"
    
    print("\n🚀 Starting Brute-Force Transfer Test...")
    
    # Common keys
    key_pairs = [
        ("source", "target"),
        ("from", "to"),
        ("source_wallet", "destination_wallet"),
        ("from_wallet", "to_wallet"),
        ("source_account", "destination_account"),
        ("source_wallet_type", "destination_wallet_type") # From search result
    ]
    
    # Common values
    val_pairs = [
        ("future", "trade"),
        ("futures", "spot"),
        ("derivative", "main"),
        ("future", "spot"),
        ("futures", "trade")
    ]
    
    for k_src, k_dst in key_pairs:
        for v_src, v_dst in val_pairs:
            body = {
                "currency": "INR",
                "amount": 1.0,
                k_src: v_src,
                k_dst: v_dst,
                "timestamp": int(time.time() * 1000)
            }
            print(f"👉 Testing: {json.dumps(body)}")
            try:
                # Use _request to get raw response
                res = client._request("POST", endpoint, body)
                print(f"   Response: {res}")
                if res.get('status') == 'success' or res.get('code') == 200 or 'transferred' in str(res).lower():
                     print("   ✅ Transfer Success!")
                     return
            except Exception as e:
                print(f"   Error: {e}")
                
            time.sleep(0.5)

if __name__ == "__main__":
    run_transfer_test()
