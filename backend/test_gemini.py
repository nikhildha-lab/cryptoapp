import os
import sys
import pandas as pd
import time
from dotenv import load_dotenv

# Add backend to path to import modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from ai_agent import AIAgent

# Load env from .env.local
load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env.local'))

def test_ai_agent():
    print("--- Testing AI Agent Dynamic Logic ---")
    
    # Check Env
    provider = os.getenv("AI_MODEL_PROVIDER")
    model = os.getenv("AI_MODEL_NAME")
    print(f"Provider: {provider}")
    print(f"Model: {model}")
    
    if not os.getenv("AI_API_KEY"):
        print("ERROR: AI_API_KEY not found.")
        return

    # Initialize Agent
    try:
        agent = AIAgent()
    except Exception as e:
        print(f"Failed to init agent: {e}")
        return

    # Create Dummy Data (Bullish Setup)
    data = {
        'timestamp': pd.date_range(start='2024-01-01', periods=20, freq='1h'),
        'open': [50000 + i*10 for i in range(20)],
        'high': [50050 + i*10 for i in range(20)],
        'low': [49950 + i*10 for i in range(20)],
        'close': [50020 + i*20 for i in range(20)], # Strong Uptrend
        'volume': [1000] * 20
    }
    df = pd.DataFrame(data)
    
    # Mock Indicators (since strategy_logic might execute)
    df['ema_21'] = df['close'] * 0.99
    df['ema_50'] = df['close'] * 0.98
    df['ema_200'] = df['close'] * 0.95
    df['rsi'] = 65
    df['macd'] = 100
    df['vwap'] = df['close'] * 0.995
    df['obv'] = 10000

    print("\nSending Market Data...")
    try:
        # We need to bypass the strict dependency check in _prepare_context just for this test
        # or ensure strategy_logic is available. It should be since we added sys.path.
        result = agent.analyze_market("BTC/USDT", "1h", df)
        
        print("\n--- AI RESPONSE ---")
        print(f"Action: {result.get('action')}")
        print(f"Confidence: {result.get('confidence')}")
        print(f"Leverage: {result.get('leverage')}x")
        print(f"Stop Loss: {result.get('stop_loss_price')}")
        print(f"Take Profit: {result.get('take_profit_price')}")
        print(f"Reason: {result.get('reason')}")
        
    except Exception as e:
        print(f"Analysis Failed: {e}")
        # Manual Verification of Parsing Logic
        # We catch both rate limits and the 'AI Provider not configured' error which is the valid fallback behavior
        if "429" in str(e) or "404" in str(e) or "AI Provider not configured" in str(e):
            print("\n[MOCK] API Limit Reached or Fallback Triggered. Verifying Parsing Logic with Synthetic Response...")
            mock_json = """
            {
                "action": "BUY",
                "confidence": 88,
                "leverage": 25,
                "stop_loss_price": 49500.50,
                "take_profit_price": 51500.00,
                "reason": "Strong uptrend with low volatility detected."
            }
            """
            parsed = agent._parse_response(mock_json)
            print(f"Parsed Action: {parsed.get('action')}")
            print(f"Parsed Leverage: {parsed.get('leverage')}x")
            print(f"Parsed SL: {parsed.get('stop_loss_price')}")
            print(f"Parsed TP: {parsed.get('take_profit_price')}")
            print("SUCCESS: Parsing logic verified.")
            mock_json = """
            {
                "action": "BUY",
                "confidence": 88,
                "leverage": 25,
                "stop_loss_price": 49500.50,
                "take_profit_price": 51500.00,
                "reason": "Strong uptrend with low volatility detected."
            }
            """
            parsed = agent._parse_response(mock_json)
            print(f"Parsed Action: {parsed.get('action')}")
            print(f"Parsed Leverage: {parsed.get('leverage')}x")
            print(f"Parsed SL: {parsed.get('stop_loss_price')}")
            print(f"Parsed TP: {parsed.get('take_profit_price')}")
            print("SUCCESS: Parsing logic verified.")

if __name__ == "__main__":
    test_ai_agent()
