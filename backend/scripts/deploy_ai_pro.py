import json
import os
import uuid
from datetime import datetime

# Target Configuration
COINS = [
    "BTC/USDT", "ETH/USDT", "SOL/USDT", "ADA/USDT", "DOT/USDT",
    "LINK/USDT", "MATIC/USDT", "XRP/USDT", "DOGE/USDT", "AVAX/USDT"
]

TIMEFRAMES = ["3m", "5m", "15m", "1h", "4h"]
LEVERAGE = 5

STRATEGIES_FILE = 'data/active_strategies.json'

def deploy_ai_strategies():
    # Load existing strategies
    if os.path.exists(STRATEGIES_FILE):
        with open(STRATEGIES_FILE, 'r') as f:
            try:
                strategies = json.load(f)
            except:
                strategies = []
    else:
        strategies = []

    # Filter out existing AI strategies to replace them or prevent duplicates
    # For a clean "Deploy All" request, it's safer to remove old AI instances to ensure config match
    print("Cleaning up old AI Agent deployments...")
    strategies = [s for s in strategies if s.get('type') != 'AI_AGENT']

    new_strategies = []
    
    print(f"Deploying AI Pro Strategy for {len(COINS)} Coins x {len(TIMEFRAMES)} Timeframes...")

    for symbol in COINS:
        for tf in TIMEFRAMES:
            # Generate a consistent but unique ID structure or random UUID
            # Using UUID for system compatibility
            strat_id = str(uuid.uuid4())
            
            strat = {
                "id": strat_id,
                "strategyId": "ai-agent-pro",
                "instanceName": f"AI-{symbol.split('/')[0]}-{tf}",
                "type": "AI_AGENT", 
                "strategy": "AI Agent Pro",
                "symbol": symbol,
                "timeframe": tf,
                "exchange": "binance",
                "mode": "paper", # Safety default
                "status": "active",
                "capital": 1000,
                "leverage": LEVERAGE,
                "deployedAt": datetime.utcnow().isoformat() + "Z",
                
                # State initialization
                "position": None,
                "trades": 0,
                "pnl": 0,
                "wins": 0,
                "winRate": 0,
                "unrealizedPnL": 0,
                "unrealizedPnLPerc": 0,
                "params": {} # AI manages its own params usually
            }
            strategies.append(strat)
            new_strategies.append(f"{symbol} {tf}")

    # Save details
    os.makedirs(os.path.dirname(STRATEGIES_FILE), exist_ok=True)
    with open(STRATEGIES_FILE, 'w') as f:
        json.dump(strategies, f, indent=2)

    print(f"✅ Successfully deployed {len(new_strategies)} AI Strategies.")
    print(f"Configuration: 5x Leverage, {', '.join(TIMEFRAMES)}")
    print("Please RESTART the backend server to activate these strategies.")

if __name__ == "__main__":
    deploy_ai_strategies()
