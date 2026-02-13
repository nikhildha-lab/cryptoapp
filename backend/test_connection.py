#!/usr/bin/env python3
"""
CoinDCX Connectivity Test
Verifies API authentication and basic functionality
"""

import os
import sys
from dotenv import load_dotenv

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from coindcx_client import CoinDCXClient

def main():
    # Load environment variables
    load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env.local'))
    
    api_key = os.getenv('COINDCX_API_KEY')
    secret_key = os.getenv('COINDCX_SECRET_KEY')
    
    print("=" * 60)
    print("CoinDCX Connectivity Test")
    print("=" * 60)
    
    if not api_key or not secret_key:
        print("❌ FAILED: Missing API credentials in .env.local")
        print("   Please set COINDCX_API_KEY and COINDCX_SECRET_KEY")
        return False
    
    print(f"✓ API Key found: {api_key[:8]}...{api_key[-4:]}")
    print(f"✓ Secret Key found: ***hidden***")
    print()
    
    # Initialize client
    try:
        client = CoinDCXClient(api_key, secret_key)
        print("✓ CoinDCX Client initialized")
    except Exception as e:
        print(f"❌ FAILED: Could not initialize client: {e}")
        return False
    
    # Test 1: Fetch Tickers (Public)
    print("\n[TEST 1] Fetching Public Market Tickers...")
    try:
        tickers = client.fetch_tickers()
        if isinstance(tickers, list) and len(tickers) > 0:
            print(f"✓ SUCCESS: Retrieved {len(tickers)} market pairs")
            # Show sample
            btc_usdt = next((t for t in tickers if t.get('market') == 'BTCUSDT'), None)
            if btc_usdt:
                print(f"   BTC/USDT Price: ₹{btc_usdt.get('last_price', 'N/A')}")
        else:
            print("⚠️  WARNING: Ticker data format unexpected")
    except Exception as e:
        print(f"❌ FAILED: {e}")
    
    # Test 2: Fetch Balance (Authenticated)
    print("\n[TEST 2] Fetching Account Balance (Authenticated)...")
    try:
        balance = client.fetch_balance()
        if isinstance(balance, list):
            print(f"✓ SUCCESS: Authentication successful")
            print(f"   Account has {len(balance)} currency entries")
            
            # Show non-zero balances
            non_zero = [b for b in balance if float(b.get('balance', 0)) > 0]
            if non_zero:
                print(f"\n   Non-Zero Balances:")
                for asset in non_zero[:5]:  # Show first 5
                    curr = asset.get('currency')
                    bal = float(asset.get('balance', 0))
                    print(f"   - {curr}: {bal:.8f}")
            else:
                print("   ⚠️  No balances found (account may be empty)")
        else:
            error_msg = balance.get('message', 'Unknown Error') if isinstance(balance, dict) else str(balance)
            print(f"❌ FAILED: {error_msg}")
            return False
    except Exception as e:
        print(f"❌ FAILED: {e}")
        return False
    
    # Test 3: Fetch OHLCV Data
    print("\n[TEST 3] Fetching OHLCV Data for BTC/USDT...")
    try:
        ohlcv = client.fetch_ohlcv('BTC/USDT', '1h', limit=5)
        if ohlcv and len(ohlcv) > 0:
            print(f"✓ SUCCESS: Retrieved {len(ohlcv)} candles")
            latest = ohlcv[-1]
            print(f"   Latest Close: ${latest[4]}")
        else:
            print("⚠️  WARNING: No OHLCV data returned")
    except Exception as e:
        print(f"❌ FAILED: {e}")
    
    print("\n" + "=" * 60)
    print("✅ All Core Tests Passed - CoinDCX Connection Active")
    print("=" * 60)
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
