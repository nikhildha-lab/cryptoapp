
import json
import os
import sys

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '../data')
STRATEGIES_FILE = os.path.join(DATA_DIR, 'active_strategies.json')

def recover_data():
    if not os.path.exists(STRATEGIES_FILE):
        print("No active strategies file found.")
        return

    with open(STRATEGIES_FILE, 'r') as f:
        strategies = json.load(f)

    updated_count = 0
    for s in strategies:
        if s.get('status') in ['active', 'Running'] and s.get('position'):
            entry_price = s.get('entry_price')
            if not entry_price:
                continue

            # Recover SL
            if not s.get('current_sl'):
                sl_perc = float(s.get('stop_loss', 0.02))
                if s['position'] == 'long':
                    s['current_sl'] = entry_price * (1 - sl_perc)
                else:
                    s['current_sl'] = entry_price * (1 + sl_perc)
                updated_count += 1
                print(f"Recovered SL for {s['instanceName']}: {s['current_sl']:.4f}")

            # Recover TP
            if not s.get('current_tp'):
                tp_perc = float(s.get('take_profit', 0.05))
                if s['position'] == 'long':
                    s['current_tp'] = entry_price * (1 + tp_perc)
                else:
                    s['current_tp'] = entry_price * (1 - tp_perc)
                updated_count += 1
                print(f"Recovered TP for {s['instanceName']}: {s['current_tp']:.4f}")
            
            # Recover Trailing SL
            if not s.get('trailing_sl'):
                 # Best guess: use current_sl itself if trailing logic moved it
                 pass 

    if updated_count > 0:
        with open(STRATEGIES_FILE, 'w') as f:
            json.dump(strategies, f, indent=2)
        print(f"Successfully recovered SL/TP for {updated_count} active strategies.")
    else:
        print("No recovery needed.")

if __name__ == "__main__":
    recover_data()
