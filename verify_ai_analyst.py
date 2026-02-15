
import sys
import os
import pandas as pd
import json

# Setup paths
sys.path.append(os.path.join(os.getcwd(), 'backend'))

try:
    from ai_agent import AIAgent
    from strategy_logic import StrategyLogic
except ImportError as e:
    print(f"Import Error: {e}")
    sys.exit(1)

def test_ai_prompt_generation():
    print("Testing AI Agent Prompt Generation...")
    
    # Mock DF
    data = {
        'timestamp': pd.date_range(start='2024-01-01', periods=100, freq='1h'),
        'open': [100] * 100,
        'high': [105] * 100,
        'low': [95] * 100,
        'close': [102] * 100,
        'volume': [1000] * 100
    }
    df = pd.DataFrame(data)
    
    agent = AIAgent()
    
    # Test Context Prep (Proposed Logic)
    # We can't easily test _prepare_context directly if it's internal, but we can verify it doesn't crash
    # or expose it if needed. For now, let's call analyze_market with BACKTEST MODE forced to avoid API calls
    # OR mock the _query_llm to just return the prompt for inspection.
    
    # Let's monkeypatch _query_gemini to print the prompt
    original_query = agent._query_gemini
    
    def mock_query(prompt):
        print("\n--- GENERATED PROMPT PREVIEW ---")
        print(prompt[:500] + "... [TRUNCATED]")
        print("--------------------------------\n")
        return json.dumps({
            "action": "BUY",
            "confidence": 85,
            "leverage": 10,
            "entry_zone": "100-102",
            "stop_loss_price": 98.5,
            "take_profit_price": 105.0,
            "market_structure": "Bullish",
            "reason": "Test Reason"
        })
        
    agent._query_gemini = mock_query
    agent._query_openai = mock_query
    agent._mock_response = mock_query
    
    # Force provider to gemini to test that path logic
    agent.provider = 'gemini' 
    agent.backtest_mode = False 
    
    try:
        decision = agent.analyze_market("BTC/USDT", "1h", df)
        print("Decision Received:", decision)
        
        if decision['action'] == 'BUY' and decision['market_structure'] == 'Bullish':
            print("✅ AI Analyst Logic Verified (Prompt generated & Response parsed)")
        else:
            print("❌ AI Analyst Logic Failed Verification")
            
    except Exception as e:
        print(f"❌ Execution Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_ai_prompt_generation()
