
import os
import sys
import pandas as pd
import json
from dotenv import load_dotenv

# Load env
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env.local'))

# Add backend
sys.path.append(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend'))
from ai_agent import AIAgent

def test_real_ai():
    print("🚀 Initializing Real AI Agent Test...")
    
    agent = AIAgent()
    
    print(f"ℹ️  Provider: {agent.provider}")
    print(f"🔑 API Key Present: {'Yes' if agent.api_key else 'No'}")
    
    if agent.provider == 'mock':
        print("⚠️  Agent is in MOCK mode. Please check .env.local for AI_API_KEY and AI_MODEL_PROVIDER=gemini")
        return

    # Create dummy data
    data = {
        'timestamp': [pd.Timestamp.now()],
        'open': [50000],
        'high': [51000],
        'low': [49000],
        'close': [50500],
        'volume': [100],
        'rsi': [65.0], # Neutral-ish
        'macd': [50.0]
    }
    df = pd.DataFrame(data)
    
    print("\n📤 Sending Prompt to Gemini...")
    try:
        signal = agent.analyze_market("BTC/USDT", "1h", df)
        print("\n📥 Received Signal:")
        print(json.dumps(signal, indent=2))
        
        if signal.get('action') in ['BUY', 'SELL', 'HOLD']:
            print("\n✅ Verification SUCCESS: Valid JSON signal received from AI.")
        else:
            print("\n❌ Verification FAILED: Invalid signal structure.")
            
    except Exception as e:
        print(f"\n❌ Verification FAILED: {e}")

if __name__ == "__main__":
    test_real_ai()
