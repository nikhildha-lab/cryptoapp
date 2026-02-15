import json
import os

FILE_PATH = 'data/active_strategies.json'

def analyze_strategies():
    if not os.path.exists(FILE_PATH):
        print("File not found!")
        return

    with open(FILE_PATH, 'r') as f:
        strategies = json.load(f)

    active = [s for s in strategies if s.get('status') == 'active' or s.get('status') == 'Running']
    stopped = [s for s in strategies if s.get('status') == 'stopped']
    other = [s for s in strategies if s not in active and s not in stopped]

    print(f"Total Count: {len(strategies)}")
    print(f"Active/Running: {len(active)}")
    print(f"Stopped: {len(stopped)}")
    print(f"Other Status: {len(other)}")
    
    active_pnl = sum(s.get('pnl', 0) or 0 for s in active)
    stopped_pnl = sum(s.get('pnl', 0) or 0 for s in stopped)
    
    print("-" * 30)
    print(f"Active PnL: {active_pnl}")
    print(f"Stopped PnL: {stopped_pnl}")
    print(f"Total PnL: {active_pnl + stopped_pnl}")

    if len(other) > 0:
        print(f"Other Statuses found: {set(s.get('status') for s in other)}")

if __name__ == "__main__":
    analyze_strategies()
