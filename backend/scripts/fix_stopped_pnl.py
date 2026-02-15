import json
import os

FILE_PATH = 'data/active_strategies.json'

def inspect_and_fix(fix=False):
    if not os.path.exists(FILE_PATH):
        print("File not found!")
        return

    with open(FILE_PATH, 'r') as f:
        strategies = json.load(f)

    stopped_strats = [s for s in strategies if s.get('status') == 'stopped']
    
    total_stopped_unrealized = sum(s.get('unrealizedPnL', 0) or 0 for s in stopped_strats)
    total_stopped_realized = sum(s.get('pnl', 0) or 0 for s in stopped_strats)
    
    print(f"Total Strategies: {len(strategies)}")
    print(f"Stopped Strategies: {len(stopped_strats)}")
    print(f"Stopped Unrealized PnL (Floating): {total_stopped_unrealized}")
    print(f"Stopped Realized PnL: {total_stopped_realized}")

    if fix and total_stopped_unrealized != 0:
        print("FIXING: Moving Unrealized -> Realized for stopped strategies...")
        for s in strategies:
            if s.get('status') == 'stopped':
                unrealized = s.get('unrealizedPnL', 0) or 0
                if unrealized != 0:
                    # Move to realized
                    s['pnl'] = (s.get('pnl', 0) or 0) + unrealized
                    # Zero out unrealized
                    s['unrealizedPnL'] = 0
                    s['unrealizedPnLPerc'] = 0
                    s['position'] = None # Ensure it's closed
        
        with open(FILE_PATH, 'w') as f:
            json.dump(strategies, f, indent=2)
        print("Fix applied. Saved to data/active_strategies.json")

if __name__ == "__main__":
    import sys
    fix_mode = '--fix' in sys.argv
    inspect_and_fix(fix_mode)
