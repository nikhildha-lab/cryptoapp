
import os
import sys
import time
import json
from dotenv import load_dotenv

# Add backend to sys path
sys.path.append(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend'))
from coindcx_client import CoinDCXClient

load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env.local'))

def run_debug():
    api_key = os.getenv('COINDCX_API_KEY')
    secret_key = os.getenv('COINDCX_SECRET_KEY')
    client = CoinDCXClient(api_key, secret_key)
    
    print("🔍 Testing USDT Futures Symbols...")

    # Options to test
    symbols = ["B-BTC_USDT", "BTCUSDT", "BTC_USDT", "B-BTCUSDT"]
    
    # Common parameters
    side = "buy"
    leverage = 5
    # Small quantity
    quantity = 0.0002 # ~$13
    
    # 1. Test Specific Futures Endpoint
    print("\n--- Testing /derivatives/futures/orders/create ---")
    for s in symbols:
        print(f"👉 Testing pair='{s}'")
        try:
            # We use our client wrapper but override pair/symbol logic by passing 'pair' kwargs
            # The client wrapper usually tries to auto-format, so we need to be careful
            # Let's inspect client code again? No, we added 'pair' override support.
            
            res = client.create_futures_order(
                symbol="BTC/USDT", # Dummy
                side=side,
                amount=quantity,
                leverage=leverage,
                order_type="market_order",
                pair=s # Override
            )
            print(f"   Response: {res}")
            if res.get('id'):
                print("   ✅ SUCCESS!")
                return
        except Exception as e:
            print(f"   Error: {e}")
            
        time.sleep(1)

    # 2. Test Generic Endpoint
    print("\n--- Testing /orders/create (Generic) ---")
    for s in symbols:
        print(f"👉 Testing market='{s}' product='futures'")
        try:
            res = client.create_order(
                symbol="BTC/USDT", # Dummy
                side=side,
                type="market_order",
                amount=quantity,
                market=s, # Override
                product="futures",
                leverage=leverage
            )
            print(f"   Response: {res}")
            if res.get('orders'):
                print("   ✅ SUCCESS!")
                return
        except Exception as e:
            print(f"   Error: {e}")
        time.sleep(1)

if __name__ == "__main__":
    run_debug()
