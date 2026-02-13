
import os
import sys
import json
import time
import hmac
import hashlib
import requests
from dotenv import load_dotenv

load_dotenv(dotenv_path='.env.local')

api_key = os.getenv('COINDCX_API_KEY')
secret_key = os.getenv('COINDCX_SECRET_KEY')

base_url = "https://api.coindcx.com"

def request(method, endpoint, body=None):
    url = base_url + endpoint
    headers = {
        "Content-Type": "application/json",
        "X-AUTH-APIKEY": api_key
    }
    if body:
        body_str = json.dumps(body)
        headers["X-AUTH-SIGNATURE"] = hmac.new(secret_key.encode(), body_str.encode(), hashlib.sha256).hexdigest()
        response = requests.request(method, url, headers=headers, data=body_str)
    else:
        response = requests.request(method, url, headers=headers)
    return response.json()

print("--- 1. Full Balance Dump (Spot/Trade) ---")
try:
    endpoint = "/exchange/v1/users/balances"
    body = {"timestamp": int(time.time() * 1000)}
    res = request("POST", endpoint, body)
    # Print everything that has 'INR' in currency name or > 0 balance
    print("Printing all non-zero OR INR-related balances:")
    if isinstance(res, list):
        for asset in res:
            if float(asset.get('balance', 0)) > 0 or 'INR' in asset.get('currency', ''):
                print(asset)
    else:
        print(res)
except Exception as e:
    print("Error:", e)

print("\n--- 2. Account Information ---")
try:
    # Try getting account info which sometimes has wallet summaries
    endpoint = "/exchange/v1/users/info"
    body = {"timestamp": int(time.time() * 1000)}
    res = request("POST", endpoint, body)
except Exception as e:
    print("Error:", e)

except Exception as e:
    print("Error:", e)

except Exception as e:
    print("Error:", e)

except Exception as e:
    print("Error:", e)

print("\n--- 3. Broad Endpoint Discovery ---")
endpoints = [
    "/exchange/v1/margin/users/balances",
    "/exchange/v1/derivatives/futures/wallets",
    "/exchange/v1/derivatives/futures/balances",
    "/exchange/v1/users/balances/dust"
    # "/exchange/v1/portfolio/holdings" - unlikely to exist based on docs but worth a try? No, stick to known patterns.
]

for ep in endpoints:
    try:
        print(f"\nTesting {ep}...")
        body = {"timestamp": int(time.time() * 1000)}
        # We use our custom request wrapper but capture the raw response to check status code
        # Actually our wrapper returns json directly. Let's wrap it in try/except to see if it even parses.
        res = request("POST", ep, body)
        print("Response:", str(res)[:200])
    except Exception as e:
        print(f"Failed {ep}: {e}")
