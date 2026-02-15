
import json
import os
import sys
from datetime import datetime

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(BASE_DIR, 'models/alphaxgb_weights.json')
FAVORITES_PATH = os.path.join(BASE_DIR, '../data/ai_picks.json')
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def identify_favorites(threshold=3.0):
    print(f"[{datetime.now().isoformat()}] ⭐ AlphaXGB: Identifying Top Picks...")
    
    if not os.path.exists(MODEL_PATH):
        print(f"❌ AlphaXGB: Model file not found at {MODEL_PATH}")
        return

    try:
        with open(MODEL_PATH, 'r') as f:
            data = json.load(f)
        
        weights = data.get('weights', {})
        favorites = []

        from run_backtest import run_backtest

        for key, stats in weights.items():
            score = stats.get('score', 0)
            if score >= threshold:
                parts = key.split('|')
                if len(parts) == 3:
                    strat_id, symbol, timeframe = parts
                    
                    print(f"   📊 Backtesting {key} for detailed metrics...")
                    metrics = {}
                    try:
                        # Fast backtest for 180 days to get Sharpe/Drawdown
                        bt_result = run_backtest(strat_id, symbol, timeframe, days=180, leverage=5)
                        metrics = {
                            "sharpe": bt_result.get('sharpe_ratio', 0),
                            "drawdown": bt_result.get('max_drawdown', 0)
                        }
                    except Exception as bt_err:
                        print(f"      ⚠️ Backtest failed: {bt_err}")
                        metrics = {"sharpe": 0, "drawdown": 0}

                    favorites.append({
                        "id": key,
                        "strategyId": strat_id,
                        "symbol": symbol,
                        "timeframe": timeframe,
                        "alpha_score": score,
                        "trades": stats.get('trades', 0),
                        "trades_list": bt_result.get('trades_list', []),
                        "winRate": stats.get('winRate', 0),
                        "avgPnL": stats.get('avgPnL', 0),
                        "sharpe": metrics.get('sharpe', 0),
                        "drawdown": metrics.get('drawdown', 0),
                        "last_updated": datetime.now().isoformat()
                    })

        # Sort by score descending
        favorites.sort(key=lambda x: x['alpha_score'], reverse=True)

        # Save to favorites.json
        os.makedirs(os.path.dirname(FAVORITES_PATH), exist_ok=True)
        with open(FAVORITES_PATH, 'w') as f:
            json.dump({
                "last_sync": datetime.now().isoformat(),
                "threshold": threshold,
                "count": len(favorites),
                "items": favorites
            }, f, indent=2)

        print(f"✅ AlphaXGB: Found {len(favorites)} high-performing combinations (Score >= {threshold}).")
        print(f"📁 Favorites saved to: {FAVORITES_PATH}")

    except Exception as e:
        print(f"❌ AlphaXGB Error: {e}")

if __name__ == "__main__":
    # Allow threshold override via cmd line
    target_threshold = 7.0
    if len(sys.argv) > 1:
        try:
            target_threshold = float(sys.argv[1])
        except:
            pass
            
    identify_favorites(target_threshold)
