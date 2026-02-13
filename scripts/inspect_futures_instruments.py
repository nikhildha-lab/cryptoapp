
import os
import sys
import json
import requests
import time

# Add backend directory to sys path to import client
import os
import os
import sys
sys.path.append(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend'))

def inspect_instruments():
    print("Fetching Active Futures Instruments via Client (Auth)...")
    # We need to manually construct auth headers here since client doesn't have this specific method wrapper
    # But we can import client and use _request if we make it public or just copy logic
    
    from coindcx_client import CoinDCXClient
    import os
    from dotenv import load_dotenv
    
    load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env.local'))
    api_key = os.getenv('COINDCX_API_KEY')
    secret_key = os.getenv('COINDCX_SECRET_KEY')
    
    client = CoinDCXClient(api_key, secret_key)
    
    # Use the _request method (we need to bypass name mangling if private, but it's _request so it's accessible in python)
    # Target endpoint: /exchange/v1/derivatives/futures/data/active_instruments
    # Post or Get? Usually GET for public data but if it requires auth maybe POST with empty body?
    # Error message "Missing Authentication Token" implies headers needed.
    # Let's try GET with headers first (using client._request with POST body to sign? or GET with signature?)
    # Client _request handles GET with body signature.
    
    endpoint = "/exchange/v1/derivatives/futures/data/active_instruments"
    body = {"timestamp": int(time.time() * 1000)} # Try adding timestamp to sign it
    
    try:
        # We use POST to ensure signature is generated/accepted for private endpoints usually
        # But this might be a GET endpoint that just needs auth?
        # Let's try POST first as CoinDCX often uses POST for everything authenticated
        response = client._request("POST", endpoint, body)
        data = response
    except Exception as e:
        print(f"Error fetching data: {e}")
        return

    print(f"Total Instruments: {len(data)}")
    print(f"Data Type: {type(data)}")
    print(f"Raw Data: {json.dumps(data, indent=2)}")
        
    inr_related = []
    
    # If data is a dict, maybe the list is under a key?
    iterable = data
    if isinstance(data, dict):
        iterable = data.values() # Just a guess, or we just look at the raw dump first
        
    # For now, let's just print the raw data and exit to see what we have
    return
    
    for instrument in data:
        # If string, check directly
        if isinstance(instrument, str):
            if 'INR' in instrument:
                inr_related.append(instrument)
        else:
            # Convert entire object to string to search for 'INR'
            if 'INR' in json.dumps(instrument):
                inr_related.append(instrument)
            
    print(f"Instruments mentioning 'INR': {len(inr_related)}")
    
    if inr_related:
        print("\n--- SAMPLE INR INSTRUMENTS ---")
        for i in inr_related[:5]:
            print(json.dumps(i, indent=2))
    else:
        print("\n❌ No instruments found with 'INR' in metadata.")
        
    # Also check if there's a field for 'margin_currency' or similar in ANY instrument
    print("\n--- CHECKING KEY FIELDS ---")
    keys_of_interest = set()
    for instrument in data:
        if isinstance(instrument, dict):
            for k in instrument.keys():
                if 'margin' in k.lower() or 'currency' in k.lower() or 'asset' in k.lower():
                    keys_of_interest.add(k)
                
    print(f"Relevant Keys Found: {list(keys_of_interest)}")

if __name__ == "__main__":
    inspect_instruments()
