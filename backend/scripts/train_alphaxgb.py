
import json
import os
import pandas as pd
import numpy as np
from datetime import datetime

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HISTORY_PATH = os.path.join(BASE_DIR, '../data/trade_history.json')
MODEL_PATH = os.path.join(BASE_DIR, 'models/alphaxgb_weights.json')

def train_alphaxgb():
    print(f"[{datetime.now().isoformat()}] 🧠 AlphaXGB: Starting Continuous Learning Cycle...")
    
    EXCLUSION_PATH = os.path.join(BASE_DIR, '../data/excluded_strategies.json')
    exclusions = []
    if os.path.exists(EXCLUSION_PATH):
        try:
            with open(EXCLUSION_PATH, 'r') as f:
                exclusions = json.load(f)
        except:
            pass
    
    if not os.path.exists(HISTORY_PATH):
        print("❌ AlphaXGB: No trade history found. Skipping training.")
        return

    try:
        with open(HISTORY_PATH, 'r') as f:
            history = json.load(f)
        
        if not history:
            print("❌ AlphaXGB: Trade history is empty.")
            return

        df = pd.DataFrame(history)
        df['pnl'] = pd.to_numeric(df['pnl'], errors='coerce')
        df = df[df['pnl'].notnull()]

        if df.empty:
            print("❌ AlphaXGB: No completed trades to learn from.")
            return

        # 1. Calculate Weights for Strategy + Symbol + Timeframe
        # Success Metric: Balanced PnL and Win Rate
        stats = df.groupby(['strategyId', 'symbol', 'timeframe']).agg({
            'pnl': ['mean', 'sum', 'count'],
        }).reset_index()
        
        # Flatten columns
        stats.columns = ['strategyId', 'symbol', 'timeframe', 'avg_pnl', 'total_pnl', 'trade_count']
        
        # Win Rate calculation
        wins = df[df['pnl'] > 0].groupby(['strategyId', 'symbol', 'timeframe']).size().reset_index(name='wins')
        stats = pd.merge(stats, wins, on=['strategyId', 'symbol', 'timeframe'], how='left').fillna(0)
        stats['win_rate'] = stats['wins'] / stats['trade_count']

        # 2. Score Calculation (The "Alpha" Score)
        # We reward consistency (win rate) and high total PnL
        # Normalize trade count to avoid rewarding lucky one-off wins too much
        stats['relevance'] = np.log1p(stats['trade_count'])
        stats['alpha_score'] = (stats['avg_pnl'] * 0.4) + (stats['win_rate'] * 10 * 0.6)
        stats['alpha_score'] *= stats['relevance']

        # 3. Apply Risk Exclusions (Force multipliers)
        # If it's a known bad combo (SOL/LINK MR or 15m/30m), we tank the score
        for i, row in stats.iterrows():
            if row['timeframe'] in ['15m', '30m']:
                stats.at[i, 'alpha_score'] = -100.0
            if row['strategyId'] in exclusions:
                stats.at[i, 'alpha_score'] = -999.0 # HARD EXCLUSION
            if row['strategyId'] == 'mean-reversion-pro' and row['symbol'] in ['SOL/USDT', 'LINK/USDT']:
                stats.at[i, 'alpha_score'] = -100.0

        # Create weight matrix dictionary
        weight_matrix = {}
        for _, row in stats.iterrows():
            key = f"{row['strategyId']}|{row['symbol']}|{row['timeframe']}"
            weight_matrix[key] = {
                "score": round(float(row['alpha_score']), 4),
                "trades": int(row['trade_count']),
                "winRate": round(float(row['win_rate']), 2),
                "avgPnL": round(float(row['avg_pnl']), 2)
            }

        # 4. Save Model
        os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
        with open(MODEL_PATH, 'w') as f:
            json.dump({
                "version": "1.1.0-lightweight",
                "last_trained": datetime.now().isoformat(),
                "total_samples": len(df),
                "weights": weight_matrix
            }, f, indent=2)

        print(f"✅ AlphaXGB: Learning Complete. Scored {len(weight_matrix)} strategy combinations.")
        print(f"📁 Model saved to: {MODEL_PATH}")

    except Exception as e:
        print(f"❌ AlphaXGB Error: {e}")

if __name__ == "__main__":
    train_alphaxgb()
