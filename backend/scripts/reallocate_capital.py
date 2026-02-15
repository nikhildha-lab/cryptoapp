
import json
import os
import sys

# Path setup
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(os.path.dirname(BASE_DIR), 'data')
STRATEGIES_FILE = os.path.join(DATA_DIR, 'active_strategies.json')
EXCLUSION_FILE = os.path.join(DATA_DIR, 'excluded_strategies.json')

def reallocate_capital():
    if not os.path.exists(STRATEGIES_FILE):
        print("No active strategies found.")
        return

    print(f"Loading strategies from {STRATEGIES_FILE}...")
    with open(STRATEGIES_FILE, 'r') as f:
        strategies = json.load(f)

    # 1. Update Capital for specific strategies
    target_strategies = ['ndrt-strategy', 'triple-confirmation']
    capital_multiplier = 1.5
    
    exclusion_list = ['mean-reversion-pro']
    
    total_strategies = 0
    modified_count = 0

    for s in strategies:
        sid = s.get('strategyId')
        
        # Capital Boost
        if sid in target_strategies:
            current_cap = float(s.get('capital', 1000))
            new_cap = current_cap * capital_multiplier
            s['capital'] = new_cap
            print(f"💰 BOOSTING: {s.get('instanceName')} ({sid}) Capital: {current_cap} -> {new_cap}")
            modified_count += 1
            
        # Tag for Exclusion (if active)
        if sid in exclusion_list and s.get('status') == 'active':
             s['status'] = 'stopped'
             s['stop_reason'] = 'User Exclusion Request'
             print(f"🚫 STOPPING EXCLUDED: {s.get('instanceName')} ({sid})")

    # Save Strategies
    with open(STRATEGIES_FILE, 'w') as f:
        json.dump(strategies, f, indent=2)
        
    # Save Exclusion List
    with open(EXCLUSION_FILE, 'w') as f:
        json.dump(exclusion_list, f, indent=2)

    print(f"\nReallocation Complete.")
    print(f"Strategies Boosted: {modified_count}")
    print(f"Exclusion List Saved to {EXCLUSION_FILE}: {exclusion_list}")

if __name__ == "__main__":
    reallocate_capital()
