
import os
import sys
import json
import requests
from dotenv import load_dotenv

# Add backend directory to sys path
sys.path.append(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend'))

def check_futures_markets():
    print("Fetching All Tickers via Client...")
    # Use the client to get all tickers (public endpoint)
    # We will look for any pair that is NOT standard spot (usually just plain symbol)
    # or has specific flags.
    
    # We need a client instance or just requests
    url = "https://api.coindcx.com/exchange/ticker"
    response = requests.get(url)
    data = response.json()
    
    print(f"Total Tickers: {len(data)}")
    
    inr_pairs = []
    for t in data:
        market = t.get('market', '')
        if 'INR' in market:
            inr_pairs.append(t)
            
    print(f"INR Pairs Found: {len(inr_pairs)}")
    if inr_pairs:
        print("Sample INR Pairs:")
        for p in inr_pairs[:10]:
            print(f" - {p['market']}")
            
    # Check for anything that look like futures in INR pairs
    possible_futures = [p for p in inr_pairs if '_' in p['market'] or '-' in p['market']]
    print(f"Possible INR Futures/Derivatives: {len(possible_futures)}")
    if possible_futures:
         for p in possible_futures:
             print(f"   * {p['market']}")

if __name__ == "__main__":
    check_futures_markets()
