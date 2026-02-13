
import os
import sys
import time
import json
from dotenv import load_dotenv

sys.path.append(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend'))
from coindcx_client import CoinDCXClient

load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env.local'))

def run_debug():
    api_key = os.getenv('COINDCX_API_KEY')
    secret_key = os.getenv('COINDCX_SECRET_KEY')
    client = CoinDCXClient(api_key, secret_key)
    
    print("🔍 Testing Symbol Validity via 'Insufficient Funds' check...")

    # Candidates
    symbols = ["B-BTC_USDT", "BTCUSDT", "BTC_USDT"]
    
    for s in symbols:
        print(f"\n👉 Testing symbol='{s}' with Huge Quantity...")
        try:
            # Huge qty, low price limit buy
            res = client.create_futures_order(
                symbol="BTC/USDT", 
                side="buy", 
                amount=1.0, # 1 BTC! Should trigger insufficient funds if valid
                leverage=5,
                order_type="limit_order",
                price=10000.0, # $10k
                pair=s # Override
            )
            print(f"   Response: {res}")
            
            # Analyze response
            msg = str(res).lower()
            if "insufficient" in msg or "funds" in msg:
                print(f"   ✅ SYMBOL VALID! ({s}) - Funds insufficient as expected.")
            elif "not valid" in msg or "pair" in msg or res.get('code')==422:
                print("   ❌ Invalid Pair.")
            else:
                print(f"   ❓ Unknown Error: {res}")
                
        except Exception as e:
            print(f"   Error: {e}")
            
        time.sleep(1)

if __name__ == "__main__":
    run_debug()
