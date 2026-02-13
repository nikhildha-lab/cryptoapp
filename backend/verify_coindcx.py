
import os
import ccxt
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv(dotenv_path='.env.local')

api_key = os.getenv('COINDCX_API_KEY')
secret_key = os.getenv('COINDCX_SECRET_KEY')

if not api_key or not secret_key:
    print("Error: CoinDCX keys not found in .env.local")
    sys.exit(1)

from coindcx_client import CoinDCXClient

# Load environment variables
load_dotenv(dotenv_path='.env.local')

api_key = os.getenv('COINDCX_API_KEY')
secret_key = os.getenv('COINDCX_SECRET_KEY')

if not api_key or not secret_key:
    print("Error: CoinDCX keys not found in .env.local")
    sys.exit(1)

try:
    client = CoinDCXClient(api_key, secret_key)
    
    print("Attempting to fetch balance...")
    balance_data = client.fetch_balance()
    
    print("Success: Connected to CoinDCX!")
    print(f"Balance Data Type: {type(balance_data)}")
    # CoinDCX balance structure might differ, just print raw or length
    print(f"Balance Data Preview: {str(balance_data)[:200]}...")
    
except Exception as e:
    print(f"Error connecting to CoinDCX: {e}")
    sys.exit(1)
