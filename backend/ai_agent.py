
import os
import json
import logging
from datetime import datetime
import pandas as pd

# Placeholder for LLM clients
try:
    from openai import OpenAI
except ImportError:
    OpenAI = None

try:
    import google.generativeai as genai
except ImportError:
    genai = None

class AIAgent:
    def __init__(self):
        self.provider = os.getenv('AI_MODEL_PROVIDER', 'mock').lower()
        self.api_key = os.getenv('AI_API_KEY')
        self.model_name = os.getenv('AI_MODEL_NAME', 'gpt-4o' if self.provider == 'openai' else 'gemini-2.0-flash')
        self.logger = logging.getLogger("AIAgent")
        
        self.client = None
        
        if self.provider == 'openai':
            if OpenAI and self.api_key:
                self.client = OpenAI(api_key=self.api_key)
            else:
                self.logger.warning("OpenAI provider selected but library missing or no key. Swapping to mock.")
                self.provider = 'mock'
                
        elif self.provider == 'gemini':
            if genai and self.api_key:
                genai.configure(api_key=self.api_key)
                self.client = genai.GenerativeModel(self.model_name)
            else:
                self.logger.warning("Gemini provider selected but library missing or no key. Swapping to mock.")
                self.provider = 'mock'
            
        self.backtest_mode = os.getenv('AI_BACKTEST_MODE', 'false').lower() == 'true'
        if self.backtest_mode:
            self.logger.info("AI Agent running in SYNTHETIC BACKTEST MODE (No LLM calls)")
        else:
            self.logger.info(f"AI Agent Initialized with provider: {self.provider}")

    def analyze_market(self, symbol, timeframe, df):
        """
        Analyzes market data using LLM and returns specific trading signal.
        
        Args:
            symbol (str): e.g., 'BTC/USDT'
            timeframe (str): e.g., '1h'
            df (pd.DataFrame): OHLCV data with indicators
            
        Returns:
            dict: {
                "action": "BUY" | "SELL" | "HOLD",
                "confidence": float (0-100),
                "reason": str (short explanation)
            }
        """
        
        # 0. Backtest Mode (Synthetic Logic)
        if self.backtest_mode:
            return self._synthetic_analysis(df)

        # 1. Prepare Context
        context = self._prepare_context(symbol, timeframe, df)
        
        # 2. Query LLM
        response_text = self._query_llm(context)
        
        # 3. Parse Response
        signal = self._parse_response(response_text)
        
        return signal

    def _synthetic_analysis(self, df):
        """
        Simulates AI decision making based on strict technical rules.
        Used for fast backtesting without LLM costs.
        """
        # Ensure indicators are present
        from strategy_logic import StrategyLogic
        df = StrategyLogic.calculate_indicators(df)
        last = df.iloc[-1]
        
        price = last['close']
        vwap = last.get('vwap', price)
        ema50 = last.get('ema_50', price)
        ema200 = last.get('ema_200', price)
        rsi = last.get('rsi', 50)
        
        signal = "HOLD"
        reason = "Neutral"
        confidence = 0
        
        # LOGIC v6: TREND RIDER 4H (Momentum)
        # 1. Macro: Price > EMA 200 (Bull Market)
        # 2. Trigger: Price > EMA 21 (Short Term Momentum)
        # 3. Filter: EMA 21 > EMA 50 (Expansion)
        
        # Indicators
        ema21 = last.get('ema_21', price)
        
        if price > ema200:
            # Bull Market - Look for Longs
            if price > ema21 and ema21 > ema50:
                 signal = "BUY"
                 reason = "Synthetic AI: Trend Rider (Price > EMA 21 > 50 > 200)"
                 confidence = 90
            elif price < ema21:
                 # Exit Long if we lose momentum
                 signal = "SELL" 
                 reason = "Synthetic AI: Lost Momentum (Price < EMA 21)"
                 
        elif price < ema200:
            # Bear Market - Avoid Longs (or specific Short logic)
            signal = "SELL" # Close any longs
            reason = "Synthetic AI: Bear Market (Price < EMA 200)"
            
            # Optional: Short logic
            if price < ema21 and ema21 < ema50:
                # signal = "SELL_SHORT" # (If engine supported it)
                pass
                
        return {
            "action": signal,
            "confidence": confidence,
            "reason": reason
        }

    def _prepare_context(self, symbol, timeframe, df):
        # Custom Import to avoid circular dependency at top level
        # We need to ensure we have the indicators calculated before context preparation
        # In a real app, `df` passed here might already have them if processed by engine.
        # But to be safe, we recalculate/ensure them.
        from strategy_logic import StrategyLogic
        df = StrategyLogic.calculate_indicators(df)

        # Get last 5 rows
        recent_data = df.tail(5).copy()
        last = recent_data.iloc[-1]
        
        # Format string
        data_str = recent_data[['timestamp', 'open', 'high', 'low', 'close', 'volume', 'rsi', 'macd', 'ema_50', 'vwap']].to_string(index=False)
        
        prompt = f"""
You are a professional crypto trading bot. Analyze the market data for {symbol} ({timeframe}).

Recent Market Data (OHLCV + Indicators):
{data_str}

Key Technicals (Last Candle):
- Price: {last['close']:.4f}
- RSI (14): {last.get('rsi', 'N/A')}
- MACD: {last.get('macd', 'N/A')}
- EMAs: 21={last.get('ema_21', 'N/A'):.4f}, 50={last.get('ema_50', 'N/A'):.4f}, 200={last.get('ema_200', 'N/A'):.4f}
- VWAP (24h): {last.get('vwap', 'N/A'):.4f}
- OBV (Order Flow): {last.get('obv', 'N/A')}

Trend Analysis:
- Price vs VWAP: {"Bullish" if last['close'] > last.get('vwap', 999999) else "Bearish"}
- Price vs EMA 200: {"Bullish" if last['close'] > last.get('ema_200', 999999) else "Bearish"}

Task:
Determine the immediate trading action based on Trend, Momentum, and Order Flow.

Output Format (JSON Only):
{{
  "action": "BUY" | "SELL" | "HOLD",
  "confidence": <number 0-100>,
  "reason": "<concise explanation citing specific indicators>"
}}
"""
        return prompt

    def _query_llm(self, prompt):
        """Sends prompt to the configured LLM provider."""
        try:
            if self.provider == 'openai':
                return self._query_openai(prompt)
            elif self.provider == 'gemini':
                return self._query_gemini(prompt)
            else:
                return self._mock_response(prompt)
        except Exception as e:
            self.logger.error(f"LLM Query Failed: {e}")
            return self._mock_response(prompt) # Fallback

    def _query_openai(self, prompt):
        response = self.client.chat.completions.create(
            model=self.model_name,
            messages=[
                {"role": "system", "content": "You are a crypto trading expert. Output JSON only."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"}
        )
        return response.choices[0].message.content

    def _query_gemini(self, prompt):
        # Gemini doesn't always support strict JSON mode in older libs, but prompt helps
        response = self.client.generate_content(prompt)
        return response.text

    def _mock_response(self, prompt):
        """Generates a dummy response for testing/paper trading."""
        # STRICT AUDIT: Throw error if no provider is configured.
        raise ValueError("AI Provider not configured. Set AI_API_KEY in .env.local")

    def _parse_response(self, response_text):
        """Parses the LLM's string response into a dictionary."""
        try:
            # Clean generic markdown code blocks if present
            cleaned = response_text.replace("```json", "").replace("```", "").strip()
            return json.loads(cleaned)
        except json.JSONDecodeError:
            self.logger.error(f"Failed to parse AI response: {response_text}")
            return {
                "action": "HOLD",
                "confidence": 0,
                "reason": "Error parsing AI response"
            }
