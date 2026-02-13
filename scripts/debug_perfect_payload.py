
import os
import sys
import time
import json
import idna
from dotenv import load_dotenv

sys.path.append(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend'))
from coindcx_client import CoinDCXClient

load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env.local'))

def run_debug():
    api_key = os.getenv('COINDCX_API_KEY')
    secret_key = os.getenv('COINDCX_SECRET_KEY')
    client = CoinDCXClient(api_key, secret_key)
    
    print("🔍 Testing 'Perfect' Payload...")

    symbol = "B-BTC_USDT"
    
    # Payload Construction
    # 1. Float for Price/Qty
    # 2. String for others
    # 3. Leverage as Int or Float? Docs say Levrage usually Int.
    
    try:
        # We manually call _request to have full control over body
        endpoint = "/exchange/v1/derivatives/futures/orders/create"
        
        body = {
            "timestamp": int(time.time() * 1000),
            "side": "buy",
            "pair": symbol,
            "order_type": "limit_order",
            "price": 60000.0,
            "total_quantity": 0.001,
            "leverage": 1,
            "time_in_force": "good_till_cancel",
            "notification": "no_notification"
        }
        
        print(f"👉 Sending Body: {json.dumps(body)}")
        
        res = client._request("POST", endpoint, body)
        print(f"   Response: {res}")
        
        if res.get('id'):
            print("   ✅ SUCCESS! (Order placed, cancel it manually!)")
            
    except Exception as e:
        print(f"   Error: {e}")

if __name__ == "__main__":
    run_debug()
