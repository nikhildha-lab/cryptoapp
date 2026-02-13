
import os
import sys
import pandas as pd
from dotenv import load_dotenv

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from execution_engine import ExecutionEngine

def verify_source():
    print("--- Verifying Execution Engine Data Source ---")
    engine = ExecutionEngine()
    
    symbol = "BTC/USDT"
    timeframe = "1h"
    
    print(f"Fetching data for {symbol} ({timeframe})...")
    df = engine.fetch_data(symbol, timeframe, limit=5)
    
    if df is not None:
        print("\nSuccess! Data fetched:")
        print(df)
        
        # Check logs to see if CoinDCX was used
        LOGS_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'audit_logs.json')
        if os.path.exists(LOGS_FILE):
             import json
             with open(LOGS_FILE, 'r') as f:
                 logs = json.load(f)
                 # Check for "CoinDCX Client Initialized" log
                 initialized = any("CoinDCX Client Initialized" in log['message'] for log in logs)
                 if initialized:
                     print("\n[VERIFIED] CoinDCX Client was initialized successfully.")
                 else:
                     print("\n[WARNING] CoinDCX Client initialization log not found.")
    else:
        print("\n[ERROR] Failed to fetch data.")

if __name__ == "__main__":
    verify_source()
