import json
import os
from collections import defaultdict

FILE_PATH = 'data/active_strategies.json'

def deep_analyze():
    if not os.path.exists(FILE_PATH):
        print("File not found!")
        return

    with open(FILE_PATH, 'r') as f:
        strategies = json.load(f)

    print(f"Total Strategies in File: {len(strategies)}")
    
    # Group by Status and Mode
    groups = defaultdict(lambda: {'count': 0, 'pnl': 0.0})
    
    for s in strategies:
        key = f"Status: {s.get('status')} | Mode: {s.get('mode')}"
        groups[key]['count'] += 1
        groups[key]['pnl'] += s.get('pnl', 0) or 0

    print("\n--- Breakdown ---")
    for key, data in sorted(groups.items()):
        print(f"{key:<40} Count: {data['count']:<5} PnL: {data['pnl']:,.2f}")

    print("\n--- Negative PnL Audit ---")
    neg_strats = [s for s in strategies if (s.get('pnl', 0) or 0) < -100]
    print(f"Strategies with <-100 PnL: {len(neg_strats)}")
    if neg_strats:
        print(f"Top 5 Losers:")
        for s in sorted(neg_strats, key=lambda x: x.get('pnl', 0))[:5]:
             print(f"  ID: {s.get('id')} | {s.get('strategy')} | PnL: {s.get('pnl')}")

if __name__ == "__main__":
    deep_analyze()
