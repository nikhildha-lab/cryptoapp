
import os
import sys
import json
from dotenv import load_dotenv

# Add backend to sys path
sys.path.append(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend'))
from coindcx_client import CoinDCXClient

load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env.local'))

def check_balance():
    api_key = os.getenv('COINDCX_API_KEY')
    secret_key = os.getenv('COINDCX_SECRET_KEY')
    client = CoinDCXClient(api_key, secret_key)
    
    print("🔍 Fetching Futures Balances...")
    try:
        futures_bal = client.fetch_futures_balance()
        print(json.dumps(futures_bal, indent=2))
        
        usdt_bal = 0.0
        if isinstance(futures_bal, list):
            for wallet in futures_bal:
                if wallet['currency_short_name'] == 'USDT':
                    usdt_bal = float(wallet['balance'])
                    
        print(f"\n✅ Futures USDT Balance: {usdt_bal}")
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    check_balance()
