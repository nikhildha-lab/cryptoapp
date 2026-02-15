
import json
import os
import sys
from datetime import datetime

# Path setup
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(os.path.dirname(BASE_DIR), 'data')
STRATEGIES_FILE = os.path.join(DATA_DIR, 'active_strategies.json')
REPORT_FILE = os.path.join(DATA_DIR, 'excessive_losses_report.json')

def cleanup_strategies():
    if not os.path.exists(STRATEGIES_FILE):
        print("No active strategies found.")
        return

    print(f"Loading strategies from {STRATEGIES_FILE}...")
    with open(STRATEGIES_FILE, 'r') as f:
        strategies = json.load(f)

    active_strategies = []
    stopped_strategies = []

    loss_threshold = -5.0

    for s in strategies:
        # Check Total PnL Percentage (Realized + Unrealized if active)
        # using 'pnlPerc' which usually tracks realized, but for safety we check both
        
        # Calculate total drawdown including current open position
        realized_pnl_perc = s.get('pnlPerc', 0)
        unrealized_pnl_perc = s.get('unrealizedPnLPerc', 0)
        
        # If currently in a position, the "danger" is the sum or the max drawdown
        # But usually pnlPerc is cumulative realized. 
        # Requirement: "INSTANCES WHERE LOSS IS GREATER THAN 5%"
        
        # We check if the strategy *historically* has lost > 5% OR is currently losing > 5%
        is_bad = False
        reason = ""

        if realized_pnl_perc < loss_threshold:
            is_bad = True
            reason = f"Cumulative Loss {realized_pnl_perc:.2f}% < {loss_threshold}%"
        
        elif unrealized_pnl_perc < loss_threshold:
            is_bad = True
            reason = f"Current Open Loss {unrealized_pnl_perc:.2f}% < {loss_threshold}%"

        if is_bad:
            s['stopped_at'] = datetime.now().isoformat()
            s['stop_reason'] = "Excessive Loss Protocol (>5%)"
            s['final_status_check'] = reason
            s['status'] = 'stopped' # CRITICAL: Mark as stopped, don't delete
            stopped_strategies.append(s)
            active_strategies.append(s) # Keep in main list so engine sees the status change
            print(f"🚫 STOPPING: {s.get('instanceName')} ({s.get('symbol')}) - {reason}")
        else:
            active_strategies.append(s)

    # Save Clean List
    with open(STRATEGIES_FILE, 'w') as f:
        json.dump(active_strategies, f, indent=2)
    
    # Save Report
    with open(REPORT_FILE, 'w') as f:
        json.dump(stopped_strategies, f, indent=2)

    print(f"\nCleanup Complete.")
    print(f"Active: {len(active_strategies)}")
    print(f"Stopped: {len(stopped_strategies)}")
    print(f"Report saved to {REPORT_FILE}")

if __name__ == "__main__":
    cleanup_strategies()
