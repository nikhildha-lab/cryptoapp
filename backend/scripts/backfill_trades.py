import json
import os
import sys
import subprocess

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

SHORTLISTED_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'shortlisted_strategies.json')
BACKTEST_SCRIPT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'run_backtest.py')

def backfill_trades():
    if not os.path.exists(SHORTLISTED_PATH):
        print("No shortlisted strategies found.")
        return

    with open(SHORTLISTED_PATH, 'r') as f:
        strategies = json.load(f)

    updated_strategies = []
    print(f"Backfilling trades for {len(strategies)} strategies...")

    for strat in strategies:
        sid = strat['strategyId']
        symbol = strat['symbol']
        tf = strat['timeframe']
        
        # Use existing params if available
        params = strat.get('params', {})
        leverage = params.get('leverage', strat.get('leverage', 1))

        print(f"  Running backtest for {sid} {symbol} {tf}...")
        
        # Run backtest to get trades
        cmd = [sys.executable, BACKTEST_SCRIPT, sid, symbol, tf, str(leverage), '365', '10000']
        try:
            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode == 0:
                output = json.loads(result.stdout)
                if 'trades_list' in output:
                    strat['trades_list'] = output['trades_list']
                    strat['trades'] = output['trades_list'] # Populate both for compatibility
                    print(f"    ✅ Captured {len(output['trades_list'])} trades.")
                else:
                    print("    ⚠️ No trades list returned.")
            else:
                print(f"    ❌ Backtest failed: {result.stderr}")
        except Exception as e:
            print(f"    ❌ Exception: {e}")
        
        updated_strategies.append(strat)

    # Save back
    with open(SHORTLISTED_PATH, 'w') as f:
        json.dump(updated_strategies, f, indent=2)
    
    print("Backfill complete. Saved to shortlisted_strategies.json.")

    # Now trigger the identify_favorites logic to sync
    FAVORITES_SCRIPT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'identify_favorites.py')
    subprocess.run([sys.executable, FAVORITES_SCRIPT, '5']) # Threshold 5

if __name__ == "__main__":
    backfill_trades()
