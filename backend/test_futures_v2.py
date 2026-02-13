
import os
import sys
import json
import time
import hmac
import hashlib
import requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv(dotenv_path='.env.local')

api_key = os.getenv('COINDCX_API_KEY')
secret_key = os.getenv('COINDCX_SECRET_KEY')

base_url = "https://api.coindcx.com"

def request_custom(method, endpoint, body):
    url = base_url + endpoint
    # Compact JSON string as required by some APIs for signatures
    body_str = json.dumps(body, separators=(',', ':'))
    
    signature = hmac.new(
        secret_key.encode(),
        body_str.encode(),
        hashlib.sha256
    ).hexdigest()
    
    headers = {
        "Content-Type": "application/json",
        "X-AUTH-APIKEY": api_key,
        "X-AUTH-SIGNATURE": signature
    }
    
    print(f"\n--- Testing {method} {endpoint} ---")
    print(f"Body: {body_str}")
    
    if method == "GET":
        # Some non-standard APIs use bodies in GET requests
        response = requests.get(url, headers=headers, data=body_str)
    else:
        response = requests.post(url, headers=headers, data=body_str)
    
    print(f"Status Code: {response.status_code}")
    try:
        res_json = response.json()
        print(f"Response: {json.dumps(res_json, indent=2)}")
        return res_json
    except:
        print(f"Raw Response: {response.text}")
        return None

if __name__ == "__main__":
    if not api_key or not secret_key:
        print("Error: API keys missing")
        sys.exit(1)

    timestamp = int(time.time() * 1000)
    body = {"timestamp": timestamp}
    
    # Endpoint found by subagent
    endpoint = "/exchange/v1/derivatives/futures/wallets"
    
    # Try GET as suggested
    res_get = request_custom("GET", endpoint, body)
    
    # Try POST just in case (previous attempt 404'd, maybe due to non-compact JSON?)
    if not res_get or res_get.get('code') == 404:
        res_post = request_custom("POST", endpoint, body)
    
    # Also try Cross Margin Details again with compact JSON
    endpoint_margin = "/exchange/v1/derivatives/futures/positions/cross_margin_details"
    request_custom("POST", endpoint_margin, body)
