
import os
import sys
import json
import time
import requests
import hmac
import hashlib
from dotenv import load_dotenv

# Load environment variables
load_dotenv(dotenv_path='.env.local')

api_key = os.getenv('COINDCX_API_KEY')
secret_key = os.getenv('COINDCX_SECRET_KEY')

base_url = "https://api.coindcx.com"

def get_signature(secret, body_str):
    return hmac.new(secret.encode(), body_str.encode(), hashlib.sha256).hexdigest()

def request(method, endpoint, body=None):
    url = base_url + endpoint
    headers = {
        "Content-Type": "application/json",
        "X-AUTH-APIKEY": api_key
    }
    if body:
        body_str = json.dumps(body)
        headers["X-AUTH-SIGNATURE"] = get_signature(secret_key, body_str)
        response = requests.request(method, url, headers=headers, data=body_str)
    else:
        response = requests.request(method, url, headers=headers)
    return response.json()

print("--- Discovering Markets ---")
try:
    url = "https://api.coindcx.com/exchange/v1/markets"
    res = requests.get(url).json()
    inr_pairs = [m for m in res if 'INR' in m or 'USDT' in m]
    print(f"Found {len(inr_pairs)} pairs. Examples:", inr_pairs[:5])
    
    # Check for specific USDT_INR
    usdt_inr = next((m for m in res if m == 'USDT_INR' or m == 'B-USDT_INR'), None)
    print("USDT_INR Symbol:", usdt_inr)
    
except Exception as e:
    print("Error fetching markets:", e)

print("\n--- Spot Balance (Base for Calculation) ---")
try:
    endpoint = "/exchange/v1/users/balances"
    body = {"timestamp": int(time.time() * 1000)}
    # Re-use request helper
    headers = {
        "Content-Type": "application/json",
        "X-AUTH-APIKEY": api_key
    }
    body_str = json.dumps(body)
    headers["X-AUTH-SIGNATURE"] = hmac.new(secret_key.encode(), body_str.encode(), hashlib.sha256).hexdigest()
    res = requests.post(base_url + endpoint, headers=headers, data=body_str).json()
    print("Spot Balance Sample:", str(res)[:200])
except Exception as e:
    print("Error fetching spot balance:", e)
