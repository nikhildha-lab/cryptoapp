
import os
import sys
import json
import time
from datetime import datetime
from dotenv import load_dotenv

# Add current directory to path to import local modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from coindcx_client import CoinDCXClient

# Load environment variables
load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env.local'))

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')
BALANCE_FILE = os.path.join(DATA_DIR, 'balance.json')

def fetch_now():
    api_key = os.getenv('COINDCX_API_KEY')
    secret_key = os.getenv('COINDCX_SECRET_KEY')
    
    if not api_key or not secret_key:
        print("Error: Keys missing")
        return

    client = CoinDCXClient(api_key, secret_key)
    
    balance_data = {}
    total_usdt_value = 0.0
    total_inr_value = 0.0
    
    try:
        # 1. Fetch Tickers for conversion
        tickers = client.fetch_tickers()
        usdt_inr_price = 87.0
        if isinstance(tickers, list):
            for t in tickers:
                if t.get('market') == 'USDTINR':
                    usdt_inr_price = float(t.get('last_price', 87.0))
                    break
        
        # 2. Fetch Spot Balance
        raw_balance = client.fetch_balance()
        if isinstance(raw_balance, list):
            for asset in raw_balance:
                curr = asset.get('currency')
                bal = float(asset.get('balance', 0))
                if bal > 0:
                    balance_data[curr] = balance_data.get(curr, 0) + bal
        
        # 3. Fetch Futures Balance
        try:
            raw_futures = client.fetch_futures_balance()
            if isinstance(raw_futures, list):
                for wallet in raw_futures:
                    curr = wallet.get('currency_short_name')
                    bal = float(wallet.get('balance', 0)) + float(wallet.get('locked_balance', 0))
                    if bal > 0:
                        balance_data[curr] = balance_data.get(curr, 0) + bal
        except Exception as e:
            print(f"Error fetching futures: {e}")

        # 4. Calculate Values
        for curr, bal in balance_data.items():
            if curr == 'INR':
                total_inr_value += bal
                total_usdt_value += (bal / usdt_inr_price)
            elif curr == 'USDT':
                total_usdt_value += bal
                total_inr_value += (bal * usdt_inr_price)
            else:
                pass

        # Save
        output = {
            "timestamp": datetime.now().isoformat(),
            "assets": balance_data,
            "total_value_usdt": total_usdt_value,
            "total_value_inr": total_inr_value,
            "source": "coindcx"
        }
        
        with open(BALANCE_FILE, 'w') as f:
            json.dump(output, f, indent=2)
            
        print(json.dumps(output))

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    fetch_now()
